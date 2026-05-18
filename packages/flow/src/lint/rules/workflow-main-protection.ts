/**
 * workflow-main-protection rule
 *
 * Detects direct commits on protected branches (main, develop).
 * Checks if the current branch is a protected branch and warns accordingly.
 */

import { simpleGit } from "simple-git";
import type { WorkflowIssue, WorkflowIssueSeverity } from "../workflow-types.js";
import { getCurrentBranch } from "../../utils/git-local.js";

const DEFAULT_PROTECTED_BRANCHES = ["main", "develop"];

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
export function validateMainProtection(
  state: GitProtectionState,
  severity: WorkflowIssueSeverity = "error",
  protectedBranches: string[] = DEFAULT_PROTECTED_BRANCHES
): WorkflowIssue[] {
  const issues: WorkflowIssue[] = [];

  // Check if on a protected branch
  if (protectedBranches.includes(state.currentBranch)) {
    if (state.hasUncommittedChanges) {
      issues.push({
        type: severity,
        message: `Uncommitted changes detected on protected branch "${state.currentBranch}". Create a feature branch first.`,
        rule: "main-protection",
        context: state.currentBranch,
      });
    }

    if (state.directCommitCount > 0) {
      issues.push({
        type: severity,
        message: `${state.directCommitCount} direct (non-merge) commit(s) on protected branch "${state.currentBranch}". Use feature branches with PRs.`,
        rule: "main-protection",
        context: state.currentBranch,
      });
    }
  }

  return issues;
}

/**
 * Gather git state and run main-protection checks.
 */
export async function checkMainProtection(
  severity: WorkflowIssueSeverity = "error",
  protectedBranches: string[] = DEFAULT_PROTECTED_BRANCHES
): Promise<WorkflowIssue[]> {
  // Get current branch name
  const currentBranch = getCurrentBranch();

  if (!currentBranch) {
    return [
      {
        type: "info",
        message: "Could not determine current branch. Skipping main-protection check.",
        rule: "main-protection",
      },
    ];
  }

  const git = simpleGit();

  // Gather state
  let hasUncommittedChanges = false;
  let directCommitCount = 0;

  if (protectedBranches.includes(currentBranch)) {
    // Check uncommitted changes
    try {
      const status = await git.status();
      hasUncommittedChanges = status.files.length > 0;
    } catch {
      // git status 失敗時は false のまま
    }

    // Check direct commits
    try {
      const logResult = await git.raw([
        "log", "--oneline", "--no-merges", "-10", `origin/${currentBranch}..HEAD`,
      ]);
      if (logResult?.trim()) {
        directCommitCount = logResult
          .trim()
          .split("\n")
          .filter((l) => l.length > 0).length;
      }
    } catch {
      // log 失敗時は 0 のまま
    }
  }

  return validateMainProtection(
    { currentBranch, hasUncommittedChanges, directCommitCount },
    severity,
    protectedBranches
  );
}
