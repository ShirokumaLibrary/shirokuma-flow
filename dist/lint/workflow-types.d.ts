/**
 * lint-workflow type definitions
 *
 * Types for AI workflow validation (issue fields, branch naming, main protection, commit format)
 */
/**
 * Workflow issue severity
 */
export type WorkflowIssueSeverity = "error" | "warning" | "info";
/**
 * A detected workflow issue
 */
export interface WorkflowIssue {
    /** Severity level */
    type: WorkflowIssueSeverity;
    /** Description of the issue */
    message: string;
    /** Rule that detected it */
    rule: string;
    /** Additional context (e.g., issue number, branch name) */
    context?: string;
}
/**
 * Result of a single rule check
 */
export interface WorkflowRuleResult {
    /** Rule ID */
    rule: string;
    /** Rule description */
    description: string;
    /** Detected issues */
    issues: WorkflowIssue[];
    /** Whether this rule passed (no errors) */
    passed: boolean;
}
/**
 * Full lint-workflow report
 */
export interface LintWorkflowReport {
    /** Results per rule */
    ruleResults: WorkflowRuleResult[];
    /** Summary counts */
    summary: {
        totalChecks: number;
        errorCount: number;
        warningCount: number;
        infoCount: number;
    };
    /** Overall pass/fail (no errors) */
    passed: boolean;
}
/**
 * lint-workflow configuration
 */
export interface LintWorkflowConfig {
    /** Enable lint-workflow */
    enabled: boolean;
    /** Strict mode (exit 1 on any error) */
    strict: boolean;
    /** Per-rule configuration */
    rules?: {
        /** Issue field completeness check */
        "issue-fields"?: {
            severity?: WorkflowIssueSeverity;
            enabled?: boolean;
        };
        /** Branch naming convention check */
        "branch-naming"?: {
            severity?: WorkflowIssueSeverity;
            enabled?: boolean;
            /** Allowed branch prefixes */
            prefixes?: string[];
        };
        /** Main branch protection check */
        "main-protection"?: {
            severity?: WorkflowIssueSeverity;
            enabled?: boolean;
            /** Protected branch names */
            branches?: string[];
        };
        /** Conventional Commits format check */
        "commit-format"?: {
            severity?: WorkflowIssueSeverity;
            enabled?: boolean;
            /** Allowed commit types */
            types?: string[];
        };
        /** Co-Authored-By signature detection */
        "co-authored-by"?: {
            severity?: WorkflowIssueSeverity;
            enabled?: boolean;
        };
    };
}
//# sourceMappingURL=workflow-types.d.ts.map