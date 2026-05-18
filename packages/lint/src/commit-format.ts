import type {
  CommitFormatIssue,
  CommitFormatIssueStatus,
  LintCommitFormatConfig,
  LintCommitFormatReport,
} from './commit-format-types.js';

export interface LintCommitFormatParams {
  config: LintCommitFormatConfig;
}

const DEFAULT_TYPES = ['feat', 'fix', 'refactor', 'docs', 'test', 'chore'];
const DEFAULT_MAX_SUBJECT_LENGTH = 72;
/** Conventional Commits: `{type}` または `{type}({scope})` のあと `: {description}` */
const CONVENTIONAL_RE = /^([a-z]+)(?:\([a-z0-9-]+\))?:\s+.+/;

export function lintCommitFormat(params: LintCommitFormatParams): LintCommitFormatReport {
  const {
    commits,
    allowedTypes = DEFAULT_TYPES,
    maxSubjectLength = DEFAULT_MAX_SUBJECT_LENGTH,
    severity = 'warning',
  } = params.config;

  const issues: CommitFormatIssue[] = [];

  for (const commit of commits) {
    if (isSkippable(commit.subject)) continue;

    if (commit.subject.length > maxSubjectLength) {
      issues.push({
        rule: 'subject-too-long',
        status: 'info',
        hash: commit.hash,
        message: `Commit ${commit.hash} subject exceeds ${maxSubjectLength} characters (${commit.subject.length})`,
      });
    }

    const match = CONVENTIONAL_RE.exec(commit.subject);
    if (!match) {
      issues.push({
        rule: 'not-conventional',
        status: severity,
        hash: commit.hash,
        message: `Commit ${commit.hash} does not follow Conventional Commits: "${commit.subject}"`,
      });
      continue;
    }

    const commitType = match[1];
    if (commitType && !allowedTypes.includes(commitType)) {
      issues.push({
        rule: 'unknown-type',
        status: severity,
        hash: commit.hash,
        message: `Commit ${commit.hash} uses unknown type "${commitType}". Allowed: ${allowedTypes.join(', ')}`,
      });
    }
  }

  const counts = countBySeverity(issues);
  return {
    issues,
    summary: {
      commitsChecked: commits.length,
      errorCount: counts.error,
      warningCount: counts.warning,
      infoCount: counts.info,
    },
    passed: counts.error === 0,
  };
}

function isSkippable(subject: string): boolean {
  return subject.startsWith('Merge ') || subject.startsWith('Revert ');
}

function countBySeverity(issues: CommitFormatIssue[]): Record<CommitFormatIssueStatus, number> {
  const counts: Record<CommitFormatIssueStatus, number> = { error: 0, warning: 0, info: 0 };
  for (const i of issues) counts[i.status]++;
  return counts;
}
