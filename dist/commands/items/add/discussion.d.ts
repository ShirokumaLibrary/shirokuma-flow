/**
 * items add discussion - Discussion 作成ロジック (#1808)
 *
 * @related pull/discussion.ts - Discussion 取得・キャッシュ書き込み
 * @related push/discussion.ts - Discussion 本体の push ロジック
 */
import type { Logger } from "../../../utils/logger.js";
import type { AddDiscussionOptions } from "../types.js";
/**
 * Discussion を作成する。
 * frontmatter から title/category を読み取る。
 */
export declare function cmdAddDiscussion(options: AddDiscussionOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=discussion.d.ts.map