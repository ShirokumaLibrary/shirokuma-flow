// gray-matter and plugin types return any; suppress unsafe-* for this file.
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import matter from '@11ty/gray-matter';
import * as fs from 'fs/promises';
import * as path from 'path';
import { loadTemplate, findMissingHeadings, findUnsubstitutedVariables, templateExists } from '../parsers/template.js';
import { FileCollector } from '../utils/md/file-collector.js';
import { DEFAULT_MAX_HEADING_DEPTH } from '../utils/md/constants.js';
import { safeRegExp } from '@shirokuma-library/lint';
import { CodeBlockTracker } from '../utils/md/code-blocks.js';
/**
 * Document validator
 * Validates documents against schemas and rules
 */
export class Validator {
    config;
    constructor(config) {
        this.config = config;
    }
    /**
     * Validates all markdown files in source directory
     *
     * Checks documents for:
     * - Required frontmatter fields
     * - Frontmatter schema compliance
     * - Internal links (if no_internal_links enabled)
     * - Heading depth limits
     * - Template compliance (if enabled)
     *
     * @param sourceDir - Source directory containing markdown files
     * @returns Validation result with arrays of errors, warnings, and info
     *
     * @example
     * ```typescript
     * const validator = new Validator(config);
     * const result = await validator.validate('./docs');
     * if (result.errors.length > 0) {
     *   console.error(`Found ${result.errors.length} errors`);
     * }
     * ```
     */
    async validate(sourceDir) {
        const errors = [];
        const warnings = [];
        const info = [];
        // Collect all markdown files
        const collector = new FileCollector(this.config);
        const allFiles = await collector.collect(sourceDir);
        // Validate each file
        for (const filePath of allFiles) {
            const content = await fs.readFile(filePath, 'utf-8');
            const parsed = matter(content);
            const document = {
                path: filePath,
                frontmatter: parsed.data,
                content: parsed.content,
                sections: [],
            };
            const issues = await this.validateDocument(document, sourceDir);
            for (const issue of issues) {
                if (issue.severity === 'error') {
                    errors.push(issue);
                }
                else if (issue.severity === 'warning') {
                    warnings.push(issue);
                }
                else {
                    info.push(issue);
                }
            }
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings,
            info,
        };
    }
    async validateDocument(document, projectRoot) {
        const issues = [];
        // 1. Validate required frontmatter fields
        for (const field of this.config.validation.required_frontmatter) {
            if (!(field in document.frontmatter)) {
                issues.push({
                    severity: 'error',
                    message: `Missing required frontmatter field: ${field}`,
                    file: document.path,
                    rule: 'required-frontmatter',
                });
            }
        }
        // 2. Check dependency file existence (PRIORITY 1 - CRITICAL)
        if (document.frontmatter.depends_on && Array.isArray(document.frontmatter.depends_on)) {
            for (const dep of document.frontmatter.depends_on) {
                const depPath = path.join(projectRoot, dep);
                try {
                    await fs.access(depPath);
                }
                catch {
                    issues.push({
                        severity: 'error',
                        message: `Dependency file not found: ${dep}`,
                        file: document.path,
                        rule: 'dependency-exists',
                    });
                }
            }
        }
        // 3. Check forbidden patterns
        if (this.config.validation.forbidden_patterns) {
            for (const forbiddenPattern of this.config.validation.forbidden_patterns) {
                const regex = safeRegExp(forbiddenPattern.pattern);
                if (!regex) {
                    issues.push({
                        severity: 'error',
                        message: `Invalid regex pattern: ${forbiddenPattern.pattern}`,
                        file: document.path,
                        rule: 'forbidden-pattern',
                    });
                    continue;
                }
                if (regex.test(document.content)) {
                    issues.push({
                        severity: 'error',
                        message: forbiddenPattern.message,
                        file: document.path,
                        rule: 'forbidden-pattern',
                    });
                }
            }
        }
        // 4. Check for internal links (if enabled)
        if (this.config.validation.no_internal_links) {
            const internalLinks = this.detectInternalLinks(document.content, document.path);
            issues.push(...internalLinks);
        }
        // 5. Check heading depth
        const headings = this.extractHeadings(document.content);
        const maxDepth = DEFAULT_MAX_HEADING_DEPTH;
        for (const heading of headings) {
            if (heading.level > maxDepth) {
                issues.push({
                    severity: 'warning',
                    message: `Heading depth ${heading.level} exceeds maximum ${maxDepth}`,
                    file: document.path,
                    line: heading.line,
                    rule: 'max-heading-depth',
                });
            }
        }
        // 6. Check template compliance (if enabled and template specified)
        if (this.config.validation.template_compliance?.enabled && document.frontmatter.template) {
            const templateIssues = await this.validateTemplateCompliance(document);
            issues.push(...templateIssues);
        }
        return issues;
    }
    detectInternalLinks(content, filePath) {
        const issues = [];
        const lines = content.split('\n');
        // Regex to match markdown links: [text](url)
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line)
                continue;
            let match;
            while ((match = linkRegex.exec(line)) !== null) {
                const linkText = match[1];
                const linkUrl = match[2];
                // Skip if link text or URL is undefined
                if (!linkText || !linkUrl)
                    continue;
                // Check if it's an internal link (relative path to .md file)
                const isInternal = this.isInternalLink(linkUrl);
                if (isInternal) {
                    // Get surrounding context for better error message
                    const context = this.getLineContext(line, match.index, linkText, linkUrl);
                    issues.push({
                        severity: 'error',
                        message: `Internal markdown link detected (redundant in LLM context)\n  Link: [${linkText}](${linkUrl})\n  Context: "${context}"\n  Action: Delete this sentence/section - all content is in one file, references are redundant\n  Note: External links (http://, https://) are OK to keep`,
                        file: filePath,
                        line: i + 1,
                        rule: 'no-internal-links',
                    });
                }
            }
        }
        return issues;
    }
    isInternalLink(url) {
        // External links (keep these)
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return false;
        }
        // Internal links (should be removed)
        // Relative paths, paths starting with /, or .md files
        if (url.includes('.md') || url.startsWith('../') || url.startsWith('./') || url.startsWith('/')) {
            return true;
        }
        return false;
    }
    getLineContext(line, matchIndex, linkText, linkUrl) {
        // Extract up to 60 characters around the match for context
        const start = Math.max(0, matchIndex - 20);
        const end = Math.min(line.length, matchIndex + linkText.length + linkUrl.length + 30);
        let context = line.substring(start, end).trim();
        // Add ellipsis if truncated
        if (start > 0)
            context = '...' + context;
        if (end < line.length)
            context = context + '...';
        return context;
    }
    extractHeadings(content) {
        const lines = content.split('\n');
        const headings = [];
        const tracker = new CodeBlockTracker();
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line) {
                tracker.processLine(line);
                if (tracker.isInCodeBlock())
                    continue;
                const match = line.match(/^(#{1,6})\s+(.+)$/);
                if (match && match[1] && match[2]) {
                    headings.push({
                        level: match[1].length,
                        title: match[2].trim(),
                        line: i + 1,
                    });
                }
            }
        }
        return headings;
    }
    async validateTemplateCompliance(document) {
        const issues = [];
        const templateName = document.frontmatter.template;
        const config = this.config.validation.template_compliance;
        if (!config) {
            return issues;
        }
        const severity = config.severity || 'error';
        // Get templates directory
        // If templates directory is specified in config, use it
        // Otherwise, use config directory + templates
        const templatesDir = this.config.directories.templates
            ? this.config.directories.templates
            : path.join(this.config.directories.config, 'templates');
        // 1. Check template existence
        const exists = await templateExists(templateName, templatesDir);
        if (!exists) {
            issues.push({
                severity,
                message: `Template not found: ${templateName}\n  Expected location: ${path.join(templatesDir, templateName + '.md')}`,
                file: document.path,
                rule: 'template-exists',
            });
            return issues; // Cannot proceed without template
        }
        // 2. Load template
        let template;
        try {
            template = await loadTemplate(templateName, templatesDir);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            issues.push({
                severity: 'error',
                message: `Failed to load template: ${message}`,
                file: document.path,
                rule: 'template-load',
            });
            return issues;
        }
        // 3. Check required sections
        if (config.check_required_sections) {
            const missingHeadings = findMissingHeadings(document.content, template.requiredHeadings);
            if (missingHeadings.length > 0) {
                const headingsList = missingHeadings.map(h => `  - ## ${h}`).join('\n');
                issues.push({
                    severity,
                    message: `Template compliance check failed\n  Template: ${templateName}\n  Missing sections:\n${headingsList}`,
                    file: document.path,
                    rule: 'template-required-sections',
                });
            }
        }
        // 4. Check variable substitution
        if (config.check_variable_substitution) {
            const unsubstituted = findUnsubstitutedVariables(document.content);
            if (unsubstituted.length > 0) {
                const varList = unsubstituted.map(v => `  - {{${v}}}`).join('\n');
                issues.push({
                    severity: severity === 'error' ? 'warning' : severity, // Downgrade to warning for variables
                    message: `Unsubstituted template variables found\n  Template: ${templateName}\n  Variables:\n${varList}`,
                    file: document.path,
                    rule: 'template-variable-substitution',
                });
            }
        }
        return issues;
    }
}
//# sourceMappingURL=index.js.map