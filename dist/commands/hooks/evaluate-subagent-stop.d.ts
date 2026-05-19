/**
 * hooks evaluate-subagent-stop - Evaluate chain continuation on SubagentStop hook
 *
 * stdin から SubagentStop hook JSON を読み取り、サブエージェント完了後の
 * チェーン継続を評価する。
 */
interface SubagentStopHookInput {
    agent_id?: string;
    agent_type?: string;
    agent_transcript_path?: string;
    stop_hook_active?: boolean;
    /** メインエージェントの transcript パス（SubagentStop 入力に含まれる場合） */
    transcript_path?: string;
    session_id?: string;
}
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
export declare function resolveMainTranscriptPath(input: SubagentStopHookInput): string | null;
/**
 * `hooks evaluate-subagent-stop` コマンドのメインハンドラ
 */
export declare function hooksEvaluateSubagentStopCommand(): Promise<void>;
export {};
//# sourceMappingURL=evaluate-subagent-stop.d.ts.map