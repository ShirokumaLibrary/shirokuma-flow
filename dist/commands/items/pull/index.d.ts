/**
 * items pull サブコマンド (#1808)
 *
 * GitHub から Issue / Discussion の本体とコメントを取得し、
 * `.shirokuma/github/` にキャッシュとして書き込む。
 *
 * アイテム種別は自動判別（Issue → Discussion の順で検索）。
 * Projects フィールド（status/priority/size/labels/title）も frontmatter に含める。
 */
import type { Logger } from "../../../utils/logger.js";
import type { PullOptions } from "../types.js";
/**
 * items pull サブコマンド
 *
 * GitHub から指定番号の Issue または Discussion を取得してキャッシュに書き込む。
 * 種別は自動判別（Issue → Discussion の順で検索）。
 */
export declare function cmdPull(numberStr: string, options: PullOptions, logger: Logger): Promise<number>;
export { fetchAndCacheIssue } from "./issue.js";
export { fetchAndCacheDiscussion } from "./discussion.js";
export { fetchAndCachePr } from "./pr.js";
export { fetchRemoteSnapshot } from "./snapshot.js";
//# sourceMappingURL=index.d.ts.map