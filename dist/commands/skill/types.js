/**
 * skill コマンド共有型定義
 *
 * Derived from: https://github.com/anthropics/skills/tree/main/skills/skill-creator
 * Original: scripts/quick_validate.py, scripts/run_eval.py, scripts/aggregate_benchmark.py
 * Original licensed under Apache License 2.0 (Copyright 2025 Anthropic, PBC).
 * Modified for shirokuma-docs: ported to TypeScript with CLI integration.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
// =============================================================================
// Eval/Optimize 共通設定
// =============================================================================
/** eval/optimize 共通のデフォルト値 */
export const EVAL_DEFAULTS = {
    NUM_WORKERS: 10,
    TIMEOUT: 30,
    RUNS_PER_QUERY: 3,
    TRIGGER_THRESHOLD: 0.5,
};
/** optimize 固有のデフォルト値 */
export const OPTIMIZE_DEFAULTS = {
    MAX_ITERATIONS: 5,
    HOLDOUT: 0.4,
    MODEL: "claude-opus-4-5",
};
// =============================================================================
// 共通ユーティリティ
// =============================================================================
/**
 * ファイル名安全なタイムスタンプを生成する（例: 2026-03-11_06-29-39）
 */
export function formatTimestamp(date = new Date()) {
    return date.toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
}
/**
 * CLAUDECODE 環境変数を除去した env オブジェクトを返す。
 * claude -p のネスト呼び出し防止に使用。
 */
export function getCleanEnv() {
    return Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== "CLAUDECODE"));
}
/**
 * カレントディレクトリから .claude/ を持つプロジェクトルートを探す。
 */
export function findProjectRoot() {
    let current = process.cwd();
    while (true) {
        if (existsSync(join(current, ".claude"))) {
            return current;
        }
        const parent = join(current, "..");
        if (parent === current)
            break;
        current = parent;
    }
    return process.cwd();
}
//# sourceMappingURL=types.js.map