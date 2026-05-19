/**
 * workflow-co-authored-by rule
 *
 * Detects Co-Authored-By signatures in recent commits.
 * Configurable via lintWorkflow.rules["co-authored-by"].
 */
import type { WorkflowIssue, WorkflowIssueSeverity } from "../workflow-types.js";
/**
 * Commit entry for Co-Authored-By check
 */
export interface CoAuthoredByCommit {
    hash: string;
    subject: string;
    body: string;
}
/**
 * Pure validation: check commits for Co-Authored-By signatures.
 * Exported for testing.
 */
export declare function validateCoAuthoredBy(commits: CoAuthoredByCommit[], severity?: WorkflowIssueSeverity): WorkflowIssue[];
/**
 * Gather recent commits and check for Co-Authored-By signatures.
 */
export declare function checkCoAuthoredBy(severity?: WorkflowIssueSeverity): Promise<WorkflowIssue[]>;
//# sourceMappingURL=workflow-co-authored-by.d.ts.map