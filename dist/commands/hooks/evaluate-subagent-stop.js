/**
 * hooks evaluate-subagent-stop - Evaluate chain continuation on SubagentStop hook
 *
 * stdin から SubagentStop hook JSON を読み取り、サブエージェント完了後の
 * チェーン継続を評価する。
 */
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { readStdin, expandHomePath, findLatestTasks, findIncompleteChainSteps, } from "./helpers.js";
/**
 * SubagentStop 入力からメインエージェントの transcript パスを解決する
 *
 * 複数のフォールバック戦略で transcript パスを探索する:
 * 1. transcript_path フィールド（直接提供されている場合）
 * 2. agent_transcript_path から親ディレクトリを辿り、セッション transcript を探す
 * 3. session_id から標準的なセッションディレクトリを探す
 *
 * @returns 解決された transcript パス、または見つからない場合 null
 */
export function resolveMainTranscriptPath(input) {
    // Strategy 1: transcript_path が直接提供されている場合
    if (input.transcript_path) {
        return expandHomePath(input.transcript_path);
    }
    // Strategy 2: agent_transcript_path から親ディレクトリを辿る
    if (input.agent_transcript_path) {
        const expanded = expandHomePath(input.agent_transcript_path);
        const parentDir = dirname(expanded);
        const grandParentDir = dirname(parentDir);
        const candidates = [
            join(parentDir, "transcript.jsonl"),
            join(grandParentDir, "transcript.jsonl"),
        ];
        for (const candidate of candidates) {
            if (candidate !== expanded && existsSync(candidate)) {
                return candidate;
            }
        }
    }
    // Strategy 3: session_id から標準パスを探す
    if (input.session_id) {
        const home = homedir();
        const candidates = [
            join(home, ".claude", "sessions", `${input.session_id}.jsonl`),
            join(home, ".claude", "sessions", input.session_id, "transcript.jsonl"),
        ];
        for (const candidate of candidates) {
            if (existsSync(candidate)) {
                return candidate;
            }
        }
    }
    return null;
}
/**
 * `hooks evaluate-subagent-stop` コマンドのメインハンドラ
 */
export async function hooksEvaluateSubagentStopCommand() {
    try {
        const input = await readStdin();
        if (!input || input.trim() === "") {
            return;
        }
        let parsed;
        try {
            parsed = JSON.parse(input);
        }
        catch {
            return;
        }
        // 無限ループ防止（最重要）
        if (parsed.stop_hook_active === true) {
            return;
        }
        // メインエージェントの transcript パスを解決
        const transcriptPath = resolveMainTranscriptPath(parsed);
        if (!transcriptPath) {
            return;
        }
        const todos = findLatestTasks(transcriptPath);
        if (!todos) {
            return;
        }
        // チェーンステップ検出（Layer 1 相当 — サブエージェント完了時は chain steps のみ評価）
        const incompleteSteps = findIncompleteChainSteps(todos);
        if (incompleteSteps.length > 0) {
            const output = {
                decision: "block",
                reason: `Subagent completed but chain steps remain: ${incompleteSteps.join(", ")}. Continue to the next chain step.`,
            };
            process.stdout.write(JSON.stringify(output));
            return;
        }
    }
    catch {
        // fail-open
    }
}
//# sourceMappingURL=evaluate-subagent-stop.js.map