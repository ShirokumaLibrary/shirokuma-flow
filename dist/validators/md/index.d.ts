import type { Config } from '../../parsers/md/types/config.js';
import type { ValidationResult } from '../../parsers/md/types/validation.js';
/**
 * Document validator
 * Validates documents against schemas and rules
 */
export declare class Validator {
    private config;
    constructor(config: Config);
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
    validate(sourceDir: string): Promise<ValidationResult>;
    private validateDocument;
    private detectInternalLinks;
    private isInternalLink;
    private getLineContext;
    private extractHeadings;
    private validateTemplateCompliance;
}
//# sourceMappingURL=index.d.ts.map