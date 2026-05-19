/**
 * docs remove subcommand - ドキュメントディレクトリの削除
 */
import type { Logger } from "../../utils/logger.js";
export interface DocsRemoveOptions {
    project?: string;
    name: string;
    yes?: boolean;
    verbose?: boolean;
}
export declare function cmdRemove(options: DocsRemoveOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=remove.d.ts.map