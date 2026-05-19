/**
 * PR command types
 *
 * Shared types for the pr command and its subcommands.
 */
import type { OutputFormat } from "../../utils/formatters.js";
export interface IssuesPrOptions {
    owner?: string;
    verbose?: boolean;
    format?: OutputFormat;
    state?: string;
    limit?: number;
    base?: string;
    title?: string;
    squash?: boolean;
    merge?: boolean;
    rebase?: boolean;
    deleteBranch?: boolean;
    checkout?: boolean;
    deleteLocal?: boolean;
    head?: string;
    skipLinkCheck?: boolean;
    replyTo?: string;
    threadId?: string;
    bodyFile?: string;
    fromFile?: string;
    toFile?: string;
    dryRun?: boolean;
    rollback?: boolean;
    public?: boolean;
    repo?: string;
}
export interface PrSummary {
    number: number;
    title: string;
    url: string;
    reviewDecision: string | null;
    reviewThreadCount: number;
    reviewCount: number;
}
export type LinkPattern = "1:1" | "1:N" | "N:1" | "N:N";
export interface LinkGraphEntry {
    issueNumber: number;
    linkedPrs: number[];
}
export interface PrListNode {
    number?: number;
    title?: string;
    state?: string;
    url?: string;
    headRefName?: string;
    baseRefName?: string;
    author?: {
        login?: string;
    };
    reviewDecision?: string | null;
    reviewThreads?: {
        totalCount?: number;
    };
    reviews?: {
        totalCount?: number;
    };
}
export interface PrListQueryResult {
    data?: {
        repository?: {
            pullRequests?: {
                nodes?: PrListNode[];
            };
        };
    };
}
//# sourceMappingURL=types.d.ts.map