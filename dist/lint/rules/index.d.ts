/**
 * ルールレジストリ
 *
 * すべてのlintルールをエクスポート
 */
import type { LintRule } from "../types.js";
/**
 * 全ルールのマップ
 */
export declare const rules: Record<string, LintRule>;
/**
 * デフォルトで有効なルール
 */
export declare const defaultEnabledRules: string[];
/**
 * ルールを取得
 */
export declare function getRule(ruleId: string): LintRule | undefined;
/**
 * 有効なルールを取得
 */
export declare function getEnabledRules(enabledRuleIds: string[]): LintRule[];
export { testdocRequiredRule } from "./testdoc-required.js";
export { testdocJapaneseRule } from "./testdoc-japanese.js";
export { testdocMinLengthRule } from "./testdoc-min-length.js";
export { duplicateTestdocRule } from "./duplicate-testdoc.js";
export { describeCoverageRule } from "./describe-coverage.js";
export { skippedTestReportRule } from "./skipped-test-report.js";
//# sourceMappingURL=index.d.ts.map