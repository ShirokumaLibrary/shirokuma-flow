/**
 * status update-batch - Issue ステータスを一括更新
 *
 * Issue ステータス更新と Issue コメント投稿に特化する。
 */

import { Logger } from "../../utils/logger.js";
import {
  runGraphQL,
  getRepoInfo,
  isIssueNumber,
  parseIssueNumber,
} from "../../utils/github.js";
import {
  loadGhConfig,
  getDefaultLimit,
} from "../../utils/gh-config.js";
import {
  getProjectFields,
  type ProjectField,
} from "../../utils/project-fields.js";
import {
  getIssueId,
} from "../items/helpers.js";
import {
  GRAPHQL_MUTATION_ADD_COMMENT,
  type AddCommentResult,
} from "../../utils/graphql-queries.js";
import {
  fetchActiveIssues,
  updateIssueStatus,
  findMergedPrForIssue,
  isIssueClosed,
  getGitState,
} from "../items/shared/session-utils.js";
import { closeIssueById, fetchPrsWithProjectStatus } from "../items/integrity/index.js";
import { syncParentStatus, checkChildrenAllDone } from "../../utils/parent-status.js";
import { STATUS_VALUES } from "../../utils/status-workflow.js";

// =============================================================================
// Options
// =============================================================================

export interface UpdateStatusOptions {
  owner?: string;
  verbose?: boolean;
  done?: string[];
  review?: string[];
  issueComment?: string[];
  issueCommentFile?: string;
  /** 子 Issue 未完了ガードをバイパスする */
  force?: boolean;
}

// =============================================================================
// cmdUpdateStatus - メイン処理
// =============================================================================

/**
 * Issue ステータスを一括更新する。
 * --done: 指定 Issue を Done に更新してクローズ
 * --review: 指定 Issue を Review に更新（マージ済み PR がある場合は Done）
 * --issue-comment + --issue-comment-file: Issue コメントを投稿
 */
export async function cmdUpdateStatus(
  options: UpdateStatusOptions,
  logger: Logger
): Promise<number> {
  const config = loadGhConfig();
  const repoInfo = getRepoInfo();
  if (!repoInfo) {
    logger.error("Could not determine repository");
    return 1;
  }

  const { owner: repoOwner, name: repo } = repoInfo;
  const owner = options.owner || repoOwner;

  // 未コミット変更を確認して警告
  const git = await getGitState(logger);
  const warnings: string[] = [];
  if (git.hasUncommittedChanges) {
    warnings.push(
      `${git.uncommittedChanges.length} uncommitted change(s) detected. Consider committing or stashing before updating status.`
    );
    logger.warn(
      `Warning: ${git.uncommittedChanges.length} uncommitted change(s) detected. Consider committing or stashing.`
    );
  }

  // --issue-comment は --issue-comment-file が必須
  const issueCommentNumbers = (options.issueComment ?? []).filter(isIssueNumber).map(parseIssueNumber);
  if (issueCommentNumbers.length > 0 && !options.issueCommentFile) {
    logger.error("--issue-comment-file is required when --issue-comment is specified");
    return 1;
  }

  const updatedIssues: Array<{ number: number; status: string }> = [];
  const updatedPrNumbers = new Set<number>();

  // 1. Issue ステータス更新 (--done, --review)
  const doneNumbers = (options.done ?? []).filter(isIssueNumber).map(parseIssueNumber);
  const reviewNumbers = (options.review ?? []).filter(isIssueNumber).map(parseIssueNumber);

  if (doneNumbers.length > 0 || reviewNumbers.length > 0) {
    const limit = getDefaultLimit(config);
    const issues = await fetchActiveIssues(owner, repo, limit);

    const projectIds = new Set<string>();
    for (const issue of issues) {
      if (issue.projectId) projectIds.add(issue.projectId);
    }

    const fieldsCache: Record<string, Record<string, ProjectField>> = {};
    for (const pid of projectIds) {
      fieldsCache[pid] = await getProjectFields(pid);
    }

    // OPEN リストに見つからない番号の closed 状態を確認
    const allTargetNumbers = [...new Set([...doneNumbers, ...reviewNumbers])];
    const missingNumbers = allTargetNumbers.filter(n => !issues.find(i => i.number === n));
    const closedCache = new Map<number, boolean>();
    for (const num of missingNumbers) {
      closedCache.set(num, await isIssueClosed(owner, repo, num));
    }

    // fetchActiveIssues に見つからない番号のうち PR である可能性がある場合は
    // fetchPrsWithProjectStatus でフォールバック解決する
    type PrLookup = { projectItemId: string; projectId: string; status: string | null };
    const prFallbackMap = new Map<number, PrLookup>();
    const notClosedMissingNumbers = missingNumbers.filter(n => !closedCache.get(n));
    if (notClosedMissingNumbers.length > 0) {
      const prs = await fetchPrsWithProjectStatus(owner, repo, limit);
      for (const pr of prs) {
        if (
          notClosedMissingNumbers.includes(pr.number) &&
          pr.projectItemId &&
          pr.projectId
        ) {
          prFallbackMap.set(pr.number, {
            projectItemId: pr.projectItemId,
            projectId: pr.projectId,
            status: pr.status,
          });
        }
      }
    }

    // Done の更新（Issue）
    const doneBlockedNumbers: number[] = [];
    for (const num of doneNumbers) {
      const issue = issues.find((i) => i.number === num);
      if (!issue?.projectItemId || !issue?.projectId) {
        const prFallback = prFallbackMap.get(num);
        if (prFallback) {
          const fields = fieldsCache[prFallback.projectId] ?? await getProjectFields(prFallback.projectId);
          if (await updateIssueStatus(prFallback.projectId, prFallback.projectItemId, STATUS_VALUES.DONE, fields, logger)) {
            updatedIssues.push({ number: num, status: STATUS_VALUES.DONE });
            updatedPrNumbers.add(num);
            logger.success(`PR #${num} → Done`);
          }
          continue;
        }
        if (closedCache.get(num)) {
          logger.info(`Issue #${num}: already closed, skipping`);
        } else {
          logger.warn(`Issue #${num}: not found in project, skipping status update`);
        }
        continue;
      }

      // 親 Issue の Done 遷移ガード（Issue 経路のみ、--force で API call ごと省略）
      if (options.force) {
        logger.warn(`--force: Issue #${num} の子 Issue 未完了ガードをバイパスして強制更新します`);
      } else {
        const check = await checkChildrenAllDone(owner, repo, num);
        if (!check.allDone) {
          const nums = check.openChildren.map((c) => `#${c.number}`).join(", ");
          logger.warn(`Issue #${num}: 子 Issue ${nums} が未完了です。全子 Issue の完了後に再実行してください（強制する場合は --force）`);
          doneBlockedNumbers.push(num);
          continue;
        }
      }

      const fields = fieldsCache[issue.projectId] ?? {};
      if (await updateIssueStatus(issue.projectId, issue.projectItemId, STATUS_VALUES.DONE, fields, logger)) {
        updatedIssues.push({ number: num, status: STATUS_VALUES.DONE });
        logger.success(`Issue #${num} → Done`);

        // Issue をクローズして Issue 状態と Project Status を一致させる
        const issueId = await getIssueId(owner, repo, num);
        if (issueId) {
          if (await closeIssueById(issueId)) {
            logger.success(`Issue #${num}: closed (COMPLETED)`);
          } else {
            logger.warn(`Issue #${num}: failed to close (items integrity --fix can recover)`);
          }
        } else {
          logger.warn(`Issue #${num}: could not resolve issue ID for close`);
        }
      }
    }

    // Review の更新（Issue・マージ済み PR があれば Done に自動昇格）
    for (const num of reviewNumbers) {
      const issue = issues.find((i) => i.number === num);
      if (!issue?.projectItemId || !issue?.projectId) {
        const prFallback = prFallbackMap.get(num);
        if (prFallback) {
          const fields = fieldsCache[prFallback.projectId] ?? await getProjectFields(prFallback.projectId);
          // PR 経路では findMergedPrForIssue は意味を持たない（PR を Closes する別 PR はほぼ存在しない）ため Review 固定
          if (await updateIssueStatus(prFallback.projectId, prFallback.projectItemId, STATUS_VALUES.REVIEW, fields, logger)) {
            updatedIssues.push({ number: num, status: STATUS_VALUES.REVIEW });
            updatedPrNumbers.add(num);
            logger.success(`PR #${num} → Review`);
          }
          continue;
        }
        if (closedCache.get(num)) {
          logger.info(`Issue #${num}: already closed, skipping`);
        } else {
          logger.warn(`Issue #${num}: not found in project, skipping status update`);
        }
        continue;
      }

      const fields = fieldsCache[issue.projectId] ?? {};

      const mergedPr = await findMergedPrForIssue(owner, repo, num, logger);
      const targetStatus = mergedPr ? STATUS_VALUES.DONE : STATUS_VALUES.REVIEW;

      if (await updateIssueStatus(issue.projectId, issue.projectItemId, targetStatus, fields, logger)) {
        updatedIssues.push({ number: num, status: targetStatus });
        if (mergedPr) {
          logger.success(`Issue #${num} → Done (PR #${mergedPr} merged)`);
        } else {
          logger.success(`Issue #${num} → Review`);
        }
      }
    }

    const syncedNumbers = new Set<number>();
    for (const updated of updatedIssues) {
      // PR 経路（updatedPrNumbers）は親同期の対象外。
      if (updatedPrNumbers.has(updated.number)) continue;
      // ADR-v3-025 (#2776): 読み取りが常に API 直取得になったためキャッシュ同期は不要。
      if (!syncedNumbers.has(updated.number)) {
        syncedNumbers.add(updated.number);
        await syncParentStatus(owner, repo, updated.number, logger);
      }
    }

    // ガードによりブロックされた Issue がある場合は exit 4
    if (doneBlockedNumbers.length > 0) {
      const nums = doneBlockedNumbers.map((n) => `#${n}`).join(", ");
      const output = {
        warnings: warnings.length > 0 ? warnings : undefined,
        updatedIssues,
        blocked: doneBlockedNumbers,
      };
      console.log(JSON.stringify(output, null, 2));
      logger.error(`Issue ${nums}: 子 Issue が未完了のため Done への更新をスキップしました`);
      return 4;
    }
  }

  // 2. Issue コメント投稿 (--issue-comment + --issue-comment-file)
  const issueComments: Array<{ number: number; commentId?: string }> = [];
  if (issueCommentNumbers.length > 0 && options.issueCommentFile) {
    for (const num of issueCommentNumbers) {
      const subjectId = await getIssueId(owner, repo, num);
      if (!subjectId) {
        warnings.push(`Issue #${num}: could not resolve issue ID for comment`);
        logger.warn(`Issue #${num}: could not resolve issue ID for comment, skipping`);
        continue;
      }

      // issueCommentFile は resolveFileOption により解決済み（ファイル内容がインライン展開された文字列）
      const result = await runGraphQL<AddCommentResult>(GRAPHQL_MUTATION_ADD_COMMENT, {
        subjectId,
        body: options.issueCommentFile,
      });

      if (!result.success) {
        warnings.push(`Issue #${num}: failed to post comment`);
        logger.warn(`Issue #${num}: failed to post comment, continuing`);
        continue;
      }

      const comment = result.data?.data?.addComment?.commentEdge?.node;
      issueComments.push({ number: num, commentId: comment?.id });
      logger.success(`Issue #${num}: comment posted`);
    }
  }

  // 3. 出力ビルド
  const output = {
    warnings: warnings.length > 0 ? warnings : undefined,
    issueComments: issueComments.length > 0 ? issueComments : undefined,
    updatedIssues,
  };

  console.log(JSON.stringify(output, null, 2));
  return 0;
}
