import type { Config } from '../parsers/types/config.js';
import type { Issue } from '../parsers/types/validation.js';
import type { Document } from '../parsers/types/document.js';
/**
 * Markdown linter
 * Checks and fixes Markdown formatting issues
 */
export declare class Linter {
    private config;
    constructor(config: Config);
    lint(sourceDir: string): Promise<Issue[]>;
    fix(sourceDir: string): Promise<void>;
    lintDocument(document: Document): Issue[];
    private fixDocument;
    /**
     * Check directory structure consistency
     */
    private checkStructureConsistency;
}
//# sourceMappingURL=index.d.ts.map