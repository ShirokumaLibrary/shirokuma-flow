/**
 * GitHub Data Generator
 *
 * Fetches GitHub Issues, Discussions, and repository info,
 * then saves as JSON for portal integration.
 */
export interface GithubDataOptions {
    project: string;
    output?: string;
    verbose?: boolean;
}
interface GithubIssue {
    number: number;
    title: string;
    url: string;
    state: string;
    labels: string[];
    status: string | null;
    priority: string | null;
    size: string | null;
    createdAt: string;
    updatedAt: string;
}
interface GithubDiscussion {
    number: number;
    title: string;
    url: string;
    category: string;
    author: string;
    createdAt: string;
    updatedAt: string;
    body?: string;
}
interface GithubRepoInfo {
    owner: string;
    name: string;
    fullName: string;
    description: string | null;
    url: string;
    defaultBranch: string;
    visibility: string;
    stargazers: number;
    forks: number;
    issues: number;
    pullRequests: number;
}
export interface GithubData {
    repository: GithubRepoInfo;
    issues: {
        inProgress: GithubIssue[];
        backlog: GithubIssue[];
        done: GithubIssue[];
        total: number;
    };
    handovers: GithubDiscussion[];
    specs: GithubDiscussion[];
    fetchedAt: string;
}
/**
 * Generate GitHub data JSON
 */
export declare function githubDataCommand(options: GithubDataOptions): Promise<GithubData>;
export {};
//# sourceMappingURL=github-data.d.ts.map