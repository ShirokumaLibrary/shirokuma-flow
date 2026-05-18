/**
 * workflow-issue-fields rule
 *
 * Checks open issues for missing Project fields (Priority, Size).
 * Uses shirokuma-flow items list output (JSON with project fields).
 */

import { execFileAsync } from "../../utils/spawn-async.js";
import { isCancelledEquivalent } from "../../utils/status-workflow.js";
import type { WorkflowIssue, WorkflowIssueSeverity } from "../workflow-types.js";

/**
 * Table-JSON response from issues list
 */
export interface TableJsonResponse {
  columns: string[];
  rows: Array<Array<string | number | string[] | null>>;
}

const REQUIRED_FIELDS = ["priority", "size"] as const;

/**
 * Pure validation: check issue data for missing fields.
 * Exported for testing.
 */
export function validateIssueFields(
  data: TableJsonResponse,
  severity: WorkflowIssueSeverity = "warning"
): WorkflowIssue[] {
  const issues: WorkflowIssue[] = [];

  // Map columns to indices
  const colIndex: Record<string, number> = {};
  for (let i = 0; i < data.columns.length; i++) {
    colIndex[data.columns[i]] = i;
  }

  // Validate required columns exist
  const requiredCols = ["number", "title", "status", ...REQUIRED_FIELDS];
  for (const col of requiredCols) {
    if (colIndex[col] === undefined) {
      return [
        {
          type: "warning",
          message: `Invalid table-json format: missing "${col}" column`,
          rule: "issue-fields",
        },
      ];
    }
  }

  // Check each issue row
  for (const row of data.rows) {
    const issueNumber = row[colIndex["number"]] as number;
    const issueTitle = row[colIndex["title"]] as string;
    const status = row[colIndex["status"]] as string | null;

    // Done / Cancelled（LEGACY）はスキップ（#2204: Cancelled 廃止。LEGACY 値も透過マップで判定）
    if (status === "Done" || isCancelledEquivalent(status)) continue;

    for (const field of REQUIRED_FIELDS) {
      const value = row[colIndex[field]] as string | null;
      if (!value) {
        issues.push({
          type: severity,
          message: `Issue #${issueNumber} "${issueTitle}" is missing ${field} field`,
          rule: "issue-fields",
          context: `#${issueNumber}`,
        });
      }
    }
  }

  return issues;
}

/**
 * Fetch issue data and check field completeness.
 */
export async function checkIssueFields(
  severity: WorkflowIssueSeverity = "warning"
): Promise<WorkflowIssue[]> {
  // Fetch open issues via shirokuma-flow CLI
  const result = await execFileAsync(
    "shirokuma-flow",
    ["issues", "list", "--format", "table-json"],
    { timeout: 30_000 }
  );

  if (result.exitCode !== 0 || !result.stdout?.trim()) {
    return [
      {
        type: "warning",
        message: "Failed to fetch issues from GitHub. Skipping issue-fields check.",
        rule: "issue-fields",
        context: result.stderr?.trim() || "unknown error",
      },
    ];
  }

  let data: TableJsonResponse;
  try {
    data = JSON.parse(result.stdout.trim()) as TableJsonResponse;
  } catch {
    return [
      {
        type: "warning",
        message: "Failed to parse issues list output",
        rule: "issue-fields",
      },
    ];
  }

  return validateIssueFields(data, severity);
}
