/**
 * Constants used throughout shirokuma-md
 *
 * Extracting magic numbers to named constants improves code readability
 * and maintainability.
 */
/**
 * Maximum heading depth for validation (h1-h6)
 */
export const DEFAULT_MAX_HEADING_DEPTH = 6;
/**
 * Debounce delay for watch mode file changes (milliseconds)
 */
export const WATCH_DEBOUNCE_MS = 300;
/**
 * Number of characters to show in error context
 */
export const ERROR_CONTEXT_LENGTH = 60;
/**
 * Minimum number of files in directory to suggest creating overview
 */
export const OVERVIEW_THRESHOLD = 4;
/**
 * Default TOC depth for table of contents generation
 */
export const DEFAULT_TOC_DEPTH = 3;
/**
 * Maximum characters per line for markdown linting
 */
export const MAX_LINE_LENGTH = 100;
/**
 * Number of consecutive blank lines allowed
 */
export const MAX_CONSECUTIVE_BLANK_LINES = 2;
/**
 * Number of lines to show in error messages (before/after)
 */
export const ERROR_LINES_CONTEXT = 2;
/**
 * Exit codes for CLI commands
 */
export const EXIT_SUCCESS = 0;
export const EXIT_ERROR = 1;
/**
 * Common regex patterns used throughout the codebase
 */
export const REGEX_PATTERNS = {
    /** Matches markdown heading (1-6 levels): ## Title */
    HEADING: /^(#{1,6})\s+(.+)$/,
    /** Matches numbered heading: ## 1. Title or ## 1.2. Subtitle */
    NUMBERED_HEADING: /^#{1,6}\s+\d+(\.\d+)*\.\s/,
    /** Matches template variables: {{variable}} */
    TEMPLATE_VARIABLE: /\{\{([^}]+)\}\}/g,
    /** Matches list items with structural bold: - **Name**: Value */
    STRUCTURAL_BOLD_LIST: /^(\s*)[-*+]\s+\*\*[^*]+\*\*:/,
    /** Matches consecutive bold: **Field**: **Value** */
    CONSECUTIVE_BOLD: /\*\*[^*]+\*\*:\s*\*\*[^*]+\*\*/,
    /** Matches setext-style heading underline (equals) */
    SETEXT_EQUALS: /^[=]+$/,
    /** Matches setext-style heading underline (dashes) */
    SETEXT_DASHES: /^[-]+$/,
    /** Matches navigation section headings in English/Japanese */
    NAVIGATION_SECTIONS: /^##\s*(関連ドキュメント|Related Documents?|次のステップ|Next Steps?|See Also)/i,
    /** Matches Mermaid style definitions */
    MERMAID_STYLE: /^\s*style\s+\w+\s+fill:/,
    /** Matches list markers */
    LIST_MARKER: /^(\s*)([-*+])\s/,
};
//# sourceMappingURL=constants.js.map