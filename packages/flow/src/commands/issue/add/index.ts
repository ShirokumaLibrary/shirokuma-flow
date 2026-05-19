/**
 * items add issue - Issue 作成ロジック (#1808)
 *
 * @related pull/issue.ts - Issue 取得・キャッシュ書き込み
 * @related push/issue.ts - Issue 本体の push ロジック
 */

import {
  runGraphQL,
  validateTitle,
  validateBody,
} from "../../../utils/github.js";
import { getOctokit } from "../../../utils/octokit-client.js";
import { resolveTargetRepo } from "../../../utils/repo-pairs.js";
import {
  GRAPHQL_MUTATION_CREATE_ISSUE,
  GRAPHQL_MUTATION_CREATE_LABEL,
  getRepoId,
} from "../../../utils/graphql-queries.js";
import { addItemToProject } from "../../../utils/project-fields.js";
import { getProjectId } from "../../../utils/project-utils.js";
import { getDefaultStatus, loadGhConfig, type LabelRule } from "../../../utils/gh-config.js";
import { setFieldsWithStatusRouting } from "../../../utils/issue-detail.js";
import { getLabels, normalizeLabels, resolveIssueTypeId } from "../../items/helpers.js";
import { validateInitialStatus } from "../../../utils/status-workflow.js";
import {
  writeCache,
  upsertOpenIssuesEntry,
  getCachePath,
} from "../../../utils/github-cache.js";
import { moveFile } from "../../../utils/file.js";
import { readFileWithFrontmatter } from "../../items/add/shared.js";
import type { Logger } from "../../../utils/logger.js";
import type { AddIssueOptions } from "../../items/types.js";

// =============================================================================
// labelRules ヘルパー
// =============================================================================

/**
 * labelRules から一致するルールを検索する。
 */
function findMatchingLabelRule(labelName: string, rules?: LabelRule[]): LabelRule | undefined {
  if (!rules) return undefined;
  return rules.find((rule) => matchLabelPattern(rule.pattern, labelName));
}

/**
 * パターンマッチを行う（末尾ワイルドカードのみサポート）。
 * - "*" はすべてに一致
 * - "area:*" のように末尾 "*" はプレフィックス一致
 * - それ以外は完全一致（中間ワイルドカード `a*b` 等もそのまま文字列比較）
 */
function matchLabelPattern(pattern: string, name: string): boolean {
  if (pattern === "*") return true;
  if (pattern.endsWith("*")) {
    return name.startsWith(pattern.slice(0, -1));
  }
  return pattern === name;
}

/**
 * ルールに基づいてラベルを自動作成し、作成されたラベル ID を返す。
 * 失敗した場合は null を返す。
 */
async function createLabelByRule(
  repoId: string,
  labelName: string,
  rule: LabelRule,
  logger: Logger,
  allLabels: Record<string, string>
): Promise<string | null> {
  interface CreateLabelResult {
    data?: {
      createLabel?: {
        label?: { id: string; name: string };
      };
    };
  }

  const result = await runGraphQL<CreateLabelResult>(GRAPHQL_MUTATION_CREATE_LABEL, {
    repositoryId: repoId,
    name: labelName,
    color: rule.color,
    description: rule.description || "",
  });

  if (!result.success) {
    // ラベルが既に存在する場合（競合状態）は呼び出し元の allLabels から ID を返す
    const errorMsg = result.error ?? "";
    if (errorMsg.includes("already exists") || errorMsg.includes("Name has already been taken")) {
      logger.info(`ラベル '${labelName}' は既に存在します。既存ラベルを使用します`);
      return allLabels[labelName] ?? null;
    }
    logger.warn(`ラベル '${labelName}' の自動作成に失敗しました: ${errorMsg}`);
    return null;
  }

  const labelId = result.data?.data?.createLabel?.label?.id ?? null;
  if (labelId) {
    logger.info(`ラベル '${labelName}' を自動作成しました`);
  }
  return labelId;
}

// =============================================================================
// items add issue
// =============================================================================

/**
 * Issue を作成する。
 * frontmatter から title/status/priority/size/labels/assignees を読み取る。
 *
 * @param file - frontmatter 付き Markdown ファイルパス
 * @param options - 追加オプション
 * @param logger - ロガー
 */
export async function cmdAddIssue(
  file: string | undefined,
  options: AddIssueOptions,
  logger: Logger
): Promise<number> {
  if (!file) {
    logger.error("file 引数は必須です");
    return 1;
  }

  const repoInfo = resolveTargetRepo(options);
  if (!repoInfo) {
    logger.error("Could not determine repository");
    return 1;
  }

  const { owner, name: repo } = repoInfo;

  // ファイルを読み込む
  const fileData = readFileWithFrontmatter(file, logger);
  if (!fileData) {
    logger.error(`ファイルが見つかりません: ${file}`);
    return 1;
  }

  const { body, meta } = fileData;

  // frontmatter からフィールドを抽出
  const title = typeof meta["title"] === "string" ? meta["title"] : "";
  const issueTypeName = typeof meta["type"] === "string" ? meta["type"] : undefined;
  const statusValue = typeof meta["status"] === "string" ? meta["status"] : undefined;
  const priorityValue = typeof meta["priority"] === "string" ? meta["priority"] : undefined;
  const sizeValue = typeof meta["size"] === "string" ? meta["size"] : undefined;
  const labelsList = Array.isArray(meta["labels"]) ?
    (meta["labels"] as unknown[]).filter((l): l is string => typeof l === "string") : [];
  const assigneesList = Array.isArray(meta["assignees"])
    ? (meta["assignees"] as unknown[]).filter((a): a is string => typeof a === "string")
    : [];

  if (!title) {
    logger.error("frontmatter に title フィールドが必要です");
    return 1;
  }

  // 初期ステータスの検証（Backlog のみ許可、ADR-v3-022 第二改訂版 #2531）
  // frontmatter 指定値と getDefaultStatus() フォールバックの両方を検証する
  const createStatusValue = statusValue ?? getDefaultStatus();
  if (createStatusValue) {
    const statusError = validateInitialStatus(createStatusValue);
    if (statusError) {
      logger.error(statusError);
      return 1;
    }
  }

  const titleError = validateTitle(title);
  if (titleError) {
    logger.error(titleError);
    return 1;
  }

  const bodyError = validateBody(body);
  if (bodyError) {
    logger.error(bodyError);
    return 1;
  }

  // リポジトリ ID を取得
  const repoId = await getRepoId(owner, repo);
  if (!repoId) {
    logger.error("Could not get repository ID");
    return 1;
  }

  // ラベル ID を解決
  let labelIds: string[] | null = null;
  if (labelsList.length > 0) {
    const allLabels = await getLabels(owner, repo);
    const config = loadGhConfig();
    labelIds = [];
    for (const labelName of normalizeLabels(labelsList)) {
      if (allLabels[labelName]) {
        labelIds.push(allLabels[labelName]);
      } else {
        // labelRules でパターン照合 → 自動作成
        const rule = findMatchingLabelRule(labelName, config.labelRules);
        if (rule) {
          const createdId = await createLabelByRule(repoId, labelName, rule, logger, allLabels);
          if (createdId) {
            labelIds.push(createdId);
          }
        } else {
          logger.warn(`ラベル '${labelName}' が見つかりません`);
        }
      }
    }
  }

  // IssueType ID を解決（frontmatter に type フィールドがある場合）
  let issueTypeId: string | null = null;
  if (issueTypeName) {
    const resolved = await resolveIssueTypeId(owner, issueTypeName, logger);
    if (resolved === false) return 1;
    issueTypeId = resolved;
  }

  // Issue を作成
  interface CreateResult {
    data?: {
      createIssue?: {
        issue?: { id?: string; number?: number; url?: string; title?: string };
      };
    };
  }

  const createResult = await runGraphQL<CreateResult>(GRAPHQL_MUTATION_CREATE_ISSUE, {
    repositoryId: repoId,
    title,
    body,
    labelIds: labelIds ?? null,
    issueTypeId,
  });

  if (!createResult.success) {
    logger.error("Issue の作成に失敗しました");
    return 1;
  }

  const issue = createResult.data?.data?.createIssue?.issue;
  if (!issue?.id || !issue?.number) {
    logger.error("Issue の作成に失敗しました");
    return 1;
  }

  logger.success(`Issue #${issue.number} を作成しました`);
  const issueNumber = issue.number;

  // 担当者を設定（frontmatter に assignees フィールドがある場合）
  let resolvedAssignees = [...assigneesList];
  if (assigneesList.length > 0) {
    const octokit = getOctokit();
    if (resolvedAssignees.includes("@me")) {
      try {
        const { data: authUser } = await octokit.rest.users.getAuthenticated();
        resolvedAssignees = resolvedAssignees.map((a) => a === "@me" ? authUser.login : a);
      } catch {
        logger.warn("@me の解決に失敗しました");
        resolvedAssignees = resolvedAssignees.filter((a) => a !== "@me");
      }
    }
    if (resolvedAssignees.length > 0) {
      try {
        await octokit.rest.issues.addAssignees({
          owner,
          repo,
          issue_number: issue.number,
          assignees: resolvedAssignees,
        });
        logger.success(`担当者を設定しました: ${resolvedAssignees.join(", ")}`);
      } catch (err) {
        logger.warn(`担当者の設定に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // Projects に追加してフィールドを設定
  let projectItemId: string | null = null;
  const projectId = await getProjectId(owner, repo);

  if (projectId) {
    projectItemId = await addItemToProject(projectId, issue.id, logger);
    if (projectItemId) {
      logger.success("プロジェクトに追加しました");

      // ADR-v3-014 / FIX-5 (#2161): Status は `updateProjectStatus` 経由で設定する（#2207 型レベル強制）。
      // 重複パターンを setFieldsWithStatusRouting に集約 (#2173)。
      const nonStatusFields: Record<string, string> = {};
      if (priorityValue) nonStatusFields["Priority"] = priorityValue;
      if (sizeValue) nonStatusFields["Size"] = sizeValue;
      await setFieldsWithStatusRouting({
        projectId,
        itemId: projectItemId,
        nonStatusFields,
        statusValue: createStatusValue,
        logger,
      });
    }
  }

  // キャッシュに書き込む
  writeCache(
    issueNumber,
    {
      number: issueNumber,
      type: "issue",
      title,
      status: createStatusValue ?? undefined,
      priority: priorityValue,
      size: sizeValue,
      labels: labelsList.length > 0 ? labelsList : undefined,
      assignees: resolvedAssignees.length > 0 ? resolvedAssignees : undefined,
      updated_at: new Date().toISOString(),
      issue_type: issueTypeName,
      state: "OPEN",
    },
    body,
    owner,
    repo
  );

  // open-issues インデックスにエントリを追加
  upsertOpenIssuesEntry({
    number: issueNumber,
    type: "issue",
    title,
    status: createStatusValue ?? undefined,
    priority: priorityValue,
    size: sizeValue,
  }, owner, repo);

  // ファイルをキャッシュディレクトリに移動
  const destPath = getCachePath(issueNumber, "issue", owner, repo);
  try {
    moveFile(file, destPath);
    logger.info(`ファイルをキャッシュに移動しました: ${destPath}`);
  } catch {
    logger.warn(`ファイルの移動に失敗しました（キャッシュは書き込み済み）`);
  }

  console.log(JSON.stringify({
    number: issueNumber,
    url: issue.url,
    type: "issue",
    title: issue.title,
    status: createStatusValue ?? undefined,
    project_item_id: projectItemId,
    cache_file: destPath,
  }, null, 2));
  return 0;
}
