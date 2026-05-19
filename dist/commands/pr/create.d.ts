/**
 * PR create subcommand - Create a pull request
 *
 * Creates a pull request via Octokit REST API.
 *
 * Options:
 * - --base (optional): Target branch (e.g., develop). 未指定時はブランチ推論から Integration ブランチを自動解決
 * - --title (required): PR title
 * - --body-file (optional): Body content (already resolved by resolveBodyFileOption)
 * - --head (optional): Source branch (defaults to current git branch)
 */
import { Logger } from "../../utils/logger.js";
import type { IssuesPrOptions } from "./types.js";
export declare function cmdPrCreate(options: IssuesPrOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=create.d.ts.map