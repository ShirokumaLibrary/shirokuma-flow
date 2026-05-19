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
export declare function loadTemplate(templateName: string, templatesDir: string): Promise<Template>;
/**
 * Extract heading texts from markdown content
 * @param markdown - Markdown content
 * @returns Array of heading texts
 */
export declare function extractHeadings(markdown: string): string[];
/**
 * Extract template variables from markdown content
 * Matches patterns like {{variable_name}}
 * @param markdown - Markdown content
 * @returns Array of variable names
 */
export declare function extractVariables(markdown: string): string[];
/**
 * Check if document has all required headings from template
 * @param documentContent - Document markdown content
 * @param requiredHeadings - Required headings from template
 * @returns Missing headings
 */
export declare function findMissingHeadings(documentContent: string, requiredHeadings: string[]): string[];
/**
 * Find unsubstituted template variables in document
 * @param documentContent - Document markdown content
 * @returns Array of unsubstituted variable names
 */
export declare function findUnsubstitutedVariables(documentContent: string): string[];
/**
 * Check if template exists
 * @param templateName - Template name
 * @param templatesDir - Templates directory path
 * @returns True if template exists
 */
export declare function templateExists(templateName: string, templatesDir: string): Promise<boolean>;
//# sourceMappingURL=template.d.ts.map