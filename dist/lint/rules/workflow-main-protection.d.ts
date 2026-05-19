/**
 * workflow-main-protection rule
 *
 * Detects direct commits on protected branches (main, develop).
 * Checks if the current branch is a protected branch and warns accordingly.
 */
import type { WorkflowIssue, WorkflowIssueSeverity } from "../workflow-types.js";
/**
 * Git state input for pure validation
 */
export interface GitProtectionState {
    currentBranch: string;
    hasUncommittedChanges: boolean;
    directCommitCount: number;
}
/**
 * Pure validation: check git state against protection rules.
 * Exported for testing.
 */
export declare function validateMainProtection(state: GitProtectionState, severity?: WorkflowIssueSeverity, protectedBranches?: string[]): WorkflowIssue[];
/**
 * Gather git state and run main-protection checks.
 */
export declare function checkMainProtection(severity?: WorkflowIssueSeverity, protectedBranches?: string[]): Promise<WorkflowIssue[]>;
//# sourceMappingURL=workflow-main-protection.d.ts.map