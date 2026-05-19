/**
 * skill benchmark コマンド
 *
 * benchmark ディレクトリの grading.json ファイルを集計して
 * benchmark.json と benchmark.md を生成する。
 *
 * Derived from: https://github.com/anthropics/skills/tree/main/skills/skill-creator
 * Original: scripts/aggregate_benchmark.py, scripts/generate_report.py
 * Original licensed under Apache License 2.0 (Copyright 2025 Anthropic, PBC).
 * Modified for shirokuma-docs: ported to TypeScript with CLI integration.
 *   - Python → TypeScript
 *   - benchmark.md 形式のレポート生成（Handlebars は不使用、テンプレートリテラルで実装）
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
// =============================================================================
// 統計計算
// =============================================================================
/**
 * 数値配列の mean, stddev, min, max を計算する。
 */
function calculateStats(values) {
    if (values.length === 0) {
        return { mean: 0, stddev: 0, min: 0, max: 0 };
    }
    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = n > 1
        ? values.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (n - 1)
        : 0;
    const stddev = Math.sqrt(variance);
    return {
        mean: Math.round(mean * 10000) / 10000,
        stddev: Math.round(stddev * 10000) / 10000,
        min: Math.round(Math.min(...values) * 10000) / 10000,
        max: Math.round(Math.max(...values) * 10000) / 10000,
    };
}
/**
 * benchmark ディレクトリからすべての run 結果を読み込む。
 * 2 種類のレイアウト（workspace / legacy）をサポート。
 */
function loadRunResults(benchmarkDir) {
    const results = new Map();
    // レイアウト判定
    const runsDir = join(benchmarkDir, "runs");
    const searchDir = existsSync(runsDir) ? runsDir : benchmarkDir;
    // eval-N ディレクトリを昇順でソート
    let evalDirs = [];
    try {
        evalDirs = readdirSync(searchDir, { withFileTypes: true })
            .filter(d => d.isDirectory() && d.name.startsWith("eval-"))
            .map(d => d.name)
            .sort();
    }
    catch {
        return results;
    }
    for (let evalIdx = 0; evalIdx < evalDirs.length; evalIdx++) {
        const evalDirName = evalDirs[evalIdx];
        const evalDirPath = join(searchDir, evalDirName);
        // eval_metadata.json から eval_id を取得
        let evalId = evalIdx;
        const metadataPath = join(evalDirPath, "eval_metadata.json");
        if (existsSync(metadataPath)) {
            try {
                const metadata = JSON.parse(readFileSync(metadataPath, "utf-8"));
                if (metadata["eval_id"] !== undefined) {
                    evalId = metadata["eval_id"];
                }
            }
            catch {
                // フォールバック
            }
        }
        else {
            const parts = evalDirName.split("-");
            const parsed = parseInt(parts[1] ?? "", 10);
            if (!isNaN(parsed))
                evalId = parsed;
        }
        // config ディレクトリを走査
        let configDirs = [];
        try {
            configDirs = readdirSync(evalDirPath, { withFileTypes: true })
                .filter(d => d.isDirectory())
                .map(d => d.name)
                .sort();
        }
        catch {
            continue;
        }
        for (const configName of configDirs) {
            const configPath = join(evalDirPath, configName);
            // run-* ディレクトリが存在しない設定ディレクトリはスキップ
            let runDirs = [];
            try {
                runDirs = readdirSync(configPath, { withFileTypes: true })
                    .filter(d => d.isDirectory() && d.name.startsWith("run-"))
                    .map(d => d.name)
                    .sort();
            }
            catch {
                continue;
            }
            if (runDirs.length === 0)
                continue;
            if (!results.has(configName)) {
                results.set(configName, []);
            }
            for (const runDirName of runDirs) {
                const runPath = join(configPath, runDirName);
                const parts = runDirName.split("-");
                const runNumber = parseInt(parts[1] ?? "1", 10);
                const gradingFile = join(runPath, "grading.json");
                if (!existsSync(gradingFile)) {
                    process.stderr.write(`Warning: grading.json not found in ${runPath}\n`);
                    continue;
                }
                let grading;
                try {
                    grading = JSON.parse(readFileSync(gradingFile, "utf-8"));
                }
                catch (e) {
                    process.stderr.write(`Warning: Invalid JSON in ${gradingFile}: ${e instanceof Error ? e.message : String(e)}\n`);
                    continue;
                }
                const summary = grading["summary"] ?? {};
                const timing = grading["timing"] ?? {};
                const metrics = grading["execution_metrics"] ?? {};
                let timeSeconds = timing["total_duration_seconds"] ?? 0;
                // timing.json フォールバック
                if (timeSeconds === 0) {
                    const timingFile = join(runPath, "timing.json");
                    if (existsSync(timingFile)) {
                        try {
                            const timingData = JSON.parse(readFileSync(timingFile, "utf-8"));
                            timeSeconds = timingData["total_duration_seconds"] ?? 0;
                        }
                        catch {
                            // 無視
                        }
                    }
                }
                const tokens = metrics["output_chars"] ?? 0;
                const rawExpectations = grading["expectations"] ?? [];
                const notesSummary = grading["user_notes_summary"] ?? {};
                const notes = [
                    ...(notesSummary["uncertainties"] ?? []),
                    ...(notesSummary["needs_review"] ?? []),
                    ...(notesSummary["workarounds"] ?? []),
                ];
                results.get(configName).push({
                    eval_id: evalId,
                    run_number: runNumber,
                    configuration: configName,
                    pass_rate: summary["pass_rate"] ?? 0,
                    passed: summary["passed"] ?? 0,
                    failed: summary["failed"] ?? 0,
                    total: summary["total"] ?? 0,
                    time_seconds: timeSeconds,
                    tokens,
                    tool_calls: metrics["total_tool_calls"] ?? 0,
                    errors: metrics["errors_encountered"] ?? 0,
                    expectations: rawExpectations,
                    notes,
                });
            }
        }
    }
    return results;
}
// =============================================================================
// 集計
// =============================================================================
/**
 * run 結果を設定ごとに集計し、delta を計算する。
 */
function aggregateResults(results) {
    const runSummary = {};
    const configs = [...results.keys()];
    for (const config of configs) {
        const runs = results.get(config) ?? [];
        if (runs.length === 0) {
            runSummary[config] = {
                pass_rate: { mean: 0, stddev: 0, min: 0, max: 0 },
                time_seconds: { mean: 0, stddev: 0, min: 0, max: 0 },
                tokens: { mean: 0, stddev: 0, min: 0, max: 0 },
            };
            continue;
        }
        runSummary[config] = {
            pass_rate: calculateStats(runs.map(r => r.pass_rate)),
            time_seconds: calculateStats(runs.map(r => r.time_seconds)),
            tokens: calculateStats(runs.map(r => r.tokens)),
        };
    }
    // delta 計算（最初の2つの設定間）
    if (configs.length >= 2) {
        const primary = runSummary[configs[0]];
        const baseline = runSummary[configs[1]];
        const deltaPr = (primary["pass_rate"]?.mean ?? 0) - (baseline["pass_rate"]?.mean ?? 0);
        const deltaTime = (primary["time_seconds"]?.mean ?? 0) - (baseline["time_seconds"]?.mean ?? 0);
        const deltaTokens = (primary["tokens"]?.mean ?? 0) - (baseline["tokens"]?.mean ?? 0);
        runSummary["delta"] = {
            pass_rate: `${deltaPr >= 0 ? "+" : ""}${deltaPr.toFixed(2)}`,
            time_seconds: `${deltaTime >= 0 ? "+" : ""}${deltaTime.toFixed(1)}`,
            tokens: `${deltaTokens >= 0 ? "+" : ""}${deltaTokens.toFixed(0)}`,
        };
    }
    return runSummary;
}
// =============================================================================
// benchmark.json 生成
// =============================================================================
export function generateBenchmark(benchmarkDir, skillName = "", skillPath = "") {
    const results = loadRunResults(benchmarkDir);
    const runSummary = aggregateResults(results);
    const runs = [];
    for (const [, entries] of results) {
        for (const entry of entries) {
            runs.push({
                eval_id: entry.eval_id,
                configuration: entry.configuration,
                run_number: entry.run_number,
                result: {
                    eval_id: entry.eval_id,
                    run_number: entry.run_number,
                    pass_rate: entry.pass_rate,
                    passed: entry.passed,
                    failed: entry.failed,
                    total: entry.total,
                    time_seconds: entry.time_seconds,
                    tokens: entry.tokens,
                    tool_calls: entry.tool_calls,
                    errors: entry.errors,
                },
                expectations: entry.expectations,
                notes: entry.notes,
            });
        }
    }
    const evalIds = [...new Set(runs.map(r => r.eval_id))].sort();
    return {
        metadata: {
            skill_name: skillName || "<skill-name>",
            skill_path: skillPath || "<path/to/skill>",
            executor_model: "<model-name>",
            analyzer_model: "<model-name>",
            timestamp: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
            evals_run: evalIds,
            runs_per_configuration: 3,
        },
        runs,
        run_summary: runSummary,
        notes: [],
    };
}
// =============================================================================
// benchmark.md 生成
// =============================================================================
/**
 * benchmark データから人間が読みやすい Markdown を生成する。
 */
export function generateMarkdown(benchmark) {
    const { metadata, run_summary } = benchmark;
    // delta を除いた設定名
    const configs = Object.keys(run_summary).filter(k => k !== "delta");
    const configA = configs[0] ?? "config_a";
    const configB = configs[1] ?? "config_b";
    const labelA = configA.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    const labelB = configB.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    const summaryA = run_summary[configA];
    const summaryB = run_summary[configB];
    const delta = run_summary["delta"];
    const aPr = summaryA?.["pass_rate"] ?? { mean: 0, stddev: 0 };
    const bPr = summaryB?.["pass_rate"] ?? { mean: 0, stddev: 0 };
    const aTime = summaryA?.["time_seconds"] ?? { mean: 0, stddev: 0 };
    const bTime = summaryB?.["time_seconds"] ?? { mean: 0, stddev: 0 };
    const aTokens = summaryA?.["tokens"] ?? { mean: 0, stddev: 0 };
    const bTokens = summaryB?.["tokens"] ?? { mean: 0, stddev: 0 };
    const lines = [
        `# Skill Benchmark: ${metadata.skill_name}`,
        "",
        `**Model**: ${metadata.executor_model}`,
        `**Date**: ${metadata.timestamp}`,
        `**Evals**: ${metadata.evals_run.join(", ")} (${metadata.runs_per_configuration} runs each per configuration)`,
        "",
        "## Summary",
        "",
        `| Metric | ${labelA} | ${labelB} | Delta |`,
        "|--------|------------|---------------|-------|",
        `| Pass Rate | ${(aPr.mean * 100).toFixed(0)}% ± ${(aPr.stddev * 100).toFixed(0)}% | ${(bPr.mean * 100).toFixed(0)}% ± ${(bPr.stddev * 100).toFixed(0)}% | ${delta?.["pass_rate"] ?? "—"} |`,
        `| Time | ${aTime.mean.toFixed(1)}s ± ${aTime.stddev.toFixed(1)}s | ${bTime.mean.toFixed(1)}s ± ${bTime.stddev.toFixed(1)}s | ${delta?.["time_seconds"] ?? "—"}s |`,
        `| Tokens | ${aTokens.mean.toFixed(0)} ± ${aTokens.stddev.toFixed(0)} | ${bTokens.mean.toFixed(0)} ± ${bTokens.stddev.toFixed(0)} | ${delta?.["tokens"] ?? "—"} |`,
    ];
    if (benchmark.notes.length > 0) {
        lines.push("", "## Notes", "");
        for (const note of benchmark.notes) {
            lines.push(`- ${note}`);
        }
    }
    return lines.join("\n");
}
export function cmdSkillBenchmark(options) {
    const { benchmarkDir: rawBenchmarkDir, skillName = "", skillPath = "", output, verbose, } = options;
    const benchmarkDir = resolve(rawBenchmarkDir);
    if (!existsSync(benchmarkDir)) {
        process.stderr.write(`Directory not found: ${benchmarkDir}\n`);
        return 1;
    }
    if (verbose) {
        process.stderr.write(`Aggregating benchmark: ${benchmarkDir}\n`);
    }
    // benchmark 生成
    const benchmark = generateBenchmark(benchmarkDir, skillName, skillPath);
    // 出力先の決定
    const outputJson = output ? resolve(output) : join(benchmarkDir, "benchmark.json");
    const outputMd = outputJson.replace(/\.json$/, ".md");
    // ディレクトリ作成
    mkdirSync(join(outputJson, ".."), { recursive: true });
    // benchmark.json 書き込み
    writeFileSync(outputJson, JSON.stringify(benchmark, null, 2), "utf-8");
    process.stdout.write(`Generated: ${outputJson}\n`);
    // benchmark.md 書き込み
    const markdown = generateMarkdown(benchmark);
    writeFileSync(outputMd, markdown, "utf-8");
    process.stdout.write(`Generated: ${outputMd}\n`);
    // サマリー表示
    const configs = Object.keys(benchmark.run_summary).filter(k => k !== "delta");
    const delta = benchmark.run_summary["delta"];
    process.stdout.write("\nSummary:\n");
    for (const config of configs) {
        const summary = benchmark.run_summary[config];
        const pr = summary?.["pass_rate"]?.mean ?? 0;
        const label = config.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        process.stdout.write(`  ${label}: ${(pr * 100).toFixed(1)}% pass rate\n`);
    }
    if (delta) {
        process.stdout.write(`  Delta: ${delta["pass_rate"] ?? "—"}\n`);
    }
    return 0;
}
//# sourceMappingURL=benchmark.js.map