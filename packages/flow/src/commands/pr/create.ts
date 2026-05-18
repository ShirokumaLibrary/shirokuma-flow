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
import { getOctokit } from "../../utils/octokit-client.js";
import { resolveTargetRepo } from "../../utils/repo-pairs.js";
import { getCurrentBranch, inferIssueFromBranch } from "../../utils/git-local.js";
import { runGraphQL } from "../../utils/github.js";
import { dryRunPreview } from "../../utils/dry-run.js";
import {
  addItemToProject,
  getProjectFields,
} from "../../utils/project-fields.js";
import { getProjectId } from "../../utils/project-utils.js";
import { STATUS_VALUES } from "../../utils/status-workflow.js";
import { getIssueDetail, resolveAndUpdateStatus, updateProjectStatus } from "../../utils/issue-detail.js";
import {
  syncParentStatus,
  fetchPlanIssueForParent,
  fetchParentNumber,
} from "../../utils/parent-status.js";
import { parseLinkedIssues } from "./helpers.js";
import { resolveIntegrationBaseBranch } from "./integration-branch-resolver.js";
import type { IssuesPrOptions } from "./types.js";

// =============================================================================
// GraphQL クエリ定義
// =============================================================================

/** ブランチ推論で得た Issue 番号から親 Issue 情報を取得するクエリ */
const GRAPHQL_QUERY_ISSUE_PARENT = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      parent {
        number
        body
      }
    }
  }
}
`;

interface IssueParentResult {
  data?: {
    repository?: {
      issue?: {
        parent?: {
          number?: number;
          body?: string;
        } | null;
      };
    };
  };
}

// =============================================================================
// cmdPrCreate (#986 — PR 作成)
// =============================================================================

export async function cmdPrCreate(
  options: IssuesPrOptions,
  logger: Logger
): Promise<number> {
  if (!options.title) {
    logger.error("--title is required (PR title)");
    return 1;
  }

  const repoInfo = resolveTargetRepo(options);
  if (!repoInfo) {
    logger.error("Could not determine repository");
    return 1;
  }

  const { owner, name: repo } = repoInfo;

  // Resolve head branch: explicit --head or current git branch
  const headBranch = options.head ?? getCurrentBranch() ?? undefined;
  if (!headBranch) {
    logger.error("Could not determine source branch. Specify --head <branch>.");
    return 1;
  }

  // Issue 番号の決定と本文への Closes 注入を分離する。
  // - targetIssue: 本文の既存 Closes #N を最優先し、無ければブランチ名から推論
  // - 注入: 本文に既存 Closes が無い場合のみ（二重注入防止）
  // - Integration 解決: targetIssue が取れれば常に実行（#2169 再発防止）
  let body = options.bodyFile ?? "";
  const linkedIssuesInBody = parseLinkedIssues(body);
  const targetIssue: number | null =
    linkedIssuesInBody[0] ?? inferIssueFromBranch(headBranch) ?? null;

  if (linkedIssuesInBody.length === 0 && targetIssue !== null) {
    body = body ? `${body}\n\nCloses #${targetIssue}` : `Closes #${targetIssue}`;
    logger.debug(`ブランチ名 "${headBranch}" から Issue #${targetIssue} を推論し、本文に注入しました`);
  } else if (targetIssue === null) {
    logger.debug(`ブランチ名 "${headBranch}" から Issue 番号を推論できませんでした`);
  }

  let baseBranch: string;
  let cachedTargetParentNumber: number | null | undefined = undefined;
  if (targetIssue !== null) {
    let parentNumber: number | null = null;
    let parentBody: string | null = null;

    const parentResult = await runGraphQL<IssueParentResult>(
      GRAPHQL_QUERY_ISSUE_PARENT,
      { owner, name: repo, number: targetIssue }
    );
    if (parentResult.success) {
      const parent = parentResult.data?.data?.repository?.issue?.parent;
      parentNumber = parent?.number ?? null;
      parentBody = parent?.body ?? null;
      if (parentNumber !== null) {
        cachedTargetParentNumber = parentNumber;
      }
    } else {
      logger.warn(
        `Issue #${targetIssue} の親情報取得に失敗しました。Integration ブランチ判定をスキップします`
      );
    }

    const baseResolution = await resolveIntegrationBaseBranch({
      parentNumber,
      parentBody,
      optionsBase: options.base,
      logger,
    });
    if (!baseResolution) {
      return 1;
    }
    baseBranch = baseResolution.baseBranch;
  } else if (options.base) {
    baseBranch = options.base;
  } else {
    logger.error("--base is required (target branch)");
    logger.info(
      "Usage: shirokuma-flow pr create --base develop --title \"feat: ...\" [body-file]"
    );
    return 1;
  }

  // Dry-run: preview parameters without creating (#1338)
  if (options.dryRun) {
    return dryRunPreview({
      command: "pr",
      operation: "create",
      params: {
        repository: `${owner}/${repo}`,
        title: options.title,
        head: headBranch,
        base: baseBranch,
        body: body ? "(body content)" : "",
        add_to_project: true,
      },
    }, logger);
  }

  const octokit = getOctokit();

  try {
    const { data } = await octokit.rest.pulls.create({
      owner,
      repo,
      title: options.title,
      body,
      head: headBranch,
      base: baseBranch,
    });

    logger.success(`Created PR #${data.number}: ${data.title}`);

    let projectItemId: string | null = null;
    const projectId = await getProjectId(owner, repo);

    if (projectId) {
      projectItemId = await addItemToProject(projectId, data.node_id, logger);
      if (projectItemId) {
        // ADR-v3-014 FIX-1 (#2155): autoSetTimestamps を発動させるため updateProjectStatus 経由で設定。
        // PR 新規追加時は遷移前ステータスなし（previousStatus: undefined）。
        const projectFields = await getProjectFields(projectId);
        await updateProjectStatus({
          projectId,
          itemId: projectItemId,
          statusValue: STATUS_VALUES.REVIEW,
          projectFields,
          logger,
          previousStatus: undefined,
        });
        logger.success("プロジェクトに追加しました（Review）");
      } else {
        logger.warn("プロジェクトへの追加に失敗しました");
      }
    }

    // PR 本文からリンク Issue を解析し、In progress → Review に自動設定（best-effort）
    // 注入した場合は targetIssue を使い、既存リンクがあればそれを使う（parseLinkedIssues 再実行を回避）
    const linkedIssueNumbers =
      linkedIssuesInBody.length === 0 && targetIssue !== null
        ? [targetIssue]
        : linkedIssuesInBody;

    for (const issueNumber of linkedIssueNumbers) {
      try {
        let parentNumber: number | null;
        if (issueNumber === targetIssue && cachedTargetParentNumber !== undefined) {
          parentNumber = cachedTargetParentNumber;
        } else {
          parentNumber = await fetchParentNumber(owner, repo, issueNumber, logger);
          if (issueNumber === targetIssue) {
            cachedTargetParentNumber = parentNumber;
          }
        }

        if (parentNumber !== null) {
          const planIssue = await fetchPlanIssueForParent(owner, repo, parentNumber, logger);

          if (planIssue !== null) {
            const planStatus = planIssue.projectItems?.nodes
              ?.find((pi) => pi.status?.name != null)
              ?.status?.name ?? null;
            if (planStatus !== STATUS_VALUES.IN_PROGRESS) {
              logger.debug(`計画 Issue #${planIssue.number} は ${planStatus ?? "unknown"} のため Review 設定をスキップ（リンク Issue #${issueNumber}）`);
              continue;
            }
            const result = await resolveAndUpdateStatus(owner, repo, planIssue.number, STATUS_VALUES.REVIEW, logger);
            if (!result.success) {
              logger.debug(`計画 Issue #${planIssue.number} の Review 設定をスキップ: ${result.reason ?? "unknown"}`);
              continue;
            }
            logger.success(`計画 Issue #${planIssue.number} → Review (PR 作成に伴う自動設定、リンク Issue #${issueNumber})`);
            await syncParentStatus(owner, repo, planIssue.number, logger);
            continue;
          }
        }

        // 計画 Issue がない場合は対象 Issue を直接 Review に遷移
        const detail = await getIssueDetail(owner, repo, issueNumber);
        if (detail?.status !== STATUS_VALUES.IN_PROGRESS) {
          logger.debug(`Issue #${issueNumber} は ${detail?.status ?? "unknown"} のため Review 設定をスキップ`);
          continue;
        }
        const result = await resolveAndUpdateStatus(owner, repo, issueNumber, STATUS_VALUES.REVIEW, logger);
        if (!result.success) {
          logger.debug(`Issue #${issueNumber} の Review 設定をスキップ: ${result.reason ?? "unknown"}`);
          continue;
        }
        logger.success(`Issue #${issueNumber} → Review (PR 作成に伴う自動設定)`);
        await syncParentStatus(owner, repo, issueNumber, logger);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.debug(`Issue #${issueNumber} の Review 設定をスキップ: ${msg}`);
      }
    }

    const output = {
      number: data.number,
      title: data.title,
      url: data.html_url,
      head_branch: data.head.ref,
      base_branch: data.base.ref,
      project_item_id: projectItemId,
    };

    console.log(JSON.stringify(output, null, 2));
    return 0;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to create PR: ${errorMsg}`);
    return 1;
  }
}
