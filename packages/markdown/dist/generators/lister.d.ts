import type { Config, ListResult } from '../parsers/types/config.js';
/**
 * Format type for list output
 */
export type ListFormat = 'simple' | 'tree' | 'detailed' | 'markdown' | 'json';
/**
 * List options
 */
export interface ListOptions {
    format?: ListFormat;
    layer?: number;
    type?: string;
    category?: string;
    includePattern?: string;
    groupBy?: 'layer' | 'type' | 'category' | 'none';
    sortBy?: 'path' | 'layer' | 'title';
}
/**
 * File lister
 * Generates file listings in various formats
 */
export declare class Lister {
    private config;
    constructor(config: Config);
    list(sourceDir: string, options?: ListOptions): Promise<ListResult>;
    /**
     * Format list result as string
     */
    format(result: ListResult, format: ListFormat, sourceDir: string): string;
    private collectFiles;
    private parseFiles;
    private filterFiles;
    private sortFiles;
    private calculateStats;
    private formatSimple;
    private formatTree;
    private formatDetailed;
    private formatMarkdown;
    private formatJSON;
    private getLayerName;
}
//# sourceMappingURL=lister.d.ts.map