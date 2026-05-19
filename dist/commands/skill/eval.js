/**
 * skill eval コマンド
 *
 * スキルの説明が適切なクエリでトリガーされるかを eval セットで検証する。
 * claude -p を child_process.spawn で呼び出し、stream-json 形式で結果を解析する。
 *
 * Derived from: https://github.com/anthropics/skills/tree/main/skills/skill-creator
 * Original: scripts/run_eval.py
 * Original licensed under Apache License 2.0 (Copyright 2025 Anthropic, PBC).
 * Modified for shirokuma-docs: ported to TypeScript with CLI integration.
 *   - Python ProcessPoolExecutor → Node.js Promise.all による並列化
 *   - claude -p を child_process.spawn で呼び出し（SDK 不使用）
 *   - CLAUDECODE 環境変数を除去してネスト呼び出しに対応
 *   - eval 結果を .shirokuma/evals/{skill-name}/ に JSON 保存
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { EVAL_DEFAULTS, formatTimestamp, getCleanEnv, findProjectRoot } from "./types.js";
import { parseSkillMd } from "./skill-md-parser.js";
// =============================================================================
// 単一クエリの eval 実行
// =============================================================================
/**
 * 1つのクエリを実行し、スキルがトリガーされたかどうかを返す。
 *
 * .claude/commands/ に一時コマンドファイルを作成し、claude -p を実行して
 * stream-json 形式の出力を解析する。
 */
async function runSingleQuery(query, skillName, skillDescription, timeout, projectRoot, env, model) {
    const uniqueId = randomBytes(4).toString("hex");
    const cleanName = `${skillName}-skill-${uniqueId}`;
    const commandsDir = join(projectRoot, ".claude", "commands");
    const commandFile = join(commandsDir, `${cleanName}.md`);
    // コマンドファイルの作成
    mkdirSync(commandsDir, { recursive: true });
    const indentedDesc = skillDescription.split("\n").join("\n  ");
    const commandContent = [
        "---",
        "description: |",
        `  ${indentedDesc}`,
        "---",
        "",
        `# ${skillName}`,
        "",
        `This skill handles: ${skillDescription}`,
    ].join("\n");
    writeFileSync(commandFile, commandContent, "utf-8");
    try {
        return await new Promise((resolvePromise) => {
            const cmd = [
                "-p", query,
                "--output-format", "stream-json",
                "--verbose",
                "--include-partial-messages",
            ];
            if (model) {
                cmd.push("--model", model);
            }
            const proc = spawn("claude", cmd, {
                cwd: projectRoot,
                env,
                stdio: ["ignore", "pipe", "ignore"],
            });
            let buffer = "";
            let settled = false;
            let pendingToolName = null;
            let accumulatedJson = "";
            const settle = (result) => {
                if (settled)
                    return;
                settled = true;
                proc.kill();
                resolvePromise(result);
            };
            // タイムアウト設定
            const timer = setTimeout(() => settle(false), timeout * 1000);
            proc.stdout.on("data", (chunk) => {
                buffer += chunk.toString("utf-8");
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed)
                        continue;
                    let event;
                    try {
                        event = JSON.parse(trimmed);
                    }
                    catch {
                        continue;
                    }
                    const eventType = event["type"];
                    // ストリームイベントの早期検出
                    if (eventType === "stream_event") {
                        const se = event["event"];
                        const seType = se?.["type"];
                        if (seType === "content_block_start") {
                            const cb = se?.["content_block"];
                            if (cb?.["type"] === "tool_use") {
                                const toolName = cb["name"];
                                if (toolName === "Skill" || toolName === "Read") {
                                    pendingToolName = toolName;
                                    accumulatedJson = "";
                                }
                                else {
                                    clearTimeout(timer);
                                    settle(false);
                                    return;
                                }
                            }
                        }
                        else if (seType === "content_block_delta" && pendingToolName) {
                            const delta = se?.["delta"];
                            if (delta?.["type"] === "input_json_delta") {
                                accumulatedJson += delta["partial_json"] ?? "";
                                if (accumulatedJson.includes(cleanName)) {
                                    clearTimeout(timer);
                                    settle(true);
                                    return;
                                }
                            }
                        }
                        else if (seType === "content_block_stop" || seType === "message_stop") {
                            if (pendingToolName) {
                                clearTimeout(timer);
                                settle(accumulatedJson.includes(cleanName));
                                return;
                            }
                            if (seType === "message_stop") {
                                clearTimeout(timer);
                                settle(false);
                                return;
                            }
                        }
                    }
                    // フォールバック: フルアシスタントメッセージ
                    if (eventType === "assistant") {
                        const message = event["message"];
                        const content = message?.["content"];
                        let triggered = false;
                        if (content) {
                            for (const item of content) {
                                const ci = item;
                                if (ci["type"] !== "tool_use")
                                    continue;
                                const toolName = ci["name"];
                                const toolInput = ci["input"];
                                if (toolName === "Skill" && toolInput?.["skill"]?.includes(cleanName)) {
                                    triggered = true;
                                }
                                else if (toolName === "Read" && toolInput?.["file_path"]?.includes(cleanName)) {
                                    triggered = true;
                                }
                            }
                        }
                        clearTimeout(timer);
                        settle(triggered);
                        return;
                    }
                    if (eventType === "result") {
                        clearTimeout(timer);
                        settle(false);
                        return;
                    }
                }
            });
            proc.on("close", () => {
                clearTimeout(timer);
                settle(false);
            });
            proc.on("error", () => {
                clearTimeout(timer);
                settle(false);
            });
        });
    }
    finally {
        try {
            unlinkSync(commandFile);
        }
        catch {
            // クリーンアップ失敗は無視
        }
    }
}
// =============================================================================
// eval セット全体の実行
// =============================================================================
/**
 * eval セット全体を並列実行して結果を返す。
 */
export async function runEval(evalSet, skillName, description, numWorkers, timeout, projectRoot, runsPerQuery, triggerThreshold, model) {
    // クリーン環境変数を1回だけ生成して全ワーカーで共有
    const cleanEnv = getCleanEnv();
    // 並列実行: numWorkers の同時実行数を制限
    const allTasks = [];
    for (const item of evalSet) {
        for (let i = 0; i < runsPerQuery; i++) {
            allTasks.push({ item, runIdx: i });
        }
    }
    const queryTriggers = new Map();
    const queryItems = new Map();
    // セマフォ的な並列制御
    let active = 0;
    let taskIdx = 0;
    await new Promise((resolveAll) => {
        const runNext = () => {
            while (active < numWorkers && taskIdx < allTasks.length) {
                const { item } = allTasks[taskIdx];
                taskIdx++;
                active++;
                const { query } = item;
                queryItems.set(query, item);
                if (!queryTriggers.has(query)) {
                    queryTriggers.set(query, []);
                }
                runSingleQuery(query, skillName, description, timeout, projectRoot, cleanEnv, model)
                    .then((triggered) => {
                    queryTriggers.get(query)?.push(triggered);
                })
                    .catch(() => {
                    queryTriggers.get(query)?.push(false);
                })
                    .finally(() => {
                    active--;
                    if (taskIdx < allTasks.length) {
                        runNext();
                    }
                    else if (active === 0) {
                        resolveAll();
                    }
                });
            }
            if (taskIdx >= allTasks.length && active === 0) {
                resolveAll();
            }
        };
        runNext();
    });
    const results = [];
    for (const [query, triggers] of queryTriggers) {
        const item = queryItems.get(query);
        const triggerRate = triggers.length > 0 ? triggers.filter(Boolean).length / triggers.length : 0;
        const shouldTrigger = item.should_trigger;
        const pass = shouldTrigger
            ? triggerRate >= triggerThreshold
            : triggerRate < triggerThreshold;
        results.push({
            query,
            should_trigger: shouldTrigger,
            trigger_rate: triggerRate,
            triggers: triggers.filter(Boolean).length,
            runs: triggers.length,
            pass,
        });
    }
    const passed = results.filter(r => r.pass).length;
    const total = results.length;
    return {
        skill_name: skillName,
        description,
        results,
        summary: { total, passed, failed: total - passed },
    };
}
export async function cmdSkillEval(options) {
    const { skillPath: rawSkillPath, evalSet: evalSetPath, description: descriptionOverride, numWorkers = EVAL_DEFAULTS.NUM_WORKERS, timeout = EVAL_DEFAULTS.TIMEOUT, runsPerQuery = EVAL_DEFAULTS.RUNS_PER_QUERY, triggerThreshold = EVAL_DEFAULTS.TRIGGER_THRESHOLD, model, output, verbose, project, } = options;
    const skillPath = resolve(rawSkillPath);
    // SKILL.md の存在確認
    if (!existsSync(join(skillPath, "SKILL.md"))) {
        process.stderr.write(`Error: No SKILL.md found at ${skillPath}\n`);
        return 1;
    }
    // eval セットの読み込み
    if (!evalSetPath) {
        process.stderr.write("Error: --eval-set が必要です。eval セット JSON ファイルを指定してください。\n");
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
    // SKILL.md のパース
    const { name, description: originalDescription } = parseSkillMd(skillPath);
    const description = descriptionOverride ?? originalDescription;
    const projectRoot = findProjectRoot();
    if (verbose) {
        process.stderr.write(`Evaluating: ${description}\n`);
    }
    // eval 実行
    const result = await runEval(evalSet, name, description, numWorkers, timeout, projectRoot, runsPerQuery, triggerThreshold, model);
    if (verbose) {
        const { passed, total } = result.summary;
        process.stderr.write(`Results: ${passed}/${total} passed\n`);
        for (const r of result.results) {
            const status = r.pass ? "PASS" : "FAIL";
            process.stderr.write(`  [${status}] rate=${r.triggers}/${r.runs} expected=${r.should_trigger}: ${r.query.slice(0, 70)}\n`);
        }
    }
    const json = JSON.stringify(result, null, 2);
    // 出力先の決定
    if (!output || output === "-") {
        process.stdout.write(json + "\n");
    }
    else {
        writeFileSync(resolve(output), json, "utf-8");
        process.stdout.write(`Results saved to: ${output}\n`);
    }
    // .shirokuma/evals/{skill-name}/ に自動保存
    const skillName = basename(skillPath);
    const evalsDir = join(project, ".shirokuma", "evals", skillName);
    mkdirSync(evalsDir, { recursive: true });
    const autoSavePath = join(evalsDir, `eval_${formatTimestamp()}.json`);
    writeFileSync(autoSavePath, json, "utf-8");
    if (verbose) {
        process.stderr.write(`Auto-saved to: ${autoSavePath}\n`);
    }
    return result.summary.failed > 0 ? 1 : 0;
}
//# sourceMappingURL=eval.js.map