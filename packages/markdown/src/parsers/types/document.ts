/**
 * Document frontmatter structure
 */
export interface DocumentFrontmatter {
  version?: string;
  layer?: string;
  category?: string;
  last_updated?: string;
  dependencies?: string[];
  tags?: string[];
  schema?: string;
  [key: string]: unknown;
}

/**
 * Document structure
 */
export interface Document {
  path: string;
  frontmatter: DocumentFrontmatter;
  content: string;
  sections: Section[];
}

/**
 * Section structure
 */
export interface Section {
  level: number;
  title: string;
  content: string;
  subsections: Section[];
  meta?: Record<string, unknown>;
}

/**
 * Section metadata (re-exported from parser)
 */
export type { SectionMeta, SectionMetaExtractionResult } from '../section-meta.js';
