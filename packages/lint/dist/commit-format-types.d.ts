export type CommitFormatIssueRule = 'subject-too-long' | 'not-conventional' | 'unknown-type';
export type CommitFormatIssueStatus = 'error' | 'warning' | 'info';
export interface CommitEntry {
    hash: string;
    subject: string;
}
export interface CommitFormatIssue {
    rule: CommitFormatIssueRule;
    status: CommitFormatIssueStatus;
    hash: string;
    message: string;
}
export interface LintCommitFormatConfig {
    commits: CommitEntry[];
    /** 既定: `feat` / `fix` / `refactor` / `docs` / `test` / `chore` */
    allowedTypes?: string[];
    /** 既定: 72。subject 文字長の上限（超過は info） */
    maxSubjectLength?: number;
    /** not-conventional / unknown-type の severity。既定: `warning` */
    severity?: 'error' | 'warning';
}
export interface LintCommitFormatReport {
    issues: CommitFormatIssue[];
    summary: {
        commitsChecked: number;
        errorCount: number;
        warningCount: number;
        infoCount: number;
    };
    passed: boolean;
}
//# sourceMappingURL=commit-format-types.d.ts.map