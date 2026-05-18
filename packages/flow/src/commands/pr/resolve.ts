/**
 * PR resolve subcommand - Resolve a review thread
 *
 * Resolves a PR review thread by its GraphQL node ID.
 */

import { Logger } from "../../utils/logger.js";
import {
  runGraphQL,
  isIssueNumber,
  parseIssueNumber,
} from "../../utils/github.js";
import type { IssuesPrOptions } from "./types.js";

// =============================================================================
// GraphQL Mutation
// =============================================================================

const GRAPHQL_MUTATION_RESOLVE_THREAD = `
mutation($threadId: ID!) {
  resolveReviewThread(input: {threadId: $threadId}) {
    thread { id isResolved }
  }
}
`;

// =============================================================================
// cmdResolve (#46)
// =============================================================================

export async function cmdResolve(
  prNumberStr: string,
  options: IssuesPrOptions,
  logger: Logger
): Promise<number> {
  if (!isIssueNumber(prNumberStr)) {
    logger.error(`Invalid PR number: ${prNumberStr}`);
    return 1;
  }

  if (!options.threadId) {
    logger.error("--thread-id is required (GraphQL thread node ID)");
    return 1;
  }

  // M4: Basic format validation for GraphQL node ID
  if (options.threadId.length < 4 || /\s/.test(options.threadId)) {
    logger.error(`Invalid --thread-id format: ${options.threadId}`);
    return 1;
  }

  const prNumber = parseIssueNumber(prNumberStr);

  interface ResolveResult {
    data?: {
      resolveReviewThread?: {
        thread?: { id?: string; isResolved?: boolean };
      };
    };
  }

  const result = await runGraphQL<ResolveResult>(GRAPHQL_MUTATION_RESOLVE_THREAD, {
    threadId: options.threadId,
  });

  if (!result.success) {
    logger.error(`Failed to resolve thread: ${result.error}`);
    return 1;
  }

  const resolved = result.data?.data?.resolveReviewThread?.thread?.isResolved ?? false;

  if (resolved) {
    logger.success(`Resolved thread ${options.threadId} on PR #${prNumber}`);
  } else {
    logger.warn(`Thread resolve request completed but thread may not be resolved`);
  }

  const output = {
    pr_number: prNumber,
    thread_id: options.threadId,
    resolved,
  };

  console.log(JSON.stringify(output, null, 2));
  return 0;
}
