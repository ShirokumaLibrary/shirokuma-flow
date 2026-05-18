/**
 * approve <number> — Issue を Review → Done に承認する checkpoint
 *
 * `status approve` の top-level エイリアス。AI が「これで承認」という意図を
 * 直接表現できる。Issue 本体はクローズしない（親 Close 時に連動）。
 *
 * 内部呼び出し:
 *   1. cmdItemApprove (status/approve/index.ts)
 *
 * 動作は `status approve` と完全に同じ。後方互換のため `status approve` は残す。
 */

// Commander.js action callbacks receive opts as any; types are cast at boundary.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Command } from "commander";
import {
  createActionLogger,
  setExitCode,
} from "../utils/cli-helpers.js";
import { isIssueNumber } from "../utils/github.js";
import type { Logger } from "../utils/logger.js";
import type { ItemsOptions } from "./items/types.js";

// =============================================================================
// オプション型
// =============================================================================

export type ApproveOptions = ItemsOptions;

// =============================================================================
// 実装
// =============================================================================

export async function cmdApprove(
  numberStr: string,
  options: ApproveOptions,
  logger: Logger
): Promise<number> {
  if (!isIssueNumber(numberStr)) {
    logger.error("有効な Issue 番号を指定してください");
    return 1;
  }

  const { cmdItemApprove } = await import("./status/approve/index.js");
  return await cmdItemApprove(numberStr, options, logger);
}

// =============================================================================
// Factory
// =============================================================================

export function createApproveCommand(): Command {
  return new Command("approve")
    .description(
      "Issue を Review → Done に承認する (status: Review → Done)。" +
        " status approve の top-level エイリアス checkpoint",
    )
    .argument("<number>", "Issue 番号")
    .option("--owner <owner>", "リポジトリオーナー (デフォルト: 現在のリポジトリ)")
    .option("--public", "公開リポジトリを対象 (repoPairs 設定から)")
    .option("--repo <alias>", "クロスリポジトリのエイリアス (crossRepos 設定から)")
    .option("-v, --verbose", "詳細ログ出力")
    .action(async (number, localOpts) => {
      const logger = createActionLogger(localOpts);
      setExitCode(await cmdApprove(number, localOpts, logger));
    });
}
