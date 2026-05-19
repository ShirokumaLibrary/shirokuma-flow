/**
 * items comments サブコマンド (#1814, #2024)
 *
 * issues comments から移行。Issue の全コメントを GraphQL で取得する。
 * #2024 Phase 2-D: context cache を優先参照し、miss 時は API フォールバック。
 */
import type { Logger } from "../../../utils/logger.js";
import type { CommentsOptions } from "../../items/types.js";
export declare const GRAPHQL_QUERY_ISSUE_COMMENTS = "\nquery($owner: String!, $name: String!, $number: Int!) {\n  repository(owner: $owner, name: $name) {\n    issue(number: $number) {\n      number\n      comments(first: 100) {\n        totalCount\n        nodes {\n          id\n          databaseId\n          author { login }\n          body\n          createdAt\n          url\n        }\n      }\n    }\n  }\n}\n";
/**
 * items comments サブコマンド
 *
 * Issue の全コメントを一覧表示する。
 */
export declare function cmdComments(issueNumberStr: string, options: CommentsOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=index.d.ts.map