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
/**
 * `hooks evaluate-stop` コマンドのメインハンドラ
 */
export declare function hooksEvaluateStopCommand(): Promise<void>;
//# sourceMappingURL=evaluate-stop.d.ts.map