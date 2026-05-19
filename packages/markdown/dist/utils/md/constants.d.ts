/**
 * Constants used throughout shirokuma-md
 *
 * Extracting magic numbers to named constants improves code readability
 * and maintainability.
 */
/**
 * Maximum heading depth for validation (h1-h6)
 */
export declare const DEFAULT_MAX_HEADING_DEPTH = 6;
/**
 * Debounce delay for watch mode file changes (milliseconds)
 */
export declare const WATCH_DEBOUNCE_MS = 300;
/**
 * Number of characters to show in error context
 */
export declare const ERROR_CONTEXT_LENGTH = 60;
/**
 * Minimum number of files in directory to suggest creating overview
 */
export declare const OVERVIEW_THRESHOLD = 4;
/**
 * Default TOC depth for table of contents generation
 */
export declare const DEFAULT_TOC_DEPTH = 3;
/**
 * Maximum characters per line for markdown linting
 */
export declare const MAX_LINE_LENGTH = 100;
/**
 * Number of consecutive blank lines allowed
 */
export declare const MAX_CONSECUTIVE_BLANK_LINES = 2;
/**
 * Number of lines to show in error messages (before/after)
 */
export declare const ERROR_LINES_CONTEXT = 2;
/**
 * Exit codes for CLI commands
 */
export declare const EXIT_SUCCESS = 0;
export declare const EXIT_ERROR = 1;
/**
 * Common regex patterns used throughout the codebase
 */
export declare const REGEX_PATTERNS: {
    /** Matches markdown heading (1-6 levels): ## Title */
    readonly HEADING: RegExp;
    /** Matches numbered heading: ## 1. Title or ## 1.2. Subtitle */
    readonly NUMBERED_HEADING: RegExp;
    /** Matches template variables: {{variable}} */
    readonly TEMPLATE_VARIABLE: RegExp;
    /** Matches list items with structural bold: - **Name**: Value */
    readonly STRUCTURAL_BOLD_LIST: RegExp;
    /** Matches consecutive bold: **Field**: **Value** */
    readonly CONSECUTIVE_BOLD: RegExp;
    /** Matches setext-style heading underline (equals) */
    readonly SETEXT_EQUALS: RegExp;
    /** Matches setext-style heading underline (dashes) */
    readonly SETEXT_DASHES: RegExp;
    /** Matches navigation section headings in English/Japanese */
    readonly NAVIGATION_SECTIONS: RegExp;
    /** Matches Mermaid style definitions */
    readonly MERMAID_STYLE: RegExp;
    /** Matches list markers */
    readonly LIST_MARKER: RegExp;
};
//# sourceMappingURL=constants.d.ts.map