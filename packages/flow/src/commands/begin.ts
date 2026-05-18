/**
 * begin <number> — Issue の作業開始 checkpoint
 *
 * status transition --to "In progress" + (オプションで) issue update --assign @me
 * を 1 コマンドにまとめた薄いラッパー。AI が「この Issue に着手する」という意図を
 * 直接表現できるようにする。
 *
 * 内部呼び出し:
 *   1. status transition <N> --to "In progress"  (validateTransition で検証)
 *   2. issue update <N> --assign @me              (--no-assign で抑止可能)
 *
 * 失敗時は最初のステップで停止し、後続を実行しない（部分適用を避ける）。
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

export interface BeginOptions extends ItemsOptions {
  /** 担当者の自己アサインをスキップ */
  noAssign?: boolean;
  /** 強制遷移（status transition --force と同等） */
  force?: boolean;
}

// =============================================================================
// 実装
// =============================================================================

export async function cmdBegin(
  numberStr: string,
  options: BeginOptions,
  logger: Logger
): Promise<number> {
  if (!isIssueNumber(numberStr)) {
    logger.error("有効な Issue 番号を指定してください");
    return 1;
  }

  // Step 1: status transition --to "In progress"
  const { cmdItemTransition } = await import("./status/transition/index.js");
  const transitionCode = await cmdItemTransition(
    numberStr,
    { ...options, to: "In progress", force: options.force },
    logger,
  );
  if (transitionCode !== 0) {
    return transitionCode;
  }

  // Step 2: issue update --assign @me （--no-assign 指定時はスキップ）
  if (options.noAssign) {
    return 0;
  }

  const { cmdItemAssign } = await import("./issue/assign/index.js");
  const assignCode = await cmdItemAssign(numberStr, "@me", options, logger);
  if (assignCode !== 0) {
    // assign 失敗は警告扱い（ステータス遷移は既に成功している）
    logger.warn(
      "ステータス遷移は成功しましたが、担当者の自己アサインに失敗しました。" +
        " 必要であれば `shirokuma-flow issue assign <N> @me` を手動で実行してください。",
    );
    return assignCode;
  }
  return 0;
}

// =============================================================================
// Factory
// =============================================================================

export function createBeginCommand(): Command {
  return new Command("begin")
    .description(
      "Issue の作業開始 (status: In progress + 自己アサイン)。" +
        " status transition と issue assign を 1 コマンドで実行する checkpoint",
    )
    .argument("<number>", "Issue 番号")
    .option("--no-assign", "自己アサインをスキップ")
    .option("--force", "ステータス遷移ルールを無視して強制遷移")
    .option("--owner <owner>", "リポジトリオーナー (デフォルト: 現在のリポジトリ)")
    .option("--public", "公開リポジトリを対象 (repoPairs 設定から)")
    .option("--repo <alias>", "クロスリポジトリのエイリアス (crossRepos 設定から)")
    .option("-v, --verbose", "詳細ログ出力")
    .action(async (number, localOpts) => {
      const logger = createActionLogger(localOpts);
      setExitCode(await cmdBegin(number, localOpts, logger));
    });
}
