/**
 * items template comment — コメントテンプレート生成 (#1836)
 *
 * 各種コメント骨格 (review-report|review-response|completion-report|handover) を
 * 生成する純粋関数。
 */
import type { Locale } from "../../../utils/i18n.js";
/** コメントタイプ */
export type CommentType = "review-report" | "review-response" | "completion-report" | "handover";
/**
 * コメントテンプレートを生成する
 * @param lang - 言語 (ja|en)
 * @param type - コメントタイプ
 * @returns テンプレート文字列
 */
export declare function generateCommentTemplate(lang: Locale, type: CommentType): string;
//# sourceMappingURL=comment.d.ts.map