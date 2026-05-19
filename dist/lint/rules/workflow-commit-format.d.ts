/**
 * workflow-commit-format rule
 *
 * Validates recent commit messages against Conventional Commits format:
 *   {type}: {description} (#{issue-number})
 *
 * Valid types: feat, fix, refactor, docs, test, chore
 * Also checks: subject line length (max 72 chars), merge commits (skipped).
 */
import type { WorkflowIssue, WorkflowIssueSeverity } from "../workflow-types.js";
/**
 * Commit data for validation
 */
export interface CommitEntry {
    hash: string;
    subject: string;
}
/**
 * Pure validation: check commit messages against Conventional Commits format.
 * Exported for testing.
 */
export declare function validateCommitFormat(commits: CommitEntry[], severity?: WorkflowIssueSeverity, allowedTypes?: string[]): WorkflowIssue[];
/**
 * Gather recent commits and validate format.
 */
export declare function checkCommitFormat(severity?: WorkflowIssueSeverity, allowedTypes?: string[], count?: number): Promise<WorkflowIssue[]>;
//# sourceMappingURL=workflow-commit-format.d.ts.map