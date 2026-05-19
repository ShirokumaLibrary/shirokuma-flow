/**
 * hooks evaluate-stop - Evaluate chain completion on Stop hook
 *
 * stdin から Stop hook JSON を読み取り、未完了タスクを 2 層で評価する。
 * - stop_hook_active === true → 即座に return（無限ループ防止）
 * - Layer 1: 未完了チェーンステップあり → block
 * - Layer 2: 未完了 Todo あり（チェーン外含む）→ block
 * - なし → 何も出力しない（停止を許可）
 * - エラー時: fail-open
 */
import { readStdin, expandHomePath, findLatestTasks, findIncompleteChainSteps, findAllIncompleteTodos, } from "./helpers.js";
/**
 * `hooks evaluate-stop` コマンドのメインハンドラ
 */
export async function hooksEvaluateStopCommand() {
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
        const transcriptPath = parsed.transcript_path;
        if (!transcriptPath) {
            return;
        }
        // ~ をホームディレクトリに展開
        const expandedPath = expandHomePath(transcriptPath);
        const todos = findLatestTasks(expandedPath);
        if (!todos) {
            return;
        }
        // Layer 1: チェーンステップ検出（具体的な誘導メッセージ）
        const incompleteSteps = findIncompleteChainSteps(todos);
        if (incompleteSteps.length > 0) {
            const output = {
                decision: "block",
                reason: `Chain steps are incomplete: ${incompleteSteps.join(", ")}. Proceed to the next step.`,
            };
            process.stdout.write(JSON.stringify(output));
            return;
        }
        // Layer 2: 汎用 Todo 検出（全未完了タスク）
        const incompleteTodos = findAllIncompleteTodos(todos);
        if (incompleteTodos.length > 0) {
            const output = {
                decision: "block",
                reason: `Tasks are incomplete: ${incompleteTodos.join(", ")}. Complete remaining tasks before stopping.`,
            };
            process.stdout.write(JSON.stringify(output));
            return;
        }
    }
    catch {
        // fail-open
    }
}
//# sourceMappingURL=evaluate-stop.js.map