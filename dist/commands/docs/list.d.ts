/**
 * docs list subcommand - 取得済みソース一覧と最終取得日時の表示
 */
import type { Logger } from "../../utils/logger.js";
import { type DocsSourceConfig } from "../../utils/config.js";
export interface DocsListOptions {
    project?: string;
    format?: "table-json" | "json";
    verbose?: boolean;
}
export declare function resolveOutputDir(projectPath: string, sourceName: string, configOutputDir?: string, docsOutputDir?: string): string;
export declare function discoverFilesystemSources(projectPath: string, docsOutputDir?: string): DocsSourceConfig[];
export declare function countMarkdownFiles(dir: string): number;
export declare function cmdList(options: DocsListOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=list.d.ts.map