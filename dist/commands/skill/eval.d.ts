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
import type { EvalEntry, EvalResult } from "./types.js";
/**
 * eval セット全体を並列実行して結果を返す。
 */
export declare function runEval(evalSet: EvalEntry[], skillName: string, description: string, numWorkers: number, timeout: number, projectRoot: string, runsPerQuery: number, triggerThreshold: number, model?: string): Promise<EvalResult>;
interface EvalOptions {
    skillPath: string;
    evalSet?: string;
    description?: string;
    numWorkers?: number;
    timeout?: number;
    runsPerQuery?: number;
    triggerThreshold?: number;
    model?: string;
    output?: string;
    verbose?: boolean;
    project: string;
}
export declare function cmdSkillEval(options: EvalOptions): Promise<number>;
export {};
//# sourceMappingURL=eval.d.ts.map