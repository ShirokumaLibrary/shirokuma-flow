/**
 * repo status subcommand - Check npm / GitHub service status
 */
import type { Logger } from "../../utils/logger.js";
export interface RepoStatusOptions {
    verbose?: boolean;
}
export declare function cmdStatus(_options: RepoStatusOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=status.d.ts.map