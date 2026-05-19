/**
 * items add サブコマンド (#1808)
 *
 * Phase 5-2 以降、`add issue` / `add comment` は `issue` カテゴリに移行済み。
 * 残存サブコマンド: `items add discussion`
 *
 * このファイルは後方互換 re-export として cmdAddComment / cmdAddIssue を
 * issue カテゴリから再エクスポートする。
 */
// =============================================================================
// Re-exports
// =============================================================================
// cmdAddComment / cmdAddIssue は issue カテゴリに移行済み (#2217 Phase 5-2)
export { cmdAddComment } from "../../issue/comment/index.js";
export { cmdAddIssue } from "../../issue/add/index.js";
export { cmdAddDiscussion } from "./discussion.js";
//# sourceMappingURL=index.js.map