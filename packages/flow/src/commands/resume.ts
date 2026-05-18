/**
 * resume <number> — Blocked 解除して作業再開する checkpoint
 *
 * status transition --to "In progress" + (オプションで) issue comment を 1
 * コマンドにまとめた薄いラッパー。AI が「ブロッカー解消、再開」という意図を
 * 直接表現できるようにする。
 *
 * 内部呼び出し:
 *   1. (任意) issue comment <N> <file>            (--comment 指定時、positional file)
 *   2. status transition <N> --to "In progress"
 *
 * Blocked → In progress が status-workflow で許可されているのでそのまま遷移。
 * コメントは遷移より先に投稿する（コメント先成功なら遷移リトライ時に重複しない、
 * submit と同じ設計方針）。
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

export interface ResumeOptions extends ItemsOptions {
  /** 任意のコメントファイル（解除理由・経緯など）。遷移前に投稿される */
  comment?: string;
  /** 強制遷移（status transition --force と同等） */
  force?: boolean;
}

// =============================================================================
// 実装
// =============================================================================

export async function cmdResume(
  numberStr: string,
  options: ResumeOptions,
  logger: Logger
): Promise<number> {
  if (!isIssueNumber(numberStr)) {
    logger.error("有効な Issue 番号を指定してください");
    return 1;
  }

  // Step 1: コメント投稿（指定された場合のみ、遷移より先に実行）
  if (options.comment) {
    const { cmdAddComment } = await import("./issue/comment/index.js");
    // resume 固有の comment プロパティは cmdAddComment の AddCommentOptions に存在しないため除外する
    const { comment: _comment, ...passthroughOptions } = options;
    const commentCode = await cmdAddComment(
      numberStr,
      options.comment,
      passthroughOptions,
      logger,
    );
    if (commentCode !== 0) {
      logger.error(
        "コメント投稿に失敗したためステータス遷移を中止しました。コメント内容を見直して再実行してください。",
      );
      return commentCode;
    }
  }

  // Step 2: status transition --to "In progress"
  const { cmdItemTransition } = await import("./status/transition/index.js");
  return await cmdItemTransition(
    numberStr,
    { ...options, to: "In progress", force: options.force },
    logger,
  );
}

// =============================================================================
// Factory
// =============================================================================

export function createResumeCommand(): Command {
  return new Command("resume")
    .description(
      "Blocked 解除して作業を再開する (status: In progress)。" +
        " 任意でコメント投稿後にステータス遷移する checkpoint",
    )
    .argument("<number>", "Issue 番号")
    .option(
      "--comment <file>",
      "ステータス遷移前に投稿するコメント本文ファイル（解除理由・経緯など）",
    )
    .option("--force", "ステータス遷移ルールを無視して強制遷移")
    .option("--owner <owner>", "リポジトリオーナー (デフォルト: 現在のリポジトリ)")
    .option("--public", "公開リポジトリを対象 (repoPairs 設定から)")
    .option("--repo <alias>", "クロスリポジトリのエイリアス (crossRepos 設定から)")
    .option("-v, --verbose", "詳細ログ出力")
    .action(async (number, localOpts) => {
      const logger = createActionLogger(localOpts);
      setExitCode(await cmdResume(number, localOpts, logger));
    });
}
