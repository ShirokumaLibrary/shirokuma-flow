/**
 * skill コマンド共有型定義
 *
 * Derived from: https://github.com/anthropics/skills/tree/main/skills/skill-creator
 * Original: scripts/quick_validate.py, scripts/run_eval.py, scripts/aggregate_benchmark.py
 * Original licensed under Apache License 2.0 (Copyright 2025 Anthropic, PBC).
 * Modified for shirokuma-flow: ported to TypeScript with CLI integration.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

// =============================================================================
// Frontmatter / Validation
// =============================================================================

/**
 * SKILL.md フロントマターのパース結果
 */
export interface SkillFrontmatter {
  name: string;
  description: string;
  license?: string;
  allowedTools?: string[];
  metadata?: Record<string, unknown>;
  compatibility?: string;
}

/**
 * バリデーション結果
 */
export interface ValidationResult {
  valid: boolean;
  message: string;
}

// =============================================================================
// Eval
// =============================================================================

/**
 * eval セットの1エントリ
 */
export interface EvalEntry {
  query: string;
  should_trigger: boolean;
}

/**
 * 1クエリの eval 実行結果
 */
export interface EvalQueryResult {
  query: string;
  should_trigger: boolean;
  trigger_rate: number;
  triggers: number;
  runs: number;
  pass: boolean;
}

/**
 * eval 実行結果（全体）
 */
export interface EvalResult {
  skill_name: string;
  description: string;
  results: EvalQueryResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

// =============================================================================
// Optimize
// =============================================================================

/**
 * optimize ループの1イテレーション履歴エントリ
 */
export interface OptimizeHistoryEntry {
  iteration: number;
  description: string;
  train_passed: number;
  train_failed: number;
  train_total: number;
  train_results: EvalQueryResult[];
  test_passed: number | null;
  test_failed: number | null;
  test_total: number | null;
  test_results: EvalQueryResult[] | null;
  /** 後方互換 */
  passed: number;
  failed: number;
  total: number;
  results: EvalQueryResult[];
}

/**
 * optimize コマンドの出力
 */
export interface OptimizeResult {
  exit_reason: string;
  original_description: string;
  best_description: string;
  best_score: string;
  best_train_score: string;
  best_test_score: string | null;
  final_description: string;
  iterations_run: number;
  holdout: number;
  train_size: number;
  test_size: number;
  history: OptimizeHistoryEntry[];
}

// =============================================================================
// Benchmark
// =============================================================================

/**
 * benchmark の grading.json 期待エントリ
 */
export interface GradingExpectation {
  text: string;
  passed: boolean;
  evidence?: string;
}

/**
 * 1 run の結果
 */
export interface BenchmarkRunResult {
  eval_id: number | string;
  run_number: number;
  pass_rate: number;
  passed: number;
  failed: number;
  total: number;
  time_seconds: number;
  tokens: number;
  tool_calls: number;
  errors: number;
}

/**
 * 統計値
 */
export interface Stats {
  mean: number;
  stddev: number;
  min: number;
  max: number;
}

/**
 * 設定ごとの集計サマリー
 */
export interface ConfigSummary {
  pass_rate: Stats;
  time_seconds: Stats;
  tokens: Stats;
}

/**
 * benchmark.json の全体構造
 */
export interface BenchmarkData {
  metadata: {
    skill_name: string;
    skill_path: string;
    executor_model: string;
    analyzer_model: string;
    timestamp: string;
    evals_run: (number | string)[];
    runs_per_configuration: number;
  };
  runs: Array<{
    eval_id: number | string;
    configuration: string;
    run_number: number;
    result: BenchmarkRunResult;
    expectations: GradingExpectation[];
    notes: string[];
  }>;
  run_summary: Record<string, ConfigSummary | { pass_rate: string; time_seconds: string; tokens: string }>;
  notes: string[];
}

// =============================================================================
// Common Options
// =============================================================================

/**
 * skill サブコマンド共通オプション
 */
export interface SkillCommonOptions {
  project: string;
  verbose?: boolean;
}

// =============================================================================
// Eval/Optimize 共通設定
// =============================================================================

/** eval/optimize 共通のデフォルト値 */
export const EVAL_DEFAULTS = {
  NUM_WORKERS: 10,
  TIMEOUT: 30,
  RUNS_PER_QUERY: 3,
  TRIGGER_THRESHOLD: 0.5,
} as const;

/** optimize 固有のデフォルト値 */
export const OPTIMIZE_DEFAULTS = {
  MAX_ITERATIONS: 5,
  HOLDOUT: 0.4,
  MODEL: "claude-opus-4-5",
} as const;

// =============================================================================
// 共通ユーティリティ
// =============================================================================

/**
 * ファイル名安全なタイムスタンプを生成する（例: 2026-03-11_06-29-39）
 */
export function formatTimestamp(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
}

/**
 * CLAUDECODE 環境変数を除去した env オブジェクトを返す。
 * claude -p のネスト呼び出し防止に使用。
 */
export function getCleanEnv(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(process.env).filter(([k]) => k !== "CLAUDECODE")
  );
}

/**
 * カレントディレクトリから .claude/ を持つプロジェクトルートを探す。
 */
export function findProjectRoot(): string {
  let current = process.cwd();
  while (true) {
    if (existsSync(join(current, ".claude"))) {
      return current;
    }
    const parent = join(current, "..");
    if (parent === current) break;
    current = parent;
  }
  return process.cwd();
}
