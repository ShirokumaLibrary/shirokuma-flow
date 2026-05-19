/**
 * items template plan — 計画テンプレート生成 (#1836)
 *
 * 計画 Issue 本文の骨格を level に応じて生成する純粋関数。
 */
import type { Locale } from "../../../utils/i18n.js";
/** 計画レベル */
export type PlanLevel = "light" | "standard" | "detailed" | "epic";
/**
 * 計画テンプレートを生成する
 * @param lang - 言語 (ja|en)
 * @param level - 計画レベル (light|standard|detailed|epic)
 * @returns テンプレート文字列
 */
export declare function generatePlanTemplate(lang: Locale, level?: PlanLevel): string;
//# sourceMappingURL=plan.d.ts.map