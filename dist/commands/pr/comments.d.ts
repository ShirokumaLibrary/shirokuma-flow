/**
 * PR comments subcommand - Fetch PR review threads
 *
 * Fetches all review threads and comments for a given PR number.
 */
import { Logger } from "../../utils/logger.js";
import type { IssuesPrOptions } from "./types.js";
export declare const GRAPHQL_QUERY_PR_REVIEW_THREADS = "\nquery($owner: String!, $name: String!, $number: Int!) {\n  repository(owner: $owner, name: $name) {\n    pullRequest(number: $number) {\n      title\n      state\n      body\n      reviewDecision\n      reviews(first: 50) {\n        totalCount\n        nodes {\n          author { login }\n          state\n          body\n        }\n      }\n      reviewThreads(first: 50) {\n        totalCount\n        nodes {\n          id\n          isResolved\n          isOutdated\n          comments(first: 20) {\n            nodes {\n              id\n              databaseId\n              body\n              path\n              line\n              author { login }\n              createdAt\n            }\n          }\n        }\n      }\n      comments(first: 50) {\n        totalCount\n        nodes {\n          id\n          databaseId\n          body\n          author { login }\n          createdAt\n        }\n      }\n    }\n  }\n}\n";
export interface ReviewNode {
    author?: {
        login?: string;
    };
    state?: string;
    body?: string;
}
export interface CommentNode {
    id?: string;
    databaseId?: number;
    body?: string;
    path?: string | null;
    line?: number | null;
    author?: {
        login?: string;
    };
    createdAt?: string;
}
export interface IssueCommentNode {
    id?: string;
    databaseId?: number;
    body?: string;
    author?: {
        login?: string;
    };
    createdAt?: string;
}
export interface ThreadNode {
    id?: string;
    isResolved?: boolean;
    isOutdated?: boolean;
    comments?: {
        nodes?: CommentNode[];
    };
}
export declare function transformReviews(nodes: ReviewNode[]): {
    author: string;
    state: string;
    body: string;
}[];
export declare function transformThreads(nodes: ThreadNode[]): {
    id: string;
    is_resolved: boolean;
    is_outdated: boolean;
    file: string | null;
    line: number | null;
    comments: {
        id: string;
        database_id: number;
        author: string;
        body: string;
        created_at: string;
    }[];
}[];
export declare function transformIssueComments(nodes: IssueCommentNode[]): {
    id: string;
    database_id: number;
    author: string;
    body: string;
    created_at: string;
}[];
export declare function cmdPrComments(prNumberStr: string, options: IssuesPrOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=comments.d.ts.map