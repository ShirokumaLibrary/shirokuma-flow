/**
 * PR reply subcommand - Reply to a PR review comment
 *
 * Posts a reply to an existing PR review comment thread.
 */
import { Logger } from "../../utils/logger.js";
import type { IssuesPrOptions } from "./types.js";
export declare function cmdPrReply(prNumberStr: string, options: IssuesPrOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=reply.d.ts.map