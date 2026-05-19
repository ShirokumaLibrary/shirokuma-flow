import type { Config } from '../../parsers/md/types/config.js';
import type { Issue } from '../../parsers/md/types/validation.js';
import type { Document } from '../../parsers/md/types/document.js';
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