/**
 * workflow-co-authored-by rule
 *
 * Detects Co-Authored-By signatures in recent commits.
 * Configurable via lintWorkflow.rules["co-authored-by"].
 */

import { simpleGit } from "simple-git";
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
export function validateCoAuthoredBy(
  commits: CoAuthoredByCommit[],
  severity: WorkflowIssueSeverity = "warning"
): WorkflowIssue[] {
  const issues: WorkflowIssue[] = [];

  for (const commit of commits) {
    if (
      /Co-Authored-By:/i.test(commit.body) ||
      /Co-Authored-By:/i.test(commit.subject)
    ) {
      issues.push({
        type: severity,
        message: `Commit ${commit.hash} "${commit.subject}" contains Co-Authored-By signature`,
        rule: "co-authored-by",
        context: commit.hash,
      });
    }
  }

  return issues;
}

/**
 * Gather recent commits and check for Co-Authored-By signatures.
 */
export async function checkCoAuthoredBy(
  severity: WorkflowIssueSeverity = "warning"
): Promise<WorkflowIssue[]> {
  const git = simpleGit();
  const recentCommits: CoAuthoredByCommit[] = [];

  try {
    const commitLogResult = await git.raw([
      "log", "--format=%H%x00%s%x00%b%x00", "-20",
    ]);

    if (commitLogResult?.trim()) {
      const parts = commitLogResult.split("\0");
      for (let i = 0; i + 2 < parts.length; i += 3) {
        const rawHash = parts[i].trim();
        if (!rawHash) continue;
        const hash = rawHash.substring(0, 7);
        const subject = parts[i + 1];
        const body = parts[i + 2];
        recentCommits.push({ hash, subject, body });
      }
    }
  } catch {
    // log 失敗時は空配列のまま
  }

  return validateCoAuthoredBy(recentCommits, severity);
}
