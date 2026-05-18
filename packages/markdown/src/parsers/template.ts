import * as fs from 'fs/promises';
import * as path from 'path';
import matter from '@11ty/gray-matter';
import { isEnoent } from '@shirokuma-library/lint';
import { REGEX_PATTERNS } from '../utils/md/constants.js';

/**
 * Template structure
 */
export interface Template {
  /** Template file path */
  path: string;
  /** Template frontmatter */
  frontmatter: Record<string, unknown>;
  /** Template content (without frontmatter) */
  content: string;
  /** Required headings extracted from template */
  requiredHeadings: string[];
  /** Template variables ({{variable_name}}) */
  variables: string[];
}

/**
 * Load template file from templates directory
 * @param templateName - Template name (without .md extension)
 * @param templatesDir - Templates directory path
 * @returns Parsed template
 */
export async function loadTemplate(templateName: string, templatesDir: string): Promise<Template> {
  const templatePath = path.join(templatesDir, `${templateName}.md`);

  try {
    const content = await fs.readFile(templatePath, 'utf-8');
    const parsed = matter(content);

    return {
      path: templatePath,
      frontmatter: parsed.data,
      content: parsed.content,
      requiredHeadings: extractHeadings(parsed.content),
      variables: extractVariables(parsed.content),
    };
  } catch (error: unknown) {
    if (isEnoent(error)) {
      throw new Error(`Template not found: ${templatePath}`);
    }
    throw error;
  }
}

/**
 * Extract heading texts from markdown content
 * @param markdown - Markdown content
 * @returns Array of heading texts
 */
export function extractHeadings(markdown: string): string[] {
  const lines = markdown.split('\n');
  const headings: string[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    // Track code blocks
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    // Skip code block content
    if (inCodeBlock) {
      continue;
    }

    // Extract headings
    const match = line.match(REGEX_PATTERNS.HEADING);
    if (match && match[2]) {
      // Remove markdown formatting and trim
      const headingText = match[2].trim();

      // Skip variable headings (e.g., {{title}} or {{name}}スキル)
      // These are placeholders that should be replaced, not required sections
      // Skip any heading that contains template variables
      if (!REGEX_PATTERNS.TEMPLATE_VARIABLE.test(headingText)) {
        headings.push(headingText);
      }
    }
  }

  return headings;
}

/**
 * Extract template variables from markdown content
 * Matches patterns like {{variable_name}}
 * @param markdown - Markdown content
 * @returns Array of variable names
 */
export function extractVariables(markdown: string): string[] {
  const variables = new Set<string>();

  let match;
  while ((match = REGEX_PATTERNS.TEMPLATE_VARIABLE.exec(markdown)) !== null) {
    variables.add(match[1].trim());
  }

  return Array.from(variables);
}

/**
 * Check if document has all required headings from template
 * @param documentContent - Document markdown content
 * @param requiredHeadings - Required headings from template
 * @returns Missing headings
 */
export function findMissingHeadings(
  documentContent: string,
  requiredHeadings: string[]
): string[] {
  const documentHeadings = extractHeadings(documentContent);
  const missing: string[] = [];

  for (const required of requiredHeadings) {
    // Check if this heading exists in document
    // Allow flexible matching (ignore case and extra whitespace)
    const found = documentHeadings.some(
      (docHeading) =>
        docHeading.toLowerCase().trim() === required.toLowerCase().trim()
    );

    if (!found) {
      missing.push(required);
    }
  }

  return missing;
}

/**
 * Find unsubstituted template variables in document
 * @param documentContent - Document markdown content
 * @returns Array of unsubstituted variable names
 */
export function findUnsubstitutedVariables(documentContent: string): string[] {
  return extractVariables(documentContent);
}

/**
 * Check if template exists
 * @param templateName - Template name
 * @param templatesDir - Templates directory path
 * @returns True if template exists
 */
export async function templateExists(
  templateName: string,
  templatesDir: string
): Promise<boolean> {
  const templatePath = path.join(templatesDir, `${templateName}.md`);
  try {
    await fs.access(templatePath);
    return true;
  } catch {
    return false;
  }
}
