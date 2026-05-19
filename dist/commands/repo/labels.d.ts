/**
 * repo labels subcommand - List or create labels
 */
import type { Logger } from "../../utils/logger.js";
export interface RepoLabelsOptions {
    verbose?: boolean;
    create?: string;
    color?: string;
    description?: string;
}
export declare function cmdLabels(options: RepoLabelsOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=labels.d.ts.map