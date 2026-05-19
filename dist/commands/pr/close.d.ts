/**
 * PR close subcommand - Close a pull request without merging
 *
 * Closes a PR (state: closed), optionally adds a comment via --body-file,
 * and optionally deletes the remote branch via --delete-branch.
 */
import { Logger } from "../../utils/logger.js";
import type { IssuesPrOptions } from "./types.js";
export declare function cmdPrClose(prNumberStr: string | undefined, options: IssuesPrOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=close.d.ts.map