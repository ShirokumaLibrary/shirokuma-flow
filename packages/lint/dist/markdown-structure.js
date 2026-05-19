import { fileExists } from './file.js';
import { safeRegExp } from './sanitize.js';
import { parseFrontmatter, validateFrontmatterField } from './frontmatter.js';
import { extractLinks, validateInternalLink } from './link-checker.js';
function createEmptyResult() {
    return { valid: true, errors: [], warnings: [], infos: [] };
}
export function checkFileExists(filePath) {
    const result = createEmptyResult();
    if (!fileExists(filePath)) {
        result.valid = false;
        result.errors.push({
            type: 'error',
            message: `File not found: ${filePath}`,
            file: filePath,
            rule: 'file-exists',
        });
    }
    return result;
}
export function checkSections(content, rules, filePath) {
    const result = createEmptyResult();
    const lines = content.split('\n');
    for (const rule of rules) {
        const pattern = safeRegExp(rule.pattern, 'm');
        if (!pattern) {
            result.valid = false;
            result.errors.push({
                type: 'error',
                message: `Invalid regex pattern: ${rule.pattern} (${rule.description})`,
                file: filePath,
                rule: 'invalid-pattern',
            });
            continue;
        }
        const found = lines.some((line) => pattern.test(line));
        if (found)
            continue;
        if (rule.required) {
            result.valid = false;
            result.errors.push({
                type: 'error',
                message: `Missing required section: ${rule.description} (pattern: ${rule.pattern})`,
                file: filePath,
                rule: 'section-required',
            });
        }
        else {
            result.warnings.push({
                type: 'warning',
                message: `Missing optional section: ${rule.description} (pattern: ${rule.pattern})`,
                file: filePath,
                rule: 'section-optional',
            });
        }
    }
    return result;
}
export function checkDocumentLength(content, rule, filePath) {
    const result = createEmptyResult();
    const lineCount = content.split('\n').length;
    if (rule.minLength !== undefined && lineCount < rule.minLength) {
        result.valid = false;
        result.errors.push({
            type: 'error',
            message: `Document too short: ${lineCount} lines (minimum: ${rule.minLength})`,
            file: filePath,
            rule: 'min-length',
        });
    }
    if (rule.maxLength !== undefined && lineCount > rule.maxLength) {
        result.warnings.push({
            type: 'warning',
            message: `Document too long: ${lineCount} lines (maximum: ${rule.maxLength})`,
            file: filePath,
            rule: 'max-length',
        });
    }
    return result;
}
export function checkFrontmatter(content, rules, filePath) {
    const result = createEmptyResult();
    const parsed = parseFrontmatter(content);
    if (rules.required && !parsed.hasFrontmatter) {
        result.valid = false;
        result.errors.push({
            type: 'error',
            message: 'Required frontmatter is missing',
            file: filePath,
            rule: 'frontmatter-required',
        });
        return result;
    }
    if (!parsed.hasFrontmatter || !parsed.data)
        return result;
    if (parsed.parseError) {
        result.valid = false;
        result.errors.push({
            type: 'error',
            message: `Failed to parse frontmatter: ${parsed.parseError}`,
            file: filePath,
            rule: 'frontmatter-parse',
        });
        return result;
    }
    for (const field of rules.fields) {
        const fieldResult = validateFrontmatterField(parsed.data, field);
        if (!fieldResult.valid && fieldResult.error) {
            result.valid = false;
            result.errors.push({
                type: 'error',
                message: fieldResult.error,
                file: filePath,
                rule: 'frontmatter-field',
            });
        }
    }
    return result;
}
export function checkInternalLinks(content, basePath, filePath) {
    const result = createEmptyResult();
    for (const link of extractLinks(content)) {
        const linkResult = validateInternalLink(link, basePath, filePath);
        if (!linkResult.valid && linkResult.error) {
            result.valid = false;
            result.errors.push({
                type: 'error',
                message: linkResult.error,
                file: filePath,
                line: link.line,
                rule: 'internal-link',
            });
        }
    }
    return result;
}
export function mergeResults(...results) {
    const merged = createEmptyResult();
    for (const result of results) {
        if (!result.valid)
            merged.valid = false;
        merged.errors.push(...result.errors);
        merged.warnings.push(...result.warnings);
        merged.infos.push(...result.infos);
    }
    return merged;
}
//# sourceMappingURL=markdown-structure.js.map