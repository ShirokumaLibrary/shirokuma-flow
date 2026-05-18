import type { Document } from './document.js';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: Issue[];
  warnings: Issue[];
  info: Issue[];
}

/**
 * Issue structure
 */
export interface Issue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  file: string;
  line?: number;
  column?: number;
  rule: string;
}

/**
 * Validator interface
 */
export interface Validator {
  name: string;
  validate(document: Document): Promise<Issue[]>;
}

/**
 * Linter interface
 */
export interface Linter {
  name: string;
  lint(document: Document): Promise<Issue[]>;
  fix?(document: Document): Promise<Document>;
}

/**
 * Analyzer interface
 */
export interface Analyzer {
  name: string;
  analyze(documents: Document[]): Promise<AnalysisResult>;
}

/**
 * Heading node in document structure
 */
export interface HeadingNode {
  level: number;
  text: string;
  startLine: number;
  endLine: number;
  children: HeadingNode[];
}

/**
 * File metrics
 */
export interface FileMetrics {
  file: string;
  size: number;
  lines: number;
  tokens: number;
  headings: HeadingNode[];
  topLevelSections: number;
}

/**
 * Split suggestion for a file
 */
export interface SplitSuggestion {
  file: string;
  reason: string;
  currentSize: number;
  currentTokens: number;
  suggestedSplits: Array<{
    heading: string;
    level: number;
    startLine: number;
    endLine: number;
    estimatedLines: number;
    estimatedTokens: number;
  }>;
}

/**
 * Analysis result
 */
export interface AnalysisResult {
  totalFiles: number;
  dependencies: DependencyEdge[];
  orphans: string[];
  cycles: string[][];
  mostReferenced: Array<{ file: string; count: number }>;
  fileMetrics?: FileMetrics[];
  splitSuggestions?: SplitSuggestion[];
  totalTokens?: number;
  averageTokensPerFile?: number;
}

/**
 * Dependency edge
 */
export interface DependencyEdge {
  from: string;
  to: string;
  type: 'frontmatter' | 'wiki-link' | 'markdown-link';
}
