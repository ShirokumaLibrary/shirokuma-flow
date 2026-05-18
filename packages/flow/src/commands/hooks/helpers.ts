/**
 * hooks command shared types and utilities
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";

// ========================================
// Types
// ========================================

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
  content?: string | Array<{ type: string; text?: string }>;
}

export type MessageContentBlock = ToolUseBlock | ToolResultBlock | { type: string };

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

// ========================================
// Chain Step Detection
// ========================================

/**
 * チェーンステップを検出するキーワードパターン
 *
 * EN/JA 両方のキーワードとスキル名（言語非依存）を含む。
 * content または activeForm にマッチしたアイテムがチェーンステップと判定される。
 */
const CHAIN_STEP_PATTERNS: RegExp[] = [
  // スキル名（言語非依存）
  /commit-issue/i,
  /open-pr-issue/i,
  /reviewing/i,
  /code-issue/i,
  /simplify/i,
  // EN キーワード
  /\bcommit\b/i,
  /\bpull request\b/i,
  /\bself-review\b/i,
  /\bstatus.*review\b/i,
  /\bimplement/i,
  // JA キーワード
  /コミット/,
  /プッシュ/,
  /プルリクエスト/,
  /セルフレビュー/,
  /レビュー.*更新/,
  /実装/,
];

/**
 * TodoItem がチェーンステップかどうかを判定する
 */
export function isChainStep(item: TodoItem): boolean {
  const text = `${item.content} ${item.activeForm}`;
  return CHAIN_STEP_PATTERNS.some(pattern => pattern.test(text));
}

// ========================================
// Tasks API Analysis
// ========================================

/**
 * Tasks API ツール名のパターン
 *
 * Claude Code v2.1.16+ の Tasks API では以下のツール名が使用される。
 * 正確な名前はバージョンにより異なる可能性があるため複数パターンを許容する。
 */
const TASK_LIST_TOOL_NAMES = ["TaskList", "mcp__ide__TaskList"];
const TASK_CREATE_TOOL_NAMES = ["TaskCreate", "mcp__ide__TaskCreate"];
const TASK_UPDATE_TOOL_NAMES = ["TaskUpdate", "mcp__ide__TaskUpdate"];

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
export function findLatestTasks(transcriptPath: string): TodoItem[] | null {
  try {
    const content = readFileSync(transcriptPath, "utf-8");
    const lines = content.trim().split("\n");

    // Strategy 1: 最新の TaskList tool_result から現在状態を取得（最優先）
    // TaskList の結果は user ロールの tool_result content ブロックに含まれる
    // tool_use id と tool_result を照合するため、まず TaskList の tool_use id を収集する
    const taskListIds = new Set<string>();
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as TranscriptEntry;
        const contentArray = entry.message?.content;
        if (!contentArray || entry.message?.role !== "assistant") continue;
        for (const block of contentArray) {
          if (block.type !== "tool_use") continue;
          const toolBlock = block as ToolUseBlock;
          if (TASK_LIST_TOOL_NAMES.includes(toolBlock.name ?? "") && toolBlock.id) {
            taskListIds.add(toolBlock.id);
          }
        }
      } catch { /* skip */ }
    }

    if (taskListIds.size > 0) {
      // tool_result を末尾から逆順で探し、TaskList の結果を返す
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const entry = JSON.parse(lines[i]) as TranscriptEntry;
          const contentArray = entry.message?.content;
          if (!contentArray || entry.message?.role !== "user") continue;
          for (const block of contentArray) {
            if (block.type !== "tool_result") continue;
            const resultBlock = block as ToolResultBlock;
            if (!resultBlock.tool_use_id || !taskListIds.has(resultBlock.tool_use_id)) continue;
            const resultContent = resultBlock.content;
            if (typeof resultContent === "string") {
              try {
                const parsed = JSON.parse(resultContent) as unknown;
                if (Array.isArray(parsed)) {
                  const tasks = parsed as Array<{ title?: string; content?: string; status?: string; activeForm?: string }>;
                  const todoItems = tasks
                    .filter(t => t.title || t.content)
                    .map(t => ({
                      content: t.title ?? t.content ?? "",
                      status: t.status ?? "pending",
                      activeForm: t.activeForm ?? "",
                    }));
                  if (todoItems.length > 0) return todoItems;
                }
              } catch { /* skip */ }
            }
          }
        } catch { /* skip */ }
      }
    }

    // Strategy 2: TaskCreate + TaskUpdate の積み上げで現在状態を再構築
    // Tasks API では状態は外部（~/.claude/tasks/）に保存されるが、
    // transcript の tool_use 呼び出し履歴から状態を再現できる
    const taskMap = new Map<string, TodoItem>(); // id → current state
    const taskOrder: string[] = []; // insertion order

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as TranscriptEntry;
        const contentArray = entry.message?.content;
        if (!contentArray || entry.message?.role !== "assistant") continue;

        for (const block of contentArray) {
          if (block.type !== "tool_use") continue;
          const toolBlock = block as ToolUseBlock;
          const toolName = toolBlock.name ?? "";
          const input = toolBlock.input;
          const toolId = toolBlock.id ?? "";

          if (TASK_CREATE_TOOL_NAMES.includes(toolName) && input?.title) {
            const item: TodoItem = {
              content: input.title,
              status: input.status ?? "pending",
              activeForm: "",
            };
            taskMap.set(toolId, item);
            taskOrder.push(toolId);
          } else if (TASK_UPDATE_TOOL_NAMES.includes(toolName) && input?.id && input?.status) {
            // TaskUpdate は input.id で対象タスクを指定し、input.status で状態を更新する
            const existing = taskMap.get(input.id);
            if (existing) {
              taskMap.set(input.id, { ...existing, status: input.status });
            }
          }
        }
      } catch { /* skip */ }
    }

    if (taskOrder.length > 0) {
      return taskOrder
        .map(id => taskMap.get(id))
        .filter((item): item is TodoItem => item !== undefined);
    }

    // Strategy 3: 旧 TodoWrite snapshot（後方互換性）
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]) as TranscriptEntry;
        const contentArray = entry.message?.content;
        if (!contentArray || entry.message?.role !== "assistant") continue;
        for (const block of contentArray) {
          if (block.type !== "tool_use") continue;
          const toolBlock = block as ToolUseBlock;
          if (toolBlock.name === "TodoWrite" && toolBlock.input?.todos) {
            return toolBlock.input.todos;
          }
        }
      } catch { /* skip */ }
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * 後方互換エイリアス
 * @deprecated findLatestTasks を使用してください
 */
export const findLatestTodoWrite = findLatestTasks;

/**
 * タスクリストの未完了チェーンステップを検出する
 *
 * @returns 未完了チェーンステップの content リスト
 */
export function findIncompleteChainSteps(todos: TodoItem[]): string[] {
  return todos
    .filter(item =>
      (item.status === "pending" || item.status === "in_progress") &&
      isChainStep(item),
    )
    .map(item => item.content);
}

/**
 * タスクリストの全未完了タスクを検出する（チェーンステップかどうかに関わらず）
 *
 * Layer 2: チェーンステップ検出（Layer 1）に該当しない pending/in_progress タスクを検出する。
 *
 * @returns 未完了タスクの content リスト
 */
export function findAllIncompleteTodos(todos: TodoItem[]): string[] {
  return todos
    .filter(item =>
      item.status === "pending" || item.status === "in_progress",
    )
    .map(item => item.content);
}

// ========================================
// Shared Utilities
// ========================================

/**
 * ~ をホームディレクトリに展開する
 */
export function expandHomePath(p: string): string {
  return p.startsWith("~") ? p.replace(/^~/, homedir()) : p;
}

/**
 * stdin から全入力を読み取る
 */
export function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    // TTY の場合は空文字列を返す（パイプ入力なし）
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }

    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    process.stdin.on("error", () => resolve(""));
    process.stdin.resume();
  });
}
