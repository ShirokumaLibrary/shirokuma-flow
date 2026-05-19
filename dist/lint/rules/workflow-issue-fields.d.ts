/**
 * workflow-issue-fields rule
 *
 * Checks open issues for missing Project fields (Priority, Size).
 * Uses shirokuma-docs items list output (JSON with project fields).
 */
import type { WorkflowIssue, WorkflowIssueSeverity } from "../workflow-types.js";
/**
 * Table-JSON response from issues list
 */
export interface TableJsonResponse {
    columns: string[];
    rows: Array<Array<string | number | string[] | null>>;
}
/**
 * Pure validation: check issue data for missing fields.
 * Exported for testing.
 */
export declare function validateIssueFields(data: TableJsonResponse, severity?: WorkflowIssueSeverity): WorkflowIssue[];
/**
 * Fetch issue data and check field completeness.
 */
export declare function checkIssueFields(severity?: WorkflowIssueSeverity): Promise<WorkflowIssue[]>;
//# sourceMappingURL=workflow-issue-fields.d.ts.map