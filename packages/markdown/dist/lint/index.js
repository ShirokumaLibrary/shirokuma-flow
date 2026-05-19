import { glob } from 'glob';
import matter from '@11ty/gray-matter';
import * as fs from 'fs/promises';
import * as path from 'path';
import { REGEX_PATTERNS } from '../utils/md/constants.js';
import { safeRegExp } from '@shirokuma-library/lint';
/**
 * Markdown linter
 * Checks and fixes Markdown formatting issues
 */
export class Linter {
    config;
    constructor(config) {
        this.config = config;
    }
    async lint(sourceDir) {
        const allIssues = [];
        // Collect all markdown files
        const patterns = this.config.build.include.map(p => path.join(sourceDir, p));
        const excludePatterns = this.config.build.exclude.map(p => path.join(sourceDir, p));
        const allFiles = [];
        for (const pattern of patterns) {
            const matches = await glob(pattern, {
                ignore: excludePatterns,
                nodir: true,
            });
            allFiles.push(...matches);
        }
        // Lint each file
        for (const filePath of allFiles) {
            const content = await fs.readFile(filePath, 'utf-8');
            const parsed = matter(content);
            const document = {
                path: filePath,
                frontmatter: parsed.data,
                content: parsed.content,
                sections: [],
            };
            const issues = this.lintDocument(document);
            allIssues.push(...issues);
        }
        // Check structure consistency (directory-level checks)
        if (this.config.lint.rules?.consistent_structure?.enabled) {
            const structureIssues = this.checkStructureConsistency(sourceDir, allFiles);
            allIssues.push(...structureIssues);
        }
        return allIssues;
    }
    async fix(sourceDir) {
        // Collect all markdown files
        const patterns = this.config.build.include.map(p => path.join(sourceDir, p));
        const excludePatterns = this.config.build.exclude.map(p => path.join(sourceDir, p));
        const allFiles = [];
        for (const pattern of patterns) {
            const matches = await glob(pattern, {
                ignore: excludePatterns,
                nodir: true,
            });
            allFiles.push(...matches);
        }
        // Fix each file
        for (const filePath of allFiles) {
            const content = await fs.readFile(filePath, 'utf-8');
            const parsed = matter(content);
            const document = {
                path: filePath,
                frontmatter: parsed.data,
                content: parsed.content,
                sections: [],
            };
            const fixed = this.fixDocument(document);
            // Reconstruct file with frontmatter
            const newContent = matter.stringify(fixed.content, fixed.frontmatter);
            await fs.writeFile(filePath, newContent, 'utf-8');
        }
    }
    lintDocument(document) {
        const issues = [];
        const lines = document.content.split('\n');
        // Check file naming convention
        if (this.config.lint.file_naming) {
            const fileName = path.basename(document.path);
            const pattern = safeRegExp(this.config.lint.file_naming.pattern);
            if (!pattern) {
                issues.push({
                    severity: 'warning',
                    message: `Invalid file naming pattern: ${this.config.lint.file_naming.pattern}`,
                    file: document.path,
                    rule: 'file-naming',
                });
            }
            else if (!pattern.test(fileName)) {
                issues.push({
                    severity: 'warning',
                    message: this.config.lint.file_naming.message || 'File name does not match naming convention',
                    file: document.path,
                    rule: 'file-naming',
                });
            }
        }
        // Built-in rules
        let inCodeBlock = false;
        let inFrontmatter = false;
        let frontmatterStartLine = -1;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line && line !== '')
                continue;
            const lineNum = i + 1;
            // Track code blocks
            if (line.trim().startsWith('```')) {
                inCodeBlock = !inCodeBlock;
            }
            // Track frontmatter (only at the beginning of file)
            if (line.trim() === '---') {
                if (i === 0) {
                    // Start of frontmatter
                    inFrontmatter = true;
                    frontmatterStartLine = 0;
                }
                else if (inFrontmatter && i > frontmatterStartLine) {
                    // End of frontmatter
                    inFrontmatter = false;
                }
            }
            // Rule: no-trailing-spaces
            if (this.config.lint.builtin_rules['no-trailing-spaces'] !== false) {
                if (line.endsWith(' ') && line.trim() !== '') {
                    issues.push({
                        severity: 'warning',
                        message: 'Line has trailing spaces',
                        file: document.path,
                        line: lineNum,
                        rule: 'no-trailing-spaces',
                    });
                }
            }
            // Rule: no-multiple-blanks
            if (this.config.lint.builtin_rules['no-multiple-blanks'] !== false) {
                const prevLine = lines[i - 1];
                const prevPrevLine = lines[i - 2];
                if (i > 0 && line === '' && prevLine === '' && prevPrevLine === '') {
                    issues.push({
                        severity: 'warning',
                        message: 'More than 2 blank lines in a row',
                        file: document.path,
                        line: lineNum,
                        rule: 'no-multiple-blanks',
                    });
                }
            }
            // Rule: heading-style (ATX style with #)
            if (this.config.lint.builtin_rules['heading-style'] !== false) {
                // Skip if in code block or frontmatter
                if (!inCodeBlock && !inFrontmatter) {
                    // Check for setext-style headings (underlined with = or -)
                    if (i < lines.length - 1) {
                        const nextLine = lines[i + 1];
                        // Only flag if:
                        // 1. Current line has actual text (potential heading)
                        // 2. Next line is all = or all -
                        // 3. Not in code blocks or frontmatter
                        if (line.trim().length > 0 &&
                            nextLine &&
                            (REGEX_PATTERNS.SETEXT_EQUALS.test(nextLine) || REGEX_PATTERNS.SETEXT_DASHES.test(nextLine))) {
                            issues.push({
                                severity: 'info',
                                message: 'Use ATX-style headings (# Heading) instead of setext-style',
                                file: document.path,
                                line: lineNum,
                                rule: 'heading-style',
                            });
                        }
                    }
                }
            }
            // Rule: list-marker-style
            if (this.config.lint.builtin_rules['list-marker-style'] !== false) {
                const listMatch = line.match(REGEX_PATTERNS.LIST_MARKER);
                if (listMatch && listMatch[2]) {
                    // Prefer consistent markers (-)
                    if (listMatch[2] !== '-') {
                        issues.push({
                            severity: 'info',
                            message: 'Use consistent list markers (-)',
                            file: document.path,
                            line: lineNum,
                            rule: 'list-marker-style',
                        });
                    }
                }
            }
        }
        // Rule: no-mermaid-styling (check across code blocks)
        if (this.config.lint.builtin_rules['no-mermaid-styling'] !== false) {
            let inMermaidBlock = false;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (!line)
                    continue;
                const lineNum = i + 1;
                // Detect mermaid block start
                if (line.trim() === '```mermaid') {
                    inMermaidBlock = true;
                    continue;
                }
                // Detect code block end
                if (inMermaidBlock && line.trim() === '```') {
                    inMermaidBlock = false;
                    continue;
                }
                // Check for style definitions inside mermaid blocks
                if (inMermaidBlock && line.match(REGEX_PATTERNS.MERMAID_STYLE)) {
                    issues.push({
                        severity: 'warning',
                        message: 'Mermaid style definitions waste tokens - LLMs don\'t see colors',
                        file: document.path,
                        line: lineNum,
                        rule: 'no-mermaid-styling',
                    });
                }
            }
        }
        // Rule: no-navigation-sections
        if (this.config.lint.builtin_rules['no-navigation-sections'] !== false) {
            let inCodeBlock = false;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (!line)
                    continue;
                const lineNum = i + 1;
                // Track code blocks
                if (line.trim().startsWith('```')) {
                    inCodeBlock = !inCodeBlock;
                }
                // Skip lines inside code blocks
                if (inCodeBlock)
                    continue;
                // Detect navigation section headings
                if (line.match(REGEX_PATTERNS.NAVIGATION_SECTIONS)) {
                    issues.push({
                        severity: 'warning',
                        message: 'Navigation sections are redundant in combined LLM output - use frontmatter instead',
                        file: document.path,
                        line: lineNum,
                        rule: 'no-navigation-sections',
                    });
                }
            }
        }
        // Rule: no-structural-bold
        if (this.config.lint.builtin_rules['no-structural-bold'] !== false) {
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (!line)
                    continue;
                const lineNum = i + 1;
                // Detect list items with bold field names: - **Name**: Value
                if (line.match(REGEX_PATTERNS.STRUCTURAL_BOLD_LIST)) {
                    issues.push({
                        severity: 'info',
                        message: 'Structural bold in lists wastes tokens - use plain "Name: Value" format',
                        file: document.path,
                        line: lineNum,
                        rule: 'no-structural-bold',
                    });
                }
                // Detect consecutive bold: **Field**: **Value**
                if (line.match(REGEX_PATTERNS.CONSECUTIVE_BOLD)) {
                    issues.push({
                        severity: 'info',
                        message: 'Consecutive bold wastes tokens - use **Field**: Value instead',
                        file: document.path,
                        line: lineNum,
                        rule: 'no-structural-bold',
                    });
                }
                // Detect section headers as bold (not starting a new paragraph)
                if (line.match(/^\*\*[^*]+\*\*:/) && !line.match(/^\s/)) {
                    issues.push({
                        severity: 'info',
                        message: 'Section header as bold - consider using heading (###) instead',
                        file: document.path,
                        line: lineNum,
                        rule: 'no-structural-bold',
                    });
                }
            }
        }
        // Rule: no-numbered-headings
        if (this.config.lint.builtin_rules['no-numbered-headings'] !== false) {
            let inCodeBlock = false;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (!line)
                    continue;
                const lineNum = i + 1;
                // Track code blocks
                if (line.trim().startsWith('```')) {
                    inCodeBlock = !inCodeBlock;
                }
                // Skip lines inside code blocks
                if (inCodeBlock)
                    continue;
                // Detect headings with numbering: ## 1. Title, ## 2.1. Subtitle, etc.
                // Pattern: starts with # (1-6 times), followed by whitespace, then number(s) with dot(s)
                if (line.match(REGEX_PATTERNS.NUMBERED_HEADING)) {
                    issues.push({
                        severity: 'warning',
                        message: 'Heading contains numbering - remove numbers for better flexibility and token efficiency',
                        file: document.path,
                        line: lineNum,
                        rule: 'no-numbered-headings',
                    });
                }
            }
        }
        return issues;
    }
    fixDocument(document) {
        let content = document.content;
        const lines = content.split('\n');
        const fixedLines = [];
        // IMPORTANT: Only apply trivial fixes
        // Non-trivial fixes (structural changes) should be done manually with user approval
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (!line && line !== '') {
                fixedLines.push('');
                continue;
            }
            // Trivial fix: no-trailing-spaces
            if (this.config.lint.builtin_rules['no-trailing-spaces'] !== false) {
                if (line.trim() !== '') {
                    line = line.trimEnd();
                }
            }
            fixedLines.push(line);
        }
        // Trivial fix: no-multiple-blanks
        if (this.config.lint.builtin_rules['no-multiple-blanks'] !== false) {
            const cleaned = [];
            let blankCount = 0;
            for (const line of fixedLines) {
                if (line === '') {
                    blankCount++;
                    if (blankCount <= 2) {
                        cleaned.push(line);
                    }
                }
                else {
                    blankCount = 0;
                    cleaned.push(line);
                }
            }
            content = cleaned.join('\n');
        }
        else {
            content = fixedLines.join('\n');
        }
        return {
            ...document,
            content,
        };
    }
    /**
     * Check directory structure consistency
     */
    checkStructureConsistency(sourceDir, allFiles) {
        const issues = [];
        const config = this.config.lint.rules?.consistent_structure;
        if (!config)
            return issues;
        // Group files by directory
        const dirMap = new Map();
        for (const file of allFiles) {
            const dir = path.dirname(file);
            if (!dirMap.has(dir)) {
                dirMap.set(dir, []);
            }
            dirMap.get(dir).push(file);
        }
        // Check each directory
        for (const [dir, files] of dirMap) {
            const relativePath = path.relative(sourceDir, dir);
            if (!relativePath)
                continue; // Skip root directory
            const mdFiles = files.filter(f => f.endsWith('.md'));
            const fileCount = mdFiles.length;
            // Check 1: Directory threshold
            if (fileCount > config.directory_threshold) {
                issues.push({
                    severity: 'warning',
                    message: `Directory has ${fileCount} files (threshold: ${config.directory_threshold})\n  Suggestion: Consider creating subdirectories to organize files`,
                    file: dir,
                    rule: 'consistent-structure-threshold',
                });
            }
            // Check 2: Overview file naming
            const overviewFiles = mdFiles.filter(f => {
                const basename = path.basename(f);
                return basename === 'overview.md' || basename === 'index.md' || basename.match(/^.*overview.*\.md$/i);
            });
            if (overviewFiles.length > 0) {
                for (const overviewFile of overviewFiles) {
                    const basename = path.basename(overviewFile);
                    if (basename !== config.overview_naming) {
                        issues.push({
                            severity: 'warning',
                            message: `Overview file name should be "${config.overview_naming}" (found: "${basename}")\n  Suggestion: Rename to ${config.overview_naming}`,
                            file: overviewFile,
                            rule: 'consistent-structure-naming',
                        });
                    }
                }
            }
        }
        return issues;
    }
}
//# sourceMappingURL=index.js.map