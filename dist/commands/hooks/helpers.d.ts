/**
 * hooks command shared types and utilities
 */
export interface TodoItem {
    content: string;
    status: string;
    activeForm: string;
}
export interface ToolUseBlock {
    type: "tool_use";
    id?: string;
    name?: string;
    input?: {
        /** TodoWrite: full snapshot */
        todos?: TodoItem[];
        /** TaskCreate: task title */
        title?: string;
        /** TaskCreate initial status / TaskUpdate new status */
        status?: string;
        /** TaskUpdate: task id to update */
        id?: string;
    };
}
export interface ToolResultBlock {
    type: "tool_result";
    tool_use_id?: string;
    content?: string | Array<{
        type: string;
        text?: string;
    }>;
}
export type MessageContentBlock = ToolUseBlock | ToolResultBlock | {
    type: string;
};
export interface TranscriptEntry {
    message?: {
        role?: string;
        content?: MessageContentBlock[];
    };
}
export interface StopHookBlockOutput {
    decision: "block";
    reason: string;
}
/**
 * TodoItem がチェーンステップかどうかを判定する
 */
export declare function isChainStep(item: TodoItem): boolean;
/**
 * transcript JSONL から最新のタスクリストを構築して返す
 *
 * 優先順位:
 * 1. TaskList の tool_result（最も正確な現在状態）
 * 2. TaskCreate + TaskUpdate の積み上げ（TaskList がない場合）
 * 3. 旧 TodoWrite の snapshot（後方互換性）
 *
 * Tasks API の状態は `~/.claude/tasks/` に永続化されており、
 * transcript には TaskCreate/TaskUpdate の呼び出しが記録される。
 * TaskUpdate の適用により現在状態を再構築する。
 *
 * @returns 現在のタスクリスト、または見つからない場合 null
 */
export declare function findLatestTasks(transcriptPath: string): TodoItem[] | null;
/**
 * 後方互換エイリアス
 * @deprecated findLatestTasks を使用してください
 */
export declare const findLatestTodoWrite: typeof findLatestTasks;
/**
 * タスクリストの未完了チェーンステップを検出する
 *
 * @returns 未完了チェーンステップの content リスト
 */
export declare function findIncompleteChainSteps(todos: TodoItem[]): string[];
/**
 * タスクリストの全未完了タスクを検出する（チェーンステップかどうかに関わらず）
 *
 * Layer 2: チェーンステップ検出（Layer 1）に該当しない pending/in_progress タスクを検出する。
 *
 * @returns 未完了タスクの content リスト
 */
export declare function findAllIncompleteTodos(todos: TodoItem[]): string[];
/**
 * ~ をホームディレクトリに展開する
 */
export declare function expandHomePath(p: string): string;
/**
 * stdin から全入力を読み取る
 */
export declare function readStdin(): Promise<string>;
//# sourceMappingURL=helpers.d.ts.map