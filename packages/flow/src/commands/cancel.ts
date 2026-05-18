/**
 * cancel <number> [--body-file FILE] — Issue をキャンセルする checkpoint
 *
 * `issue cancel` の top-level エイリアス。Issue を `state_reason: NOT_PLANNED` で close し、
 * Status を Done に設定する。親 Issue から自動的に unparent される（#2252）。
 *
 * 内部呼び出し:
 *   1. cmdItemClose（issue/close/index.ts）を `stateReason: NOT_PLANNED` で呼び出す
 *
 * 動作は `issue cancel` と完全に同じ。後方互換のため `issue cancel` は残す。
 */

// Commander.js action callbacks receive opts as any; types are cast at boundary.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Command } from "commander";
import {
  createActionLogger,
  setExitCode,
  resolveBodyFileOption,
} from "../utils/cli-helpers.js";
import { isIssueNumber } from "../utils/github.js";
import type { Logger } from "../utils/logger.js";
import type { ItemsOptions } from "./items/types.js";

// =============================================================================
// オプション型
// =============================================================================

export interface CancelOptions extends ItemsOptions {
  /** クローズコメント本文ファイルパス、または "-" で stdin */
  bodyFile?: string;
}

// =============================================================================
// 実装
// =============================================================================

export async function cmdCancel(
  numberStr: string,
  options: CancelOptions,
  logger: Logger
): Promise<number> {
  if (!isIssueNumber(numberStr)) {
    logger.error("有効な Issue 番号を指定してください");
    return 1;
  }

  const { cmdItemClose } = await import("./issue/close/index.js");
  return await cmdItemClose(
    numberStr,
    { ...options, stateReason: "NOT_PLANNED" },
    logger,
  );
}

// =============================================================================
// Factory
// =============================================================================

export function createCancelCommand(): Command {
  return new Command("cancel")
    .description(
      "Issue をキャンセルする (NOT_PLANNED で close + Status: Done)。" +
        " issue cancel の top-level エイリアス checkpoint",
    )
    .argument("<number>", "Issue 番号")
    .option("-b, --body-file <file>", "クローズコメント本文ファイルパス、または - で stdin")
    .option("--owner <owner>", "リポジトリオーナー (デフォルト: 現在のリポジトリ)")
    .option("--public", "公開リポジトリを対象 (repoPairs 設定から)")
    .option("--repo <alias>", "クロスリポジトリのエイリアス (crossRepos 設定から)")
    .option("-v, --verbose", "詳細ログ出力")
    .action(async (number, localOpts) => {
      if (!resolveBodyFileOption(localOpts)) return;
      const logger = createActionLogger(localOpts);
      setExitCode(await cmdCancel(number, localOpts, logger));
    });
}
