/**
 * workflow-branch-naming rule
 *
 * Validates the current git branch name against the convention:
 *   {type}/{issue-number}-{slug}
 *
 * Valid types: feat, fix, chore, docs, hotfix, epic, release
 * Persistent branches (main, develop) are always valid.
 */
import type { WorkflowIssue, WorkflowIssueSeverity } from "../workflow-types.js";
/**
 * Pure validation: validate a branch name against naming convention.
 * Exported for testing.
 */
export declare function validateBranchName(branchName: string, severity?: WorkflowIssueSeverity, allowedPrefixes?: string[]): WorkflowIssue[];
/**
 * Get current branch and check naming convention.
 */
export declare function checkBranchNaming(severity?: WorkflowIssueSeverity, allowedPrefixes?: string[]): WorkflowIssue[];
//# sourceMappingURL=workflow-branch-naming.d.ts.map