/**
 * skill optimize コマンド
 *
 * eval + 改善ループを実行し、スキルの説明を最適化する。
 * claude -p を使って説明の改善を生成する（SDK 不使用）。
 *
 * Derived from: https://github.com/anthropics/skills/tree/main/skills/skill-creator
 * Original: scripts/run_loop.py, scripts/improve_description.py
 * Original licensed under Apache License 2.0 (Copyright 2025 Anthropic, PBC).
 * Modified for shirokuma-docs: ported to TypeScript with CLI integration.
 *   - anthropic SDK → claude -p による説明改善
 *   - train/test 層化分割（60/40）
 *   - ログ保存対応
 *   - HTML レポートは generate_report の TypeScript 版（optimize-report.ts）で生成
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { spawn } from "node:child_process";
import { EVAL_DEFAULTS, OPTIMIZE_DEFAULTS, formatTimestamp, getCleanEnv, findProjectRoot } from "./types.js";
import { runEval } from "./eval.js";
import { parseSkillMd } from "./skill-md-parser.js";
// =============================================================================
// train/test 分割
// =============================================================================
/**
 * eval セットを train と test に層化分割する。
 * should_trigger ごとに分けてからシャッフルし、指定割合で分割する。
 */
function splitEvalSet(evalSet, holdout, seed = 42) {
    // シード付きシャッフル（簡易実装: Linear Congruential Generator）
    const seededRandom = () => {
        let s = seed;
        return () => {
            s = (s * 1664525 + 1013904223) & 0xffffffff;
            return (s >>> 0) / 0xffffffff;
        };
    };
    const shuffle = (arr) => {
        const result = [...arr];
        const rand = seededRandom();
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    };
    const trigger = shuffle(evalSet.filter(e => e.should_trigger));
    const noTrigger = shuffle(evalSet.filter(e => !e.should_trigger));
    const nTriggerTest = Math.max(1, Math.floor(trigger.length * holdout));
    const nNoTriggerTest = Math.max(1, Math.floor(noTrigger.length * holdout));
    const testSet = [...trigger.slice(0, nTriggerTest), ...noTrigger.slice(0, nNoTriggerTest)];
    const trainSet = [...trigger.slice(nTriggerTest), ...noTrigger.slice(nNoTriggerTest)];
    return [trainSet, testSet];
}
// =============================================================================
// 説明の改善（claude -p 経由）
// =============================================================================
/**
 * eval 結果に基づいて説明を改善するプロンプトを構築する。
 */
function buildImprovePrompt(skillName, skillContent, currentDescription, evalResults, history) {
    const failedTriggers = evalResults.results.filter(r => r.should_trigger && !r.pass);
    const falseTriggers = evalResults.results.filter(r => !r.should_trigger && !r.pass);
    const trainScore = `${evalResults.summary.passed}/${evalResults.summary.total}`;
    let prompt = `You are optimizing a skill description for a Claude Code skill called "${skillName}". `;
    prompt += `A "skill" is sort of like a prompt, but with progressive disclosure -- there's a title and description that Claude sees when deciding whether to use the skill, and then if it does use the skill, it reads the .md file which has lots more details.\n\n`;
    prompt += `The description appears in Claude's "available_skills" list. When a user sends a query, Claude decides whether to invoke the skill based solely on the title and on this description. Your goal is to write a description that triggers for relevant queries, and doesn't trigger for irrelevant ones.\n\n`;
    prompt += `Here's the current description:\n<current_description>\n"${currentDescription}"\n</current_description>\n\n`;
    prompt += `Current scores (Train: ${trainScore}):\n<scores_summary>\n`;
    if (failedTriggers.length > 0) {
        prompt += "FAILED TO TRIGGER (should have triggered but didn't):\n";
        for (const r of failedTriggers) {
            prompt += `  - "${r.query}" (triggered ${r.triggers}/${r.runs} times)\n`;
        }
        prompt += "\n";
    }
    if (falseTriggers.length > 0) {
        prompt += "FALSE TRIGGERS (triggered but shouldn't have):\n";
        for (const r of falseTriggers) {
            prompt += `  - "${r.query}" (triggered ${r.triggers}/${r.runs} times)\n`;
        }
        prompt += "\n";
    }
    if (history.length > 0) {
        prompt += "PREVIOUS ATTEMPTS (do NOT repeat these — try something structurally different):\n\n";
        for (const h of history) {
            const trainS = `${h.train_passed}/${h.train_total}`;
            prompt += `<attempt train=${trainS}>\n`;
            prompt += `Description: "${h.description}"\n`;
            if (h.results.length > 0) {
                prompt += "Train results:\n";
                for (const r of h.results) {
                    const status = r.pass ? "PASS" : "FAIL";
                    prompt += `  [${status}] "${r.query.slice(0, 80)}" (triggered ${r.triggers}/${r.runs})\n`;
                }
            }
            prompt += "</attempt>\n\n";
        }
    }
    prompt += `</scores_summary>\n\n`;
    prompt += `Skill content (for context on what the skill does):\n<skill_content>\n${skillContent}\n</skill_content>\n\n`;
    prompt += `Based on the failures, write a new and improved description. `;
    prompt += `Generalize from failures to broader categories of user intent. Do NOT produce an ever-expanding list of specific queries.\n\n`;
    prompt += `Your description should not be more than about 100-200 words.\n\n`;
    prompt += `Tips:\n`;
    prompt += `- Phrase in the imperative -- "Use this skill for" rather than "this skill does"\n`;
    prompt += `- Focus on user's intent, not implementation details\n`;
    prompt += `- Make it distinctive and immediately recognizable\n\n`;
    prompt += `Please respond with only the new description text in <new_description> tags, nothing else.`;
    return prompt;
}
/**
 * claude -p を使って説明を改善する。
 * モデルの応答から <new_description> タグを抽出する。
 */
async function improveDescription(skillName, skillContent, currentDescription, evalResults, history, model, logDir, iteration) {
    const prompt = buildImprovePrompt(skillName, skillContent, currentDescription, evalResults, history);
    const env = getCleanEnv();
    return new Promise((resolvePromise, rejectPromise) => {
        const proc = spawn("claude", ["-p", prompt, "--model", model], {
            env,
            stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        proc.stdout.on("data", (chunk) => {
            stdout += chunk.toString("utf-8");
        });
        proc.stderr.on("data", (chunk) => {
            stderr += chunk.toString("utf-8");
        });
        proc.on("close", (code) => {
            if (code !== 0) {
                rejectPromise(new Error(`claude -p exited with code ${code}: ${stderr}`));
                return;
            }
            // <new_description> タグを抽出
            const match = stdout.match(/<new_description>([\s\S]*?)<\/new_description>/);
            let description = match
                ? match[1].trim().replace(/^["']|["']$/g, "")
                : stdout.trim().replace(/^["']|["']$/g, "");
            // 1024 文字を超える場合は切り詰め
            if (description.length > 1024) {
                description = description.slice(0, 1021) + "...";
            }
            // ログ保存
            if (logDir) {
                mkdirSync(logDir, { recursive: true });
                const logFile = join(logDir, `improve_iter_${iteration ?? "unknown"}.json`);
                writeFileSync(logFile, JSON.stringify({ prompt, response: stdout, parsed_description: description }, null, 2), "utf-8");
            }
            resolvePromise(description);
        });
        proc.on("error", rejectPromise);
    });
}
// =============================================================================
// optimize ループ
// =============================================================================
export async function runOptimizeLoop(evalSet, skillPath, descriptionOverride, numWorkers, timeout, maxIterations, runsPerQuery, triggerThreshold, holdout, model, verbose, logDir) {
    const { name, description: originalDescription, content } = parseSkillMd(skillPath);
    let currentDescription = descriptionOverride ?? originalDescription;
    // train/test 分割
    let trainSet;
    let testSet;
    if (holdout > 0) {
        [trainSet, testSet] = splitEvalSet(evalSet, holdout);
        if (verbose) {
            process.stderr.write(`Split: ${trainSet.length} train, ${testSet.length} test (holdout=${holdout})\n`);
        }
    }
    else {
        trainSet = evalSet;
        testSet = [];
    }
    // プロジェクトルート
    const projectRoot = findProjectRoot();
    const history = [];
    let exitReason = "unknown";
    for (let iteration = 1; iteration <= maxIterations; iteration++) {
        if (verbose) {
            process.stderr.write(`\n${"=".repeat(60)}\n`);
            process.stderr.write(`Iteration ${iteration}/${maxIterations}\n`);
            process.stderr.write(`Description: ${currentDescription}\n`);
        }
        // train + test を一括実行
        const allQueries = [...trainSet, ...testSet];
        const allResults = await runEval(allQueries, name, currentDescription, numWorkers, timeout, projectRoot, runsPerQuery, triggerThreshold, model);
        // train/test に分割
        const trainQuerySet = new Set(trainSet.map(q => q.query));
        const trainResultList = allResults.results.filter(r => trainQuerySet.has(r.query));
        const testResultList = allResults.results.filter(r => !trainQuerySet.has(r.query));
        const trainPassed = trainResultList.filter(r => r.pass).length;
        const trainTotal = trainResultList.length;
        const testPassed = testResultList.length > 0 ? testResultList.filter(r => r.pass).length : null;
        const testTotal = testResultList.length > 0 ? testResultList.length : null;
        history.push({
            iteration,
            description: currentDescription,
            train_passed: trainPassed,
            train_failed: trainTotal - trainPassed,
            train_total: trainTotal,
            train_results: trainResultList,
            test_passed: testPassed,
            test_failed: testPassed !== null && testTotal !== null ? testTotal - testPassed : null,
            test_total: testTotal,
            test_results: testResultList.length > 0 ? testResultList : null,
            // 後方互換
            passed: trainPassed,
            failed: trainTotal - trainPassed,
            total: trainTotal,
            results: trainResultList,
        });
        if (verbose) {
            process.stderr.write(`Train: ${trainPassed}/${trainTotal}\n`);
            if (testPassed !== null && testTotal !== null) {
                process.stderr.write(`Test:  ${testPassed}/${testTotal}\n`);
            }
        }
        if (trainTotal - trainPassed === 0) {
            exitReason = `all_passed (iteration ${iteration})`;
            if (verbose) {
                process.stderr.write(`\nAll train queries passed on iteration ${iteration}!\n`);
            }
            break;
        }
        if (iteration === maxIterations) {
            exitReason = `max_iterations (${maxIterations})`;
            if (verbose) {
                process.stderr.write(`\nMax iterations reached (${maxIterations}).\n`);
            }
            break;
        }
        // 説明を改善
        if (verbose) {
            process.stderr.write(`\nImproving description...\n`);
        }
        const trainResults = {
            results: trainResultList,
            summary: { passed: trainPassed, failed: trainTotal - trainPassed, total: trainTotal },
        };
        try {
            currentDescription = await improveDescription(name, content, currentDescription, trainResults, history, model, logDir, iteration);
            if (verbose) {
                process.stderr.write(`Proposed: ${currentDescription}\n`);
            }
        }
        catch (e) {
            process.stderr.write(`Warning: 説明の改善に失敗: ${e instanceof Error ? e.message : String(e)}\n`);
            break;
        }
    }
    // ベストイテレーションの決定
    const best = testSet.length > 0
        ? history.reduce((a, b) => ((b.test_passed ?? 0) > (a.test_passed ?? 0) ? b : a))
        : history.reduce((a, b) => (b.train_passed > a.train_passed ? b : a));
    const bestScore = testSet.length > 0
        ? `${best.test_passed}/${best.test_total}`
        : `${best.train_passed}/${best.train_total}`;
    if (verbose) {
        process.stderr.write(`\nExit reason: ${exitReason}\n`);
        process.stderr.write(`Best score: ${bestScore} (iteration ${best.iteration})\n`);
    }
    return {
        exit_reason: exitReason,
        original_description: originalDescription,
        best_description: best.description,
        best_score: bestScore,
        best_train_score: `${best.train_passed}/${best.train_total}`,
        best_test_score: testSet.length > 0 ? `${best.test_passed}/${best.test_total}` : null,
        final_description: currentDescription,
        iterations_run: history.length,
        holdout,
        train_size: trainSet.length,
        test_size: testSet.length,
        history,
    };
}
export async function cmdSkillOptimize(options) {
    const { skillPath: rawSkillPath, evalSet: evalSetPath, description: descriptionOverride, numWorkers = EVAL_DEFAULTS.NUM_WORKERS, timeout = EVAL_DEFAULTS.TIMEOUT, maxIterations = OPTIMIZE_DEFAULTS.MAX_ITERATIONS, runsPerQuery = EVAL_DEFAULTS.RUNS_PER_QUERY, triggerThreshold = EVAL_DEFAULTS.TRIGGER_THRESHOLD, holdout = OPTIMIZE_DEFAULTS.HOLDOUT, model = OPTIMIZE_DEFAULTS.MODEL, resultsDir, verbose, project, } = options;
    const skillPath = resolve(rawSkillPath);
    if (!existsSync(join(skillPath, "SKILL.md"))) {
        process.stderr.write(`Error: No SKILL.md found at ${skillPath}\n`);
        return 1;
    }
    if (!evalSetPath) {
        process.stderr.write("Error: --eval-set が必要です。\n");
        return 1;
    }
    if (!existsSync(evalSetPath)) {
        process.stderr.write(`Error: eval セットファイルが見つかりません: ${evalSetPath}\n`);
        return 1;
    }
    let evalSet;
    try {
        evalSet = JSON.parse(readFileSync(evalSetPath, "utf-8"));
    }
    catch (e) {
        process.stderr.write(`Error: eval セット JSON のパースに失敗: ${e instanceof Error ? e.message : String(e)}\n`);
        return 1;
    }
    // 結果保存ディレクトリ
    let outputDir;
    let logDir;
    if (resultsDir) {
        const timestamp = formatTimestamp();
        outputDir = join(resolve(resultsDir), timestamp);
        mkdirSync(outputDir, { recursive: true });
        logDir = join(outputDir, "logs");
    }
    const result = await runOptimizeLoop(evalSet, skillPath, descriptionOverride, numWorkers, timeout, maxIterations, runsPerQuery, triggerThreshold, holdout, model, verbose ?? false, logDir);
    const json = JSON.stringify(result, null, 2);
    process.stdout.write(json + "\n");
    if (outputDir) {
        writeFileSync(join(outputDir, "results.json"), json, "utf-8");
        process.stdout.write(`Results saved to: ${outputDir}\n`);
    }
    // .shirokuma/evals/{skill-name}/ に自動保存
    const skillName = basename(skillPath);
    const evalsDir = join(project, ".shirokuma", "evals", skillName);
    mkdirSync(evalsDir, { recursive: true });
    const timestamp = formatTimestamp();
    writeFileSync(join(evalsDir, `optimize_${timestamp}.json`), json, "utf-8");
    return 0;
}
//# sourceMappingURL=optimize.js.map