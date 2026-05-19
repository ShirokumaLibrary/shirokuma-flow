/**
 * projects command - Shared helpers, types, and GraphQL queries
 *
 * Used by all projects subcommand handlers.
 */
import { runGraphQL, getOwner, getRepoName, isIssueNumber, parseIssueNumber, GhResult } from "../../utils/github.js";
import { getProjectId, fetchWorkflows, RECOMMENDED_WORKFLOWS, type ProjectWorkflow } from "../../utils/project-utils.js";
export { getProjectId, fetchWorkflows, RECOMMENDED_WORKFLOWS, type ProjectWorkflow, };
export { runGraphQL, getOwner, getRepoName, isIssueNumber, parseIssueNumber, };
export type { GhResult };
export { DEFAULT_EXCLUDE_STATUSES } from "../../utils/status-workflow.js";
export interface ProjectsOptions {
    owner?: string;
    verbose?: boolean;
    all?: boolean;
    status?: string[];
    force?: boolean;
    format?: OutputFormat;
    fieldStatus?: string;
    priority?: string;
    size?: string;
    title?: string;
    bodyFile?: string;
}
export interface ProjectInfo {
    id: string;
    title: string;
    owner: string;
}
export interface ProjectItem {
    id: string;
    title: string | null;
    body?: string | null;
    status: string | null;
    statusOptionId?: string | null;
    priority: string | null;
    priorityOptionId?: string | null;
    size: string | null;
    sizeOptionId?: string | null;
    issueNumber: number | null;
    issueUrl?: string | null;
    draftIssueId?: string | null;
    project?: {
        id: string;
        title: string;
    };
}
import { OutputFormat } from "../../utils/formatters.js";
export declare const GRAPHQL_QUERY_LIST = "\nquery($projectId: ID!, $cursor: String) {\n  node(id: $projectId) {\n    ... on ProjectV2 {\n      title\n      items(first: 100, after: $cursor) {\n        pageInfo { hasNextPage endCursor }\n        nodes {\n          id\n          status: fieldValueByName(name: \"Status\") {\n            ... on ProjectV2ItemFieldSingleSelectValue { name }\n          }\n          priority: fieldValueByName(name: \"Priority\") {\n            ... on ProjectV2ItemFieldSingleSelectValue { name }\n          }\n          size: fieldValueByName(name: \"Size\") {\n            ... on ProjectV2ItemFieldSingleSelectValue { name }\n          }\n          content {\n            ... on DraftIssue { title }\n            ... on Issue { title number }\n          }\n        }\n      }\n    }\n  }\n}\n";
export declare const GRAPHQL_QUERY_ITEM = "\nquery($itemId: ID!) {\n  node(id: $itemId) {\n    ... on ProjectV2Item {\n      id\n      status: fieldValueByName(name: \"Status\") {\n        ... on ProjectV2ItemFieldSingleSelectValue { name optionId }\n      }\n      priority: fieldValueByName(name: \"Priority\") {\n        ... on ProjectV2ItemFieldSingleSelectValue { name optionId }\n      }\n      size: fieldValueByName(name: \"Size\") {\n        ... on ProjectV2ItemFieldSingleSelectValue { name optionId }\n      }\n      content {\n        ... on DraftIssue { id title body }\n        ... on Issue { id title number body url }\n      }\n      project { id title }\n    }\n  }\n}\n";
export declare const GRAPHQL_MUTATION_CREATE = "\nmutation($projectId: ID!, $title: String!, $body: String) {\n  addProjectV2DraftIssue(input: {projectId: $projectId, title: $title, body: $body}) {\n    projectItem { id }\n  }\n}\n";
export declare const GRAPHQL_MUTATION_UPDATE_BODY = "\nmutation($draftIssueId: ID!, $body: String!) {\n  updateProjectV2DraftIssue(input: {draftIssueId: $draftIssueId, body: $body}) {\n    draftIssue { id body }\n  }\n}\n";
export declare const GRAPHQL_MUTATION_UPDATE_ISSUE = "\nmutation($id: ID!, $body: String!) {\n  updateIssue(input: {id: $id, body: $body}) {\n    issue { id number title body }\n  }\n}\n";
export declare const GRAPHQL_QUERY_ISSUE_BY_NUMBER = "\nquery($owner: String!, $name: String!, $number: Int!) {\n  repository(owner: $owner, name: $name) {\n    issue(number: $number) {\n      id\n      number\n      title\n      body\n      url\n    }\n  }\n}\n";
/**
 * Fetch all project items with pagination
 */
export declare function fetchAllItems(projectId: string): Promise<{
    title: string;
    items: ProjectItem[];
}>;
/**
 * Fetch a single project item by ID with full details
 */
export declare function fetchItem(itemId: string): Promise<ProjectItem | null>;
/**
 * Find project item by issue number
 */
export declare function findItemByIssueNumber(projectId: string, issueNumber: number): Promise<{
    id: string;
} | null>;
/**
 * Get issue by number
 */
export declare function getIssueByNumber(owner: string, repo: string, number: number): Promise<{
    id: string;
    number: number;
    title: string;
    body: string;
    url: string;
} | null>;
/**
 * Build project field dict from options for setItemFields.
 * Extracts Status/Priority/Size from ProjectsOptions.
 */
export declare function buildFieldsDict(options: Pick<ProjectsOptions, "fieldStatus" | "priority" | "size">): Record<string, string>;
//# sourceMappingURL=helpers.d.ts.map