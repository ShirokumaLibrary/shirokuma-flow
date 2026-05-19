import type { DocValidationResult } from './docs-types.js';
export declare const COMPACT_TABLE_RULES: {
    readonly cell: "compact-table";
    readonly leadingIndent: "compact-table-leading-indent";
};
export declare function checkCompactTables(content: string, filePath: string): DocValidationResult;
//# sourceMappingURL=compact-table.d.ts.map