/**
 * block <number> — Issue を Blocked にする checkpoint
 *
 * status transition --to Blocked --reason の薄いラッパー。AI が「これは X で
 * 止まっている」という意図を直接表現できるようにする。--reason は必須。
 *
 * 内部呼び出し:
 *   1. status transition <N> --to Blocked --reason <text>
 *      （transition 側が reason を自動的に Issue コメントとして記録する）
 *
 * primitive との違いはほぼ命名だけだが、AI のプロンプトで `block` という
 * 動詞で意図を表現できることを優先する。
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

export interface BlockOptions extends ItemsOptions {
  /** ブロッカーの説明（必須）。Issue コメントとして自動記録される */
  reason?: string;
  /** 強制遷移（status transition --force と同等） */
  force?: boolean;
}

// =============================================================================
// 実装
// =============================================================================

export async function cmdBlock(
  numberStr: string,
  options: BlockOptions,
  logger: Logger
): Promise<number> {
  if (!isIssueNumber(numberStr)) {
    logger.error("有効な Issue 番号を指定してください");
    return 1;
  }

  if (!options.reason?.trim()) {
    logger.error(
      "--reason オプションは必須です（例: --reason \"外部 API の障害待ち\"）",
    );
    return 2;
  }

  // status transition --to Blocked --reason X
  // transition 側が reason を Issue コメントとして自動記録する
  const { cmdItemTransition } = await import("./status/transition/index.js");
  return await cmdItemTransition(
    numberStr,
    {
      ...options,
      to: "Blocked",
      reason: options.reason,
      force: options.force,
    },
    logger,
  );
}

// =============================================================================
// Factory
// =============================================================================

export function createBlockCommand(): Command {
  return new Command("block")
    .description(
      "Issue を Blocked 状態にする (status: Blocked)。" +
        " --reason は必須で、自動的に Issue コメントとして記録される checkpoint",
    )
    .argument("<number>", "Issue 番号")
    .requiredOption("--reason <text>", "ブロッカーの説明 (必須)")
    .option("--force", "ステータス遷移ルールを無視して強制遷移")
    .option("--owner <owner>", "リポジトリオーナー (デフォルト: 現在のリポジトリ)")
    .option("--public", "公開リポジトリを対象 (repoPairs 設定から)")
    .option("--repo <alias>", "クロスリポジトリのエイリアス (crossRepos 設定から)")
    .option("-v, --verbose", "詳細ログ出力")
    .action(async (number, localOpts) => {
      const logger = createActionLogger(localOpts);
      setExitCode(await cmdBlock(number, localOpts, logger));
    });
}
