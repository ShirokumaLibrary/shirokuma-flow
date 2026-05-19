/**
 * adr create - Create a new ADR as GitHub Discussion
 */
import type { Logger } from "../../utils/logger.js";
export interface AdrOptions {
    verbose?: boolean;
    limit?: number;
    repo?: string;
    public?: boolean;
}
/** ADR category name in GitHub Discussions */
export declare const ADR_CATEGORY = "ADR";
/**
 * create subcommand handler
 */
export declare function cmdCreate(title: string, options: AdrOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=create.d.ts.map