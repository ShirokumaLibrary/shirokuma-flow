export type DocIssueSeverity = 'error' | 'warning' | 'info';

export interface DocIssue {
  type: DocIssueSeverity;
  message: string;
  file: string;
  line?: number;
  rule?: string;
}

export interface DocValidationResult {
  valid: boolean;
  errors: DocIssue[];
  warnings: DocIssue[];
  infos: DocIssue[];
}

export interface SectionRule {
  pattern: string;
  description: string;
  required: boolean;
}

export interface FrontmatterFieldRule {
  name: string;
  values?: string[];
  format?: string;
}

export interface FrontmatterRule {
  required: boolean;
  fields: FrontmatterFieldRule[];
}

export interface LengthRule {
  minLength?: number;
  maxLength?: number;
}

export interface FileValidationConfig {
  file: string;
  description: string;
  sections?: SectionRule[];
  minLength?: number;
  maxLength?: number;
  frontmatter?: FrontmatterRule;
}

export interface FilePatternValidationConfig {
  filePattern: string;
  description: string;
  minCount?: number;
  sections?: SectionRule[];
  frontmatter?: FrontmatterRule;
}

export interface LinkValidationConfig {
  enabled: boolean;
  checkInternal: boolean;
}

export interface CompactTableConfig {
  enabled: boolean;
  include?: string[];
  exclude?: string[];
}

export interface ArtifactCrossRefConfig {
  enabled: boolean;
  include?: string[];
  exclude?: string[];
  /** Files exempt from cross-reference warnings (ADR-0027 §5 index type). */
  indexTypeRules?: string[];
  /** Markdown link URL substrings that trigger a warning. Defaults applied when omitted. */
  forbiddenPathPatterns?: string[];
}

export interface LintDocsConfig {
  required: Array<FileValidationConfig | FilePatternValidationConfig>;
  validateLinks?: LinkValidationConfig;
  compactTable?: CompactTableConfig;
  artifactCrossRef?: ArtifactCrossRefConfig;
}

export interface FileValidationReport {
  file: string;
  description: string;
  result: DocValidationResult;
}

export interface PatternValidationReport {
  pattern: string;
  description: string;
  matchedFiles: string[];
  fileResults: FileValidationReport[];
  result: DocValidationResult;
}

export interface LintDocsReport {
  fileResults: FileValidationReport[];
  patternResults: PatternValidationReport[];
  compactTableResults?: FileValidationReport[];
  artifactCrossRefResults?: FileValidationReport[];
  summary: {
    totalFiles: number;
    validatedFiles: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
  };
  passed: boolean;
}

export function isFileConfig(
  config: FileValidationConfig | FilePatternValidationConfig,
): config is FileValidationConfig {
  return 'file' in config;
}

export function isPatternConfig(
  config: FileValidationConfig | FilePatternValidationConfig,
): config is FilePatternValidationConfig {
  return 'filePattern' in config;
}
