/**
 * discussions shared helpers - GraphQL queries, types, and utility functions
 */
import type { OutputFormat } from "../../utils/formatters.js";
export interface DiscussionsOptions {
    verbose?: boolean;
    category?: string;
    limit?: number;
    format?: OutputFormat;
    title?: string;
    bodyFile?: string;
    fromFile?: string;
    toFile?: string;
    query?: string;
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
export declare const GRAPHQL_QUERY_CATEGORIES = "\nquery($owner: String!, $name: String!) {\n  repository(owner: $owner, name: $name) {\n    discussionCategories(first: 20) {\n      nodes {\n        id\n        name\n        description\n        emoji\n        isAnswerable\n      }\n    }\n  }\n}\n";
export declare const GRAPHQL_QUERY_DISCUSSIONS = "\nquery($owner: String!, $name: String!, $first: Int!, $categoryId: ID, $cursor: String) {\n  repository(owner: $owner, name: $name) {\n    discussions(first: $first, after: $cursor, categoryId: $categoryId, orderBy: {field: CREATED_AT, direction: DESC}) {\n      pageInfo { hasNextPage endCursor }\n      nodes {\n        id\n        number\n        title\n        url\n        createdAt\n        updatedAt\n        answerChosenAt\n        author { login }\n        category { name }\n      }\n    }\n  }\n}\n";
export declare const GRAPHQL_QUERY_DISCUSSION = "\nquery($owner: String!, $name: String!, $number: Int!) {\n  repository(owner: $owner, name: $name) {\n    discussion(number: $number) {\n      id\n      number\n      title\n      body\n      url\n      createdAt\n      updatedAt\n      answerChosenAt\n      author { login }\n      category { name }\n    }\n  }\n}\n";
export declare const GRAPHQL_QUERY_DISCUSSION_BY_ID = "\nquery($id: ID!) {\n  node(id: $id) {\n    ... on Discussion {\n      id\n      number\n      title\n      body\n      url\n      createdAt\n      updatedAt\n      answerChosenAt\n      author { login }\n      category { name }\n    }\n  }\n}\n";
export declare const GRAPHQL_MUTATION_UPDATE_DISCUSSION = "\nmutation($discussionId: ID!, $title: String, $body: String) {\n  updateDiscussion(input: {discussionId: $discussionId, title: $title, body: $body}) {\n    discussion {\n      id\n      number\n      url\n      title\n      body\n    }\n  }\n}\n";
export declare const GRAPHQL_MUTATION_ADD_DISCUSSION_COMMENT = "\nmutation($discussionId: ID!, $body: String!) {\n  addDiscussionComment(input: {discussionId: $discussionId, body: $body}) {\n    comment {\n      id\n      databaseId\n      url\n    }\n  }\n}\n";
export declare const GRAPHQL_QUERY_SEARCH_DISCUSSIONS = "\nquery($searchQuery: String!, $first: Int!) {\n  search(query: $searchQuery, type: DISCUSSION, first: $first) {\n    discussionCount\n    nodes {\n      ... on Discussion {\n        id\n        number\n        title\n        url\n        createdAt\n        updatedAt\n        author { login }\n        category { name }\n        answerChosenAt\n      }\n    }\n  }\n}\n";
/**
 * Get discussion categories
 */
export declare function getCategories(owner: string, repo: string): Promise<DiscussionCategory[]>;
/**
 * Find category by name
 */
export declare function findCategory(owner: string, repo: string, categoryName: string): Promise<DiscussionCategory | null>;
/**
 * Get discussion GraphQL ID by number
 */
export declare function getDiscussionId(owner: string, repo: string, number: number): Promise<string | null>;
//# sourceMappingURL=helpers.d.ts.map