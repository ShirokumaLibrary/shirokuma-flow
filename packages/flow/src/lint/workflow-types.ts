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
    /** CLAUDE.md 行数上限チェック（ADR-v3-021） */
    "claude-md-budget"?: {
      severity?: WorkflowIssueSeverity;
      enabled?: boolean;
      /** 最大行数（デフォルト: 150） */
      maxLines?: number;
    };
    /** CLAUDE.md と index ファイルの整合性チェック（ADR-v3-021） */
    "claude-md-index-drift"?: {
      severity?: WorkflowIssueSeverity;
      enabled?: boolean;
      /** index ファイルが配置されるディレクトリ（デフォルト: .shirokuma/rules/shirokuma-flow） */
      indexDir?: string;
    };
    /** SKILL.md 行数上限チェック（Issue #2498） */
    "skill-md-size"?: {
      enabled?: boolean;
      /** 警告閾値（デフォルト: 250） */
      warnLines?: number;
      /** エラー閾値（デフォルト: 400） */
      errorLines?: number;
      /** スキャン対象のプラグインディレクトリ（デフォルト: ["plugin/shirokuma-skills-ja", "plugin/shirokuma-skills-en"]） */
      pluginDirs?: string[];
    };
  };
}
