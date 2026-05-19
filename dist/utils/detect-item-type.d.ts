/**
 * detect-item-type - 番号から Issue/PR/Discussion の種別を判別する共有ユーティリティ
 *
 * GraphQL の issueOrPullRequest で Issue/PR を __typename で判別し、
 * Discussion は別番号空間として同一クエリまたはフォールバックで取得する。
 * `show` コマンドと `comment` コマンドで共有。
 */
import type { Logger } from "./logger.js";
/** 種別判別結果 */
export interface DetectResult {
    type: "issue" | "pr" | "discussion";
    data: Record<string, unknown>;
    /** 異なる番号空間で同一番号が見つかった場合の重複情報 */
    ambiguous?: {
        type: "issue" | "pr" | "discussion";
        data: Record<string, unknown>;
    };
}
export interface DetectInput {
    issueOrPullRequest: {
        __typename: string;
        [key: string]: unknown;
    } | null;
    discussion: Record<string, unknown> | null;
}
/** detectAndResolve に渡す共通オプション */
export interface DetectOptions {
    verbose?: boolean;
    public?: boolean;
    repo?: string;
}
/**
 * issueOrPullRequest + discussion の 2 フィールドクエリ。
 * issueOrPullRequest は union 型で Issue/PR を __typename で判別し、
 * 存在しない番号では null を返す（エラーにならない）。
 */
export declare const GRAPHQL_QUERY_DETECT_TYPE = "\nquery($owner: String!, $name: String!, $number: Int!) {\n  repository(owner: $owner, name: $name) {\n\n    issueOrPullRequest(number: $number) {\n      __typename\n      ... on Issue {\n        number\n        title\n      }\n      ... on PullRequest {\n        number\n        title\n      }\n    }\n    discussion(number: $number) {\n      number\n      title\n    }\n  }\n}\n";
/**
 * issueOrPullRequest のみのフォールバッククエリ。
 * メインクエリが discussion フィールドのエラーで失敗した場合に使用。
 */
export declare const GRAPHQL_QUERY_ISSUE_OR_PR_ONLY = "\nquery($owner: String!, $name: String!, $number: Int!) {\n  repository(owner: $owner, name: $name) {\n\n    issueOrPullRequest(number: $number) {\n      __typename\n      ... on Issue {\n        number\n        title\n      }\n      ... on PullRequest {\n        number\n        title\n      }\n    }\n  }\n}\n";
/**
 * GraphQL レスポンスから種別を判別する。
 * issueOrPullRequest の __typename で Issue/PR を判別し、Discussion は別番号空間として扱う。
 *
 * - issueOrPullRequest が存在 → __typename で "Issue" / "PullRequest" を判別
 * - Discussion は別番号空間のため、Issue/PR がある場合はそちらを優先
 * - DetectResult.type は短縮形（"pr"）を使用
 */
export declare function detectItemType(input: DetectInput): DetectResult | null;
/**
 * 番号文字列を検証し、GraphQL で種別を判別して DetectResult を返す。
 * エラー時は logger にメッセージを出力し null を返す。
 */
export declare function detectAndResolve(numberStr: string, options: DetectOptions, logger: Logger): Promise<{
    number: number;
    detected: DetectResult;
} | null>;
/** Handler functions for each item type */
export interface DelegationHandlers<T = unknown> {
    issue: (num: string, opts: T, logger: Logger) => Promise<number>;
    pr: (num: string, opts: T, logger: Logger) => Promise<number>;
    discussion: (num: string, opts: T, logger: Logger) => Promise<number>;
}
/**
 * Helper to delegate command execution based on detected item type.
 * Handles exit code and error handling uniformly across all top-level commands.
 *
 * @example
 * const { number, detected } = result;
 * await delegateToHandler(number, detected, {
 *   issue: cmdIssueShow,
 *   pr: cmdPrShow,
 *   discussion: cmdDiscussionShow,
 * }, delegateOptions, logger);
 */
export declare function delegateToHandler<T = unknown>(number: number, detected: DetectResult, handlers: DelegationHandlers<T>, options: T, logger: Logger): Promise<number>;
//# sourceMappingURL=detect-item-type.d.ts.map