/**
 * submit <number> — Issue / PR をレビュー提出する checkpoint
 *
 * 動的ルーティング（ADR-v3-022 #2531）:
 * - issue: Backlog → Review（計画 Issue 子の計画完成）
 * - pr:    In progress → Review（PR コードレビュー依頼）
 *
 * コメント投稿はステータス遷移より先に行う（遷移失敗時もコメントを残し、再実行で重複を避けるため）。
 *
 * @since #2532 動的ルーティング対応
 */

// Commander.js action callbacks receive opts as any; types are cast at boundary.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Command } from "commander";
import {
  createActionLogger,
  setExitCode,
} from "../utils/cli-helpers.js";
import { isIssueNumber } from "../utils/github.js";
import { resolveTargetRepo } from "../utils/repo-pairs.js";
import { STATUS_VALUES } from "../utils/status-workflow.js";
import type { Logger } from "../utils/logger.js";
import type { ItemsOptions } from "./items/types.js";
import { resolveCurrentStatus } from "./status/shared/resolve-status.js";

// =============================================================================
// オプション型
// =============================================================================

export interface SubmitOptions extends ItemsOptions {
  /** コメント本文ファイルパス。指定するとステータス遷移前にコメント投稿する */
  comment?: string;
  /** 中間ステータス（status transition --via と同等） */
  via?: string;
  /** 強制遷移（status transition --force と同等） */
  force?: boolean;
}

// =============================================================================
// 実装
// =============================================================================

export async function cmdSubmit(
  numberStr: string,
  options: SubmitOptions,
  logger: Logger
): Promise<number> {
  if (!isIssueNumber(numberStr)) {
    logger.error("有効な Issue 番号を指定してください");
    return 1;
  }

  const repoInfo = resolveTargetRepo(options);
  if (!repoInfo) {
    logger.error("リポジトリを特定できません");
    return 1;
  }
  const { owner, name: repo } = repoInfo;
  const number = parseInt(numberStr, 10);

  const { status: fromStatus, isPr } = await resolveCurrentStatus(owner, repo, number, logger);
  const itemType: "issue" | "pr" = isPr ? "pr" : "issue";
  const expectedFrom = isPr ? STATUS_VALUES.IN_PROGRESS : STATUS_VALUES.BACKLOG;

  if (fromStatus !== null && fromStatus !== expectedFrom) {
    logger.error(
      `submit: ${itemType} の ${fromStatus} からは submit できません。submit は ${expectedFrom} → Review のみ許可されています`,
    );
    return 1;
  }
  const toStatus = STATUS_VALUES.REVIEW;

  // Step 1: コメント投稿（指定された場合のみ、遷移より先に実行）
  if (options.comment) {
    const { cmdAddComment } = await import("./issue/comment/index.js");
    // submit 固有の comment プロパティは cmdAddComment の AddCommentOptions に存在しないため除外する
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

  // Step 2: status transition --to Review（動的ルーティングで決定した toStatus を使用）
  const { cmdItemTransition } = await import("./status/transition/index.js");
  return await cmdItemTransition(
    numberStr,
    { ...options, to: toStatus, via: options.via, force: options.force },
    logger,
  );
}

// =============================================================================
// Factory
// =============================================================================

export function createSubmitCommand(): Command {
  return new Command("submit")
    .description(
      "Issue をレビュー提出 (status: Review)。" +
        " 任意でコメント投稿後にステータス遷移する checkpoint",
    )
    .argument("<number>", "Issue 番号")
    .option(
      "--comment <file>",
      "ステータス遷移前に投稿するコメント本文ファイル",
    )
    .option(
      "--via <status>",
      "中間ステータス (例: --via 'In progress' で Backlog → In progress → Review)",
    )
    .option("--force", "ステータス遷移ルールを無視して強制遷移")
    .option("--owner <owner>", "リポジトリオーナー (デフォルト: 現在のリポジトリ)")
    .option("--public", "公開リポジトリを対象 (repoPairs 設定から)")
    .option("--repo <alias>", "クロスリポジトリのエイリアス (crossRepos 設定から)")
    .option("-v, --verbose", "詳細ログ出力")
    .action(async (number, localOpts) => {
      const logger = createActionLogger(localOpts);
      setExitCode(await cmdSubmit(number, localOpts, logger));
    });
}
