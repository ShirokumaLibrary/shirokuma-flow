/**
 * discussions shared helpers - GraphQL queries, types, and utility functions
 */

import {
  runGraphQL,
} from "../../utils/github.js";
import type { OutputFormat } from "../../utils/formatters.js";

// =============================================================================
// Types
// =============================================================================

export interface DiscussionsOptions {
  verbose?: boolean;
  category?: string;
  limit?: number;
  format?: OutputFormat;
  title?: string;
  bodyFile?: string;
  // --from-file / --to-file options (#1337)
  fromFile?: string;
  toFile?: string;
  query?: string;
  // Dry-run mode (#1338)
  dryRun?: boolean;
  public?: boolean;
  repo?: string;
}

export interface DiscussionCategory {
  id: string;
  name: string;
  description: string;
  emoji: string;
  isAnswerable: boolean;
}

export interface Discussion {
  id: string;
  number: number;
  title: string;
  body?: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  author: string;
  category: string;
  answerChosenAt?: string;
}

// =============================================================================
// GraphQL Queries
// =============================================================================

export const GRAPHQL_QUERY_CATEGORIES = `
query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    discussionCategories(first: 20) {
      nodes {
        id
        name
        description
        emoji
        isAnswerable
      }
    }
  }
}
`;

export const GRAPHQL_QUERY_DISCUSSIONS = `
query($owner: String!, $name: String!, $first: Int!, $categoryId: ID, $cursor: String) {
  repository(owner: $owner, name: $name) {
    discussions(first: $first, after: $cursor, categoryId: $categoryId, orderBy: {field: CREATED_AT, direction: DESC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        number
        title
        url
        createdAt
        updatedAt
        answerChosenAt
        author { login }
        category { name }
      }
    }
  }
}
`;

export const GRAPHQL_QUERY_DISCUSSION = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    discussion(number: $number) {
      id
      number
      title
      body
      url
      createdAt
      updatedAt
      answerChosenAt
      author { login }
      category { name }
    }
  }
}
`;

export const GRAPHQL_QUERY_DISCUSSION_BY_ID = `
query($id: ID!) {
  node(id: $id) {
    ... on Discussion {
      id
      number
      title
      body
      url
      createdAt
      updatedAt
      answerChosenAt
      author { login }
      category { name }
    }
  }
}
`;

export const GRAPHQL_MUTATION_UPDATE_DISCUSSION = `
mutation($discussionId: ID!, $title: String, $body: String) {
  updateDiscussion(input: {discussionId: $discussionId, title: $title, body: $body}) {
    discussion {
      id
      number
      url
      title
      body
    }
  }
}
`;

export const GRAPHQL_MUTATION_ADD_DISCUSSION_COMMENT = `
mutation($discussionId: ID!, $body: String!) {
  addDiscussionComment(input: {discussionId: $discussionId, body: $body}) {
    comment {
      id
      databaseId
      url
    }
  }
}
`;

export const GRAPHQL_QUERY_SEARCH_DISCUSSIONS = `
query($searchQuery: String!, $first: Int!) {
  search(query: $searchQuery, type: DISCUSSION, first: $first) {
    discussionCount
    nodes {
      ... on Discussion {
        id
        number
        title
        url
        createdAt
        updatedAt
        author { login }
        category { name }
        answerChosenAt
      }
    }
  }
}
`;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get discussion categories
 */
export async function getCategories(owner: string, repo: string): Promise<DiscussionCategory[]> {
  interface CategoryNode {
    id?: string;
    name?: string;
    description?: string;
    emoji?: string;
    isAnswerable?: boolean;
  }

  interface QueryResult {
    data?: {
      repository?: {
        discussionCategories?: {
          nodes?: CategoryNode[];
        };
      };
    };
  }

  const result = await runGraphQL<QueryResult>(GRAPHQL_QUERY_CATEGORIES, {
    owner,
    name: repo,
  });

  if (!result.success || !result.data?.data?.repository?.discussionCategories) {
    return [];
  }

  const nodes = result.data.data.repository.discussionCategories.nodes ?? [];
  return nodes
    .filter((n): n is Required<CategoryNode> => !!n?.id && !!n?.name)
    .map((n) => ({
      id: n.id,
      name: n.name,
      description: n.description ?? "",
      emoji: n.emoji ?? "",
      isAnswerable: n.isAnswerable ?? false,
    }));
}

/**
 * Find category by name
 */
export async function findCategory(
  owner: string,
  repo: string,
  categoryName: string
): Promise<DiscussionCategory | null> {
  const categories = await getCategories(owner, repo);
  return (
    categories.find(
      (c) => c.name.toLowerCase() === categoryName.toLowerCase()
    ) ?? null
  );
}

/**
 * Get discussion GraphQL ID by number
 */
export async function getDiscussionId(owner: string, repo: string, number: number): Promise<string | null> {
  interface QueryResult {
    data?: {
      repository?: {
        discussion?: {
          id?: string;
        };
      };
    };
  }

  const result = await runGraphQL<QueryResult>(GRAPHQL_QUERY_DISCUSSION, {
    owner,
    name: repo,
    number,
  });

  if (!result.success) return null;
  return result.data?.data?.repository?.discussion?.id ?? null;
}
