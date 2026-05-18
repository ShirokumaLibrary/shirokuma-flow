/**
 * PR create from issue number - Issue 番号を起点に PR を作成する (#2024 Phase 2-B)
 *
 * Issue 番号からターゲットブランチ・タイトル・本文を自動判定して PR を作成する。
 * `items pr create #{number}` で呼び出される。
 *
 * - ターゲットブランチ: 親 Issue がある場合は Integration ブランチ、なければ develop
 * - PR タイトル: Issue Type からプレフィックスを推定
 * - PR 本文: Closes #{number} を含むテンプレートを生成
 * - バリデーション: In Progress または Completed であること
 */

import { Logger } from "../../utils/logger.js";
import { getOctokit } from "../../utils/octokit-client.js";
import { resolveTargetRepo } from "../../utils/repo-pairs.js";
import { getCurrentBranch } from "../../utils/git-local.js";
import { runGraphQL, parseIssueNumber, isIssueNumber } from "../../utils/github.js";
import {
  addItemToProject,
  getProjectFields,
} from "../../utils/project-fields.js";
import { getProjectId } from "../../utils/project-utils.js";
import { STATUS_VALUES, LEGACY_STATUS_VALUES } from "../../utils/status-workflow.js";
import { getIssueDetail, updateProjectStatus } from "../../utils/issue-detail.js";
import { execFileAsync } from "../../utils/spawn-async.js";
import { resolveIntegrationBaseBranch } from "./integration-branch-resolver.js";
import type { IssuesPrOptions } from "./types.js";

// =============================================================================
// GraphQL クエリ定義
// =============================================================================

const GRAPHQL_QUERY_ISSUE_FOR_PR = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      number
      title
      body
      state
      issueType { name }
      labels(first: 20) { nodes { name } }
      parent {
        number
        title
        body
        issueType { name }
      }
      projectItems(first: 5) {
        nodes {
          status: fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue { name }
          }
        }
      }
    }
  }
}
`;

// =============================================================================
// 型定義
// =============================================================================

interface IssueForPRResult {
  data?: {
    repository?: {
      issue?: {
        number?: number;
        title?: string;
        body?: string;
        state?: string;
        issueType?: { name?: string };
        labels?: { nodes?: Array<{ name?: string }> };
        parent?: {
          number?: number;
          title?: string;
          body?: string;
          issueType?: { name?: string };
        } | null;
        projectItems?: {
          nodes?: Array<{
            status?: { name?: string } | null;
          }>;
        };
      };
    };
  };
}

// =============================================================================
// ヘルパー関数
// =============================================================================

/**
 * Issue Type からブランチプレフィックス（PR タイトルプレフィックス）を推定する。
 */
function inferPrefixFromIssueType(issueType: string | undefined): string {
  if (!issueType) return "feat";
  const lower = issueType.toLowerCase();
  if (lower === "bug") return "fix";
  if (lower === "task" || lower === "chore") return "chore";
  if (lower === "refactor") return "refactor";
  if (lower === "docs") return "docs";
  return "feat";
}

/**
 * PR タイトルを自動生成する。
 * - prefix は Issue Type から推定
 * - 70文字以内
 */
function generatePRTitle(title: string, issueType: string | undefined): string {
  const prefix = inferPrefixFromIssueType(issueType);
  const fullTitle = `${prefix}: ${title}`;
  if (fullTitle.length <= 70) return fullTitle;
  return fullTitle.substring(0, 67) + "...";
}

/**
 * PR 本文テンプレートを生成する。
 */
function generatePRBody(issueNumber: number, issueBody: string | undefined): string {
  const summary = issueBody
    ? issueBody.split("\n").slice(0, 5).join("\n")
    : "";

  return `## 概要

${summary}

## 関連 Issue

Closes #${issueNumber}

## テスト計画

- [ ] 動作確認
`;
}

// =============================================================================
// コマンドエントリポイント
// =============================================================================

/**
 * Issue 番号を起点に PR を作成する。
 */
export async function cmdPrCreateFromIssue(
  numberStr: string,
  options: IssuesPrOptions & { draft?: boolean },
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
  const issueNumber = parseIssueNumber(numberStr);

  // Issue 情報を取得
  const issueResult = await runGraphQL<IssueForPRResult>(
    GRAPHQL_QUERY_ISSUE_FOR_PR,
    { owner, name: repo, number: issueNumber }
  );

  if (!issueResult.success || !issueResult.data?.data?.repository?.issue) {
    logger.error(`Issue #${issueNumber} が見つかりません`);
    return 1;
  }

  const issue = issueResult.data.data.repository.issue;

  // バリデーション: 現在のブランチが develop/main でないこと
  const currentBranch = getCurrentBranch();
  if (currentBranch === "develop" || currentBranch === "main") {
    logger.error(`現在のブランチ (${currentBranch}) から PR を作成することはできません`);
    return 1;
  }

  // バリデーション: In Progress であること（ADR-v3-013: Completed は廃止）
  const currentStatus = issue.projectItems?.nodes?.[0]?.status?.name;
  const isInProgress = currentStatus === STATUS_VALUES.IN_PROGRESS || currentStatus === LEGACY_STATUS_VALUES.IN_PROGRESS_LEGACY;
  if (currentStatus && !isInProgress) {
    logger.error(`Issue #${issueNumber} は ${currentStatus} です。In Progress の Issue に対してのみ PR を作成できます`);
    return 1;
  }

  const baseResolution = await resolveIntegrationBaseBranch({
    parentNumber: issue.parent?.number ?? null,
    parentBody: issue.parent?.body ?? null,
    optionsBase: options.base,
    logger,
  });
  if (!baseResolution) {
    return 1;
  }
  const { baseBranch, isIntegrationTarget } = baseResolution;

  // PR タイトルを自動生成
  const prTitle = options.title ?? generatePRTitle(issue.title ?? "", issue.issueType?.name);

  // PR 本文を生成
  const prBody = options.bodyFile ?? generatePRBody(issueNumber, issue.body);

  // ヘッドブランチを解決
  const headBranch = options.head ?? currentBranch ?? undefined;
  if (!headBranch) {
    logger.error("ソースブランチを特定できません。--head オプションを指定してください");
    return 1;
  }

  // dry-run
  if (options.dryRun) {
    logger.info("[dry-run] PR 作成パラメータ:");
    console.log(JSON.stringify({
      title: prTitle,
      head: headBranch,
      base: baseBranch,
      issue: issueNumber,
      is_integration_target: isIntegrationTarget,
    }, null, 2));
    return 0;
  }

  const octokit = getOctokit();

  try {
    // 現在のブランチをプッシュ
    await execFileAsync("git", ["push", "-u", "origin", headBranch]);

    const { data } = await octokit.rest.pulls.create({
      owner,
      repo,
      title: prTitle,
      body: prBody,
      head: headBranch,
      base: baseBranch,
      draft: (options as { draft?: boolean }).draft ?? false,
    });

    logger.success(`PR #${data.number} を作成しました: ${data.title}`);

    // プロジェクトに追加
    const projectId = await getProjectId(owner, repo);
    if (projectId) {
      const projectItemId = await addItemToProject(projectId, data.node_id, logger);
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
      }
    }

    // Integration ブランチターゲットの場合は Issue にコメントを投稿
    if (isIntegrationTarget) {
      const GRAPHQL_MUTATION_ADD_COMMENT = `
mutation($subjectId: ID!, $body: String!) {
  addComment(input: {subjectId: $subjectId, body: $body}) {
    commentEdge { node { id } }
  }
}
`;
      interface IssueIdResult {
        data?: { repository?: { issue?: { id?: string } } };
      }
      const idResult = await runGraphQL<IssueIdResult>(
        `query($owner: String!, $name: String!, $number: Int!) {
          repository(owner: $owner, name: $name) {
            issue(number: $number) { id }
          }
        }`,
        { owner, name: repo, number: issueNumber }
      );

      const issueId = idResult.success ? idResult.data?.data?.repository?.issue?.id : undefined;
      if (issueId) {
        interface AddCommentResult {
          data?: { addComment?: { commentEdge?: { node?: { id?: string } } } };
        }
        await runGraphQL<AddCommentResult>(GRAPHQL_MUTATION_ADD_COMMENT, {
          subjectId: issueId,
          body: `PR #${data.number} を作成しました: ${data.html_url}`,
        });
      }
    }

    console.log(JSON.stringify({
      number: data.number,
      url: data.html_url,
      title: data.title,
      base: baseBranch,
      head: headBranch,
      issue: issueNumber,
      is_integration_target: isIntegrationTarget,
      draft: (options as { draft?: boolean }).draft ?? false,
    }, null, 2));
    return 0;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`PR 作成に失敗しました: ${errorMsg}`);
    return 1;
  }
}
