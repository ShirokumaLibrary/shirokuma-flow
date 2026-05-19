/**
 * skill optimize コマンド
 *
 * eval + 改善ループを実行し、スキルの説明を最適化する。
 * claude -p を使って説明の改善を生成する（SDK 不使用）。
 *
 * Derived from: https://github.com/anthropics/skills/tree/main/skills/skill-creator
 * Original: scripts/run_loop.py, scripts/improve_description.py
 * Original licensed under Apache License 2.0 (Copyright 2025 Anthropic, PBC).
 * Modified for shirokuma-docs: ported to TypeScript with CLI integration.
 *   - anthropic SDK → claude -p による説明改善
 *   - train/test 層化分割（60/40）
 *   - ログ保存対応
 *   - HTML レポートは generate_report の TypeScript 版（optimize-report.ts）で生成
 */
import type { EvalEntry, OptimizeResult } from "./types.js";
export declare function runOptimizeLoop(evalSet: EvalEntry[], skillPath: string, descriptionOverride: string | undefined, numWorkers: number, timeout: number, maxIterations: number, runsPerQuery: number, triggerThreshold: number, holdout: number, model: string, verbose: boolean, logDir?: string): Promise<OptimizeResult>;
interface OptimizeOptions {
    skillPath: string;
    evalSet?: string;
    description?: string;
    numWorkers?: number;
    timeout?: number;
    maxIterations?: number;
    runsPerQuery?: number;
    triggerThreshold?: number;
    holdout?: number;
    model?: string;
    resultsDir?: string;
    verbose?: boolean;
    project: string;
}
export declare function cmdSkillOptimize(options: OptimizeOptions): Promise<number>;
export {};
//# sourceMappingURL=optimize.d.ts.map