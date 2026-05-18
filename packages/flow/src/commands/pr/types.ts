/**
 * PR command types
 *
 * Shared types for the pr command and its subcommands.
 */

import type { OutputFormat } from "../../utils/formatters.js";

// =============================================================================
// Types
// =============================================================================

export interface IssuesPrOptions {
  owner?: string;
  verbose?: boolean;
  format?: OutputFormat;
  // list/show options (#568)
  state?: string;
  limit?: number;
  // pr-create options (#986)
  base?: string;
  title?: string;
  // merge options
  squash?: boolean;
  merge?: boolean;
  rebase?: boolean;
  deleteBranch?: boolean;
  checkout?: boolean;
  deleteLocal?: boolean;
  head?: string;
  skipLinkCheck?: boolean;
  // reply/resolve options
  replyTo?: string;
  threadId?: string;
  bodyFile?: string;
  // --from-file / --to-file options (#1337)
  fromFile?: string;
  toFile?: string;
  // Dry-run mode (#1338)
  dryRun?: boolean;
  // PR close rollback mode (#1933)
  rollback?: boolean;
  // repo pair flags (pass through)
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

// PR 一覧の共通型（#568 — pr-list / fetchOpenPRs 共用）
export interface PrListNode {
  number?: number;
  title?: string;
  state?: string;
  url?: string;
  headRefName?: string;
  baseRefName?: string;
  author?: { login?: string };
  reviewDecision?: string | null;
  reviewThreads?: { totalCount?: number };
  reviews?: { totalCount?: number };
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
