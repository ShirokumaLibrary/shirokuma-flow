/**
 * adr create - Create a new ADR as GitHub Discussion
 */

import type { Logger } from "../../utils/logger.js";
import { runGraphQL, validateTitle, validateBody } from "../../utils/github.js";
import { resolveTargetRepo } from "../../utils/repo-pairs.js";
import {
  GRAPHQL_MUTATION_CREATE_DISCUSSION,
  getRepoId,
} from "../../utils/graphql-queries.js";
import { getCategories, findCategory } from "../discussions/helpers.js";

export interface AdrOptions {
  verbose?: boolean;
  limit?: number;
  repo?: string;
  public?: boolean;
}

/** ADR category name in GitHub Discussions */
export const ADR_CATEGORY = "ADR";

/**
 * Format ADR title with numbering convention
 */
function formatAdrTitle(title: string): string {
  // If already formatted as ADR-XXXX, keep as-is
  if (/^ADR-\d{4}:/i.test(title)) {
    return title;
  }
  // Otherwise, prefix with ADR- (number will be the Discussion number)
  return `ADR: ${title}`;
}

/**
 * Build ADR body from template
 */
function buildAdrBody(): string {
  const today = new Date().toISOString().split("T")[0];

  return `## Status
Proposed

## Date
${today}

## Context
[What is the issue that is motivating this decision? What context or background is relevant?]

## Decision
[What change are we proposing/implementing? What alternatives were considered?]

## Consequences
[What becomes easier or harder as a result of this decision?]

### Positive
-

### Concerns
-

## Related
- Related ADRs: None
- Related code:
- References:
`;
}

/**
 * create subcommand handler
 */
export async function cmdCreate(
  title: string,
  options: AdrOptions,
  logger: Logger,
): Promise<number> {
  const formattedTitle = formatAdrTitle(title);
  const body = buildAdrBody();

  logger.info(`Creating ADR Discussion: ${formattedTitle}`);

  const titleError = validateTitle(formattedTitle);
  if (titleError) {
    logger.error(titleError);
    return 1;
  }

  const bodyError = validateBody(body);
  if (bodyError) {
    logger.error(bodyError);
    return 1;
  }

  const repoInfo = resolveTargetRepo(options);
  if (!repoInfo) {
    logger.error("Could not determine repository");
    return 1;
  }

  const { owner, name: repo } = repoInfo;

  const repoId = await getRepoId(owner, repo);
  if (!repoId) {
    logger.error("Could not get repository ID");
    return 1;
  }

  const category = await findCategory(owner, repo, ADR_CATEGORY);
  if (!category) {
    logger.error(`Category '${ADR_CATEGORY}' not found`);
    const categories = await getCategories(owner, repo);
    if (categories.length > 0) {
      logger.info(`Available categories: ${categories.map((c) => c.name).join(", ")}`);
    }
    return 1;
  }

  interface CreateResult {
    data?: {
      createDiscussion?: {
        discussion?: {
          id?: string;
          number?: number;
          url?: string;
          title?: string;
        };
      };
    };
  }

  const result = await runGraphQL<CreateResult>(GRAPHQL_MUTATION_CREATE_DISCUSSION, {
    repositoryId: repoId,
    categoryId: category.id,
    title: formattedTitle,
    body,
  });

  if (!result.success) {
    logger.error("Failed to create ADR discussion");
    return 1;
  }

  const discussion = result.data?.data?.createDiscussion?.discussion;
  if (!discussion?.id) {
    logger.error("Failed to create ADR discussion");
    return 1;
  }

  logger.success(`Created ADR discussion #${discussion.number}`);

  const output = {
    id: discussion.id,
    number: discussion.number,
    title: discussion.title,
    category: ADR_CATEGORY,
  };

  console.log(JSON.stringify(output, null, 2));
  return 0;
}
