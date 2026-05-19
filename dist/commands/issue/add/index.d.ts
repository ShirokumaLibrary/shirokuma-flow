/**
 * items add issue - Issue 作成ロジック (#1808)
 *
 * @related pull/issue.ts - Issue 取得・キャッシュ書き込み
 * @related push/issue.ts - Issue 本体の push ロジック
 */
import type { Logger } from "../../../utils/logger.js";
import type { AddIssueOptions } from "../../items/types.js";
/**
 * Issue を作成する。
 * frontmatter から title/status/priority/size/labels/assignees を読み取る。
 */
export declare function cmdAddIssue(options: AddIssueOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=index.d.ts.map