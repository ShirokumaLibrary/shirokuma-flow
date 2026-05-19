/**
 * PR resolve subcommand - Resolve a review thread
 *
 * Resolves a PR review thread by its GraphQL node ID.
 */
import { Logger } from "../../utils/logger.js";
import type { IssuesPrOptions } from "./types.js";
export declare function cmdResolve(prNumberStr: string, options: IssuesPrOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=resolve.d.ts.map