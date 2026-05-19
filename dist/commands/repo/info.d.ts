/**
 * repo info subcommand - Get repository information
 */
import type { Logger } from "../../utils/logger.js";
export interface RepoInfoOptions {
    verbose?: boolean;
}
export declare function cmdInfo(options: RepoInfoOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=info.d.ts.map