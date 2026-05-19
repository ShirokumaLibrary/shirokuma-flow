import type { DocValidationResult, FrontmatterRule, LengthRule, SectionRule } from './docs-types.js';
export declare function checkFileExists(filePath: string): DocValidationResult;
export declare function checkSections(content: string, rules: SectionRule[], filePath: string): DocValidationResult;
export declare function checkDocumentLength(content: string, rule: LengthRule, filePath: string): DocValidationResult;
export declare function checkFrontmatter(content: string, rules: FrontmatterRule, filePath: string): DocValidationResult;
export declare function checkInternalLinks(content: string, basePath: string, filePath: string): DocValidationResult;
export declare function mergeResults(...results: DocValidationResult[]): DocValidationResult;
//# sourceMappingURL=markdown-structure.d.ts.map