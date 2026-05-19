import type { FrontmatterFieldRule } from './docs-types.js';
export interface ParsedFrontmatter {
    hasFrontmatter: boolean;
    data?: Record<string, unknown>;
    parseError?: string;
    content: string;
}
export interface FieldValidationResult {
    valid: boolean;
    error?: string;
}
export declare function parseFrontmatter(content: string): ParsedFrontmatter;
export declare function validateFrontmatterField(data: Record<string, unknown>, field: FrontmatterFieldRule): FieldValidationResult;
export declare function validateDateFormat(value: unknown, format: string): boolean;
//# sourceMappingURL=frontmatter.d.ts.map