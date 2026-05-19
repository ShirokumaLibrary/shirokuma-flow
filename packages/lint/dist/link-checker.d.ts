export interface LinkInfo {
    text: string;
    url: string;
    line: number;
}
export type LinkType = 'external' | 'relative' | 'absolute' | 'anchor';
export interface LinkValidationResult {
    valid: boolean;
    error?: string;
    skipped?: boolean;
}
export declare function extractLinks(content: string): LinkInfo[];
export declare function classifyLink(url: string): LinkType;
export declare function resolveRelativePath(linkUrl: string, sourceFile: string): string;
export declare function validateInternalLink(link: LinkInfo, basePath: string, sourceFile: string): LinkValidationResult;
//# sourceMappingURL=link-checker.d.ts.map