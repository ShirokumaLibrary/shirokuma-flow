/**
 * ルールレジストリ
 *
 * すべてのlintルールをエクスポート
 */

import type { LintRule } from "../types.js";
import { testdocRequiredRule } from "./testdoc-required.js";
import { testdocJapaneseRule } from "./testdoc-japanese.js";
import { testdocMinLengthRule } from "./testdoc-min-length.js";
import { duplicateTestdocRule } from "./duplicate-testdoc.js";
import { describeCoverageRule } from "./describe-coverage.js";
import { skippedTestReportRule } from "./skipped-test-report.js";

/**
 * 全ルールのマップ
 */
export const rules: Record<string, LintRule> = {
  "testdoc-required": testdocRequiredRule,
  "testdoc-japanese": testdocJapaneseRule,
  "testdoc-min-length": testdocMinLengthRule,
  "duplicate-testdoc": duplicateTestdocRule,
  "describe-coverage": describeCoverageRule,
  "skipped-test-report": skippedTestReportRule,
};

/**
 * デフォルトで有効なルール
 */
export const defaultEnabledRules: string[] = [
  "testdoc-required",
  "testdoc-japanese",
  "testdoc-min-length",
  "duplicate-testdoc",
  "describe-coverage",
  "skipped-test-report",
];

/**
 * ルールを取得
 */
export function getRule(ruleId: string): LintRule | undefined {
  return rules[ruleId];
}

/**
 * 有効なルールを取得
 */
export function getEnabledRules(enabledRuleIds: string[]): LintRule[] {
  return enabledRuleIds
    .map((id) => rules[id])
    .filter((rule): rule is LintRule => rule !== undefined);
}

// 個別ルールのエクスポート
export { testdocRequiredRule } from "./testdoc-required.js";
export { testdocJapaneseRule } from "./testdoc-japanese.js";
export { testdocMinLengthRule } from "./testdoc-min-length.js";
export { duplicateTestdocRule } from "./duplicate-testdoc.js";
export { describeCoverageRule } from "./describe-coverage.js";
export { skippedTestReportRule } from "./skipped-test-report.js";
