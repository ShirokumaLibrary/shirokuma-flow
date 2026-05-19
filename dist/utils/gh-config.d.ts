/**
 * GitHub CLI Configuration
 *
 * Reads GitHub settings from `shirokuma-docs.config.yaml` (github section).
 */
/** Repo pair configuration */
export interface RepoPairConfig {
    /** Pair alias (key from config) */
    alias: string;
    /** Private repository (owner/name) */
    private: string;
    /** Public repository (owner/name) */
    public: string;
    /** Files/directories to exclude from public release */
    exclude: string[];
    /** Default branch name */
    defaultBranch: string;
    /** Source directory within private repo (default: project root) */
    sourceDir?: string;
}
/** ラベル自動作成ルール */
export interface LabelRule {
    /** グロブ風パターン（例: "area:*", "dep:*"） */
    pattern: string;
    /** ラベルの色（# なしの 6 桁 hex、例: "6f42c1"） */
    color: string;
    /** ラベルの説明（省略可） */
    description?: string;
}
/** Metrics configuration for automatic timestamp recording */
export interface MetricsConfig {
    /** Enable metrics tracking (default: false) */
    enabled?: boolean;
    /** Status → Text field mapping (e.g., "In Progress" → "Start at") */
    statusToDateMapping?: Record<string, string | string[]>;
    /** Days before an In Progress issue is considered stale (default: 14) */
    staleThresholdDays?: number;
}
/** Configuration structure */
export interface GhConfig {
    /** Default category for discussions (e.g., "Handovers") */
    discussionsCategory?: string;
    /** Default limit for list commands */
    listLimit?: number;
    /** Default Status for newly created issues (e.g., "Backlog") */
    defaultStatus?: string;
    /** Labels for issue types */
    labels?: {
        feature?: string;
        bug?: string;
        chore?: string;
        docs?: string;
        research?: string;
    };
    /** Public/Private repo pairs */
    repoPairs?: Record<string, {
        private: string;
        public: string;
        exclude?: string[];
        defaultBranch?: string;
        sourceDir?: string;
    }>;
    /** Cross-repository references (alias → owner/repo) */
    crossRepos?: Record<string, string>;
    /** Metrics configuration for automatic timestamp recording */
    metrics?: MetricsConfig;
    /** ラベル自動作成ルール */
    labelRules?: LabelRule[];
}
/**
 * Load configuration from file(s) or return defaults.
 *
 * Supports config inheritance: finds all config files from CWD up to root,
 * then merges them from farthest (workspace root) to nearest (project-specific).
 * This allows workspace-level settings (repoPairs, crossRepos) to be inherited
 * by project-specific configs in subdirectories.
 */
export declare function loadGhConfig(projectPath?: string): GhConfig;
/**
 * Get default discussions category
 */
export declare function getDefaultCategory(config?: GhConfig): string;
/**
 * Get default list limit
 */
export declare function getDefaultLimit(config?: GhConfig): number;
/**
 * Get default status for new issues
 */
export declare function getDefaultStatus(config?: GhConfig): string;
/**
 * Get label for issue type
 */
export declare function getTypeLabel(type: "feature" | "bug" | "chore" | "docs" | "research", config?: GhConfig): string;
/**
 * Get metrics configuration with defaults applied.
 * Returns null if metrics is not configured at all.
 */
export declare function getMetricsConfig(config?: GhConfig): MetricsConfig;
/**
 * Clear cached config (for testing)
 */
export declare function clearConfigCache(): void;
//# sourceMappingURL=gh-config.d.ts.map