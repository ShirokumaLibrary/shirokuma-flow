/**
 * skill benchmark コマンド
 *
 * benchmark ディレクトリの grading.json ファイルを集計して
 * benchmark.json と benchmark.md を生成する。
 *
 * Derived from: https://github.com/anthropics/skills/tree/main/skills/skill-creator
 * Original: scripts/aggregate_benchmark.py, scripts/generate_report.py
 * Original licensed under Apache License 2.0 (Copyright 2025 Anthropic, PBC).
 * Modified for shirokuma-docs: ported to TypeScript with CLI integration.
 *   - Python → TypeScript
 *   - benchmark.md 形式のレポート生成（Handlebars は不使用、テンプレートリテラルで実装）
 */
import type { BenchmarkData } from "./types.js";
export declare function generateBenchmark(benchmarkDir: string, skillName?: string, skillPath?: string): BenchmarkData;
/**
 * benchmark データから人間が読みやすい Markdown を生成する。
 */
export declare function generateMarkdown(benchmark: BenchmarkData): string;
interface BenchmarkOptions {
    benchmarkDir: string;
    skillName?: string;
    skillPath?: string;
    output?: string;
    verbose?: boolean;
}
export declare function cmdSkillBenchmark(options: BenchmarkOptions): number;
export {};
//# sourceMappingURL=benchmark.d.ts.map