/**
 * GitHub Data Generator
 *
 * Fetches GitHub Issues, Discussions, and repository info,
 * then saves as JSON for portal integration.
 */
import { resolve } from "node:path";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createLogger } from "../../utils/logger.js";
import { t } from "../../utils/i18n.js";
import { getRepoInfo, runGraphQL } from "../../utils/github.js";
import { loadGhConfig } from "../../utils/gh-config.js";
import { STATUS_VALUES, isBlockedEquivalent } from "../../utils/status-workflow.js";
const GRAPHQL_QUERY_REPO_INFO = `
query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    owner { login }
    name
    nameWithOwner
    description
    url
    defaultBranchRef { name }
    visibility
    stargazerCount
    forkCount
    issues(states: OPEN) { totalCount }
    pullRequests(states: OPEN) { totalCount }
  }
}
`;
/**
 * Fetch repository info via GraphQL
 */
async function fetchRepoInfo() {
    const repoInfo = getRepoInfo();
    if (!repoInfo) {
        throw new Error("Failed to get repository info");
    }
    const { owner, name } = repoInfo;
    const result = await runGraphQL(GRAPHQL_QUERY_REPO_INFO, { owner, name });
    if (!result.success) {
        throw new Error(`Failed to fetch repo info: ${result.error}`);
    }
    if (!result.data?.data?.repository) {
        throw new Error("Failed to fetch repo info: no repository data");
    }
    const r = result.data.data.repository;
    return {
        owner: r.owner?.login || "",
        name: r.name || "",
        fullName: r.nameWithOwner || "",
        description: r.description ?? null,
        url: r.url || "",
        defaultBranch: r.defaultBranchRef?.name || "main",
        visibility: r.visibility || "private",
        stargazers: r.stargazerCount || 0,
        forks: r.forkCount || 0,
        issues: r.issues?.totalCount || 0,
        pullRequests: r.pullRequests?.totalCount || 0,
    };
}
/**
 * Fetch a single page of issues
 */
async function fetchIssuesPage(owner, name, cursor) {
    const query = `
    query($owner: String!, $repo: String!, $cursor: String) {
      repository(owner: $owner, name: $repo) {
        issues(first: 100, after: $cursor, states: [OPEN]) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            number
            title
            url
            state
            createdAt
            updatedAt
            labels(first: 10) {
              nodes { name }
            }
            projectItems(first: 1) {
              nodes {
                project { title }
                fieldValues(first: 10) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field { ... on ProjectV2SingleSelectField { name } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
    const result = await runGraphQL(query, {
        owner,
        repo: name,
        cursor,
    });
    if (!result.success) {
        return { connection: undefined, error: result.error };
    }
    return { connection: result.data?.data?.repository?.issues };
}
/**
 * Parse a GraphQL issue node into a GithubIssue
 */
function parseIssueNode(issue) {
    const projectItem = issue.projectItems?.nodes?.[0];
    const fieldValues = projectItem?.fieldValues?.nodes || [];
    const getFieldValue = (fieldName) => {
        const field = fieldValues.find((f) => f.field?.name === fieldName);
        return field?.name || null;
    };
    return {
        number: issue.number,
        title: issue.title,
        url: issue.url,
        state: issue.state,
        labels: issue.labels?.nodes?.map((l) => l.name) || [],
        status: getFieldValue("Status"),
        priority: getFieldValue("Priority"),
        size: getFieldValue("Size"),
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
    };
}
/**
 * Fetch issues with project fields using GraphQL
 */
async function fetchIssuesWithProjects() {
    const repoInfo = getRepoInfo();
    if (!repoInfo) {
        throw new Error("Failed to get repository info");
    }
    const { owner, name } = repoInfo;
    const issues = [];
    let cursor = null;
    for (;;) {
        const { connection, error } = await fetchIssuesPage(owner, name, cursor);
        if (error) {
            throw new Error(`GraphQL query failed: ${error}`);
        }
        if (!connection?.nodes) {
            break;
        }
        for (const node of connection.nodes) {
            issues.push(parseIssueNode(node));
        }
        if (connection.pageInfo?.hasNextPage && connection.pageInfo.endCursor) {
            cursor = connection.pageInfo.endCursor;
        }
        else {
            break;
        }
    }
    return issues;
}
/**
 * Fetch a single page of discussions
 */
async function fetchDiscussionsPage(owner, name, cursor) {
    const query = `
    query($owner: String!, $repo: String!, $cursor: String) {
      repository(owner: $owner, name: $repo) {
        discussions(first: 50, after: $cursor, orderBy: {field: CREATED_AT, direction: DESC}) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            number
            title
            url
            body
            createdAt
            updatedAt
            author { login }
            category { name }
          }
        }
      }
    }
  `;
    const result = await runGraphQL(query, {
        owner,
        repo: name,
        cursor,
    });
    if (!result.success) {
        return { connection: undefined, error: result.error };
    }
    return { connection: result.data?.data?.repository?.discussions };
}
/**
 * Fetch discussions by category
 */
async function fetchDiscussions(categoryName) {
    const repoInfo = getRepoInfo();
    if (!repoInfo) {
        throw new Error("Failed to get repository info");
    }
    const { owner, name } = repoInfo;
    const discussions = [];
    let cursor = null;
    for (;;) {
        const { connection, error } = await fetchDiscussionsPage(owner, name, cursor);
        if (error) {
            throw new Error(`GraphQL query failed: ${error}`);
        }
        if (!connection?.nodes) {
            break;
        }
        for (const disc of connection.nodes) {
            if (disc.category?.name === categoryName) {
                discussions.push({
                    number: disc.number,
                    title: disc.title,
                    url: disc.url,
                    category: disc.category.name,
                    author: disc.author?.login || "unknown",
                    createdAt: disc.createdAt,
                    updatedAt: disc.updatedAt,
                    body: disc.body,
                });
            }
        }
        if (connection.pageInfo?.hasNextPage && connection.pageInfo.endCursor) {
            cursor = connection.pageInfo.endCursor;
        }
        else {
            break;
        }
    }
    return discussions;
}
/** Group issues by status. Pending / Ready は Backlog 扱い、On Hold は Blocked 扱い（旧表記吸収） */
function groupIssuesByStatus(issues) {
    const groups = {
        inProgress: [],
        backlog: [],
        done: [],
        total: issues.length,
    };
    for (const issue of issues) {
        if (issue.status === STATUS_VALUES.IN_PROGRESS ||
            isBlockedEquivalent(issue.status) ||
            issue.status === STATUS_VALUES.REVIEW ||
            issue.status === STATUS_VALUES.COMPLETED) {
            groups.inProgress.push(issue);
        }
        else if (issue.status === STATUS_VALUES.DONE) {
            groups.done.push(issue);
        }
        else {
            groups.backlog.push(issue);
        }
    }
    const priorityOrder = {
        Critical: 0,
        High: 1,
        Medium: 2,
        Low: 3,
    };
    const sortByPriority = (a, b) => {
        const aPriority = priorityOrder[a.priority || "Low"] ?? 4;
        const bPriority = priorityOrder[b.priority || "Low"] ?? 4;
        return aPriority - bPriority;
    };
    groups.inProgress.sort(sortByPriority);
    groups.backlog.sort(sortByPriority);
    return groups;
}
/**
 * Generate GitHub data JSON
 */
export async function githubDataCommand(options) {
    const logger = createLogger(options.verbose);
    const projectPath = resolve(options.project);
    logger.info(t("commands.githubData.fetching"));
    // Load config for category names
    const ghConfig = loadGhConfig(projectPath);
    const handoverCategory = ghConfig.discussionsCategory || "Handovers";
    const specsCategory = "Specs";
    // Fetch all data
    let repoInfo = null;
    let issues = [];
    let handovers = [];
    let specs = [];
    try {
        repoInfo = await fetchRepoInfo();
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        logger.warn(`Repository info fetch failed: ${message}`);
    }
    try {
        issues = await fetchIssuesWithProjects();
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        logger.warn(`Issues fetch failed: ${message}`);
    }
    try {
        handovers = await fetchDiscussions(handoverCategory);
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        logger.warn(`Handovers fetch failed: ${message}`);
    }
    try {
        specs = await fetchDiscussions(specsCategory);
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        logger.warn(`Specs fetch failed: ${message}`);
    }
    const githubData = {
        repository: repoInfo || {
            owner: "",
            name: "",
            fullName: "",
            description: null,
            url: "",
            defaultBranch: "main",
            visibility: "private",
            stargazers: 0,
            forks: 0,
            issues: 0,
            pullRequests: 0,
        },
        issues: groupIssuesByStatus(issues),
        handovers,
        specs,
        fetchedAt: new Date().toISOString(),
    };
    // Write to output file if specified
    if (options.output) {
        const outputDir = resolve(options.output);
        if (!existsSync(outputDir)) {
            mkdirSync(outputDir, { recursive: true });
        }
        const outputPath = resolve(outputDir, "github-data.json");
        writeFileSync(outputPath, JSON.stringify(githubData, null, 2));
        logger.success(`GitHub データを保存: ${outputPath}`);
    }
    // Summary
    logger.info("=== GitHub Data Summary ===");
    logger.info(`Repository: ${githubData.repository.fullName}`);
    logger.info(`Issues: ${githubData.issues.total} total`);
    logger.info(`  - In Progress: ${githubData.issues.inProgress.length}`);
    logger.info(`  - Backlog: ${githubData.issues.backlog.length}`);
    logger.info(`  - Done: ${githubData.issues.done.length}`);
    logger.info(`Handovers: ${githubData.handovers.length}`);
    logger.info(`Specs: ${githubData.specs.length}`);
    return githubData;
}
//# sourceMappingURL=github-data.js.map