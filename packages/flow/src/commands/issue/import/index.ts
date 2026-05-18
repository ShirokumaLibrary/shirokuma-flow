/**
 * items import サブコマンド (#1814)
 *
 * issues import から移行。公開リポジトリから Issue をインポートする。
 *
 * ワークフロー:
 * 1. 現在のリポジトリペアを解決（private ← public）
 * 2. 公開リポジトリから Issue を取得
 * 3. プライベートリポジトリに Issue を作成（クロス参照付き）
 * 4. 公開 Issue にトラッキングコメントを追加
 */

import {
  runGraphQL,
  getRepoInfo,
  parseIssueNumber,
} from "../../../utils/github.js";
import {
  detectCurrentRepoPair,
  parseRepoFullName,
} from "../../../utils/repo-pairs.js";
import {
  GRAPHQL_MUTATION_ADD_COMMENT,
  GRAPHQL_MUTATION_CREATE_ISSUE,
  getRepoId,
} from "../../../utils/graphql-queries.js";
import { addItemToProject } from "../../../utils/project-fields.js";
import { getProjectId } from "../../../utils/project-utils.js";
import { getDefaultStatus } from "../../../utils/gh-config.js";
import {
  GRAPHQL_QUERY_ISSUE_DETAIL as ISSUE_DETAIL_QUERY,
  setFieldsWithStatusRouting,
} from "../../../utils/issue-detail.js";
import { getIssueId } from "../../items/helpers.js";
import type { Logger } from "../../../utils/logger.js";
import type { ImportOptions } from "../../items/types.js";

// =============================================================================
// Command
// =============================================================================

/**
 * items import サブコマンド - 公開リポジトリから Issue をインポートする。
 */
export async function cmdImport(
  options: ImportOptions,
  logger: Logger
): Promise<number> {
  if (!options.fromPublic) {
    logger.error("--from-public <number> is required for import");
    logger.info("Usage: shirokuma-flow items import --from-public 5");
    return 1;
  }

  const publicIssueNumber = parseIssueNumber(options.fromPublic);

  const privateRepo = getRepoInfo();
  if (!privateRepo) {
    logger.error("Could not determine current repository");
    return 1;
  }

  const pair = detectCurrentRepoPair();
  if (!pair) {
    logger.error(
      "No repo pair found for current repository. Configure repoPairs in config."
    );
    return 1;
  }

  const publicRepoParsed = parseRepoFullName(pair.public);
  if (!publicRepoParsed) {
    logger.error(`Invalid public repo: ${pair.public}`);
    return 1;
  }

  logger.info(`Importing issue #${publicIssueNumber} from ${pair.public}`);

  interface IssueNode {
    number?: number;
    title?: string;
    body?: string;
    url?: string;
    state?: string;
    labels?: { nodes?: Array<{ name?: string }> };
  }

  interface QueryResult {
    data?: {
      repository?: {
        issue?: IssueNode;
      };
    };
  }

  const fetchResult = await runGraphQL<QueryResult>(ISSUE_DETAIL_QUERY, {
    owner: publicRepoParsed.owner,
    name: publicRepoParsed.name,
    number: publicIssueNumber,
  });

  if (!fetchResult.success || !fetchResult.data?.data?.repository?.issue) {
    logger.error(`Issue #${publicIssueNumber} not found in ${pair.public}`);
    return 1;
  }

  const publicIssue = fetchResult.data.data.repository.issue;
  const publicUrl = publicIssue.url ?? `https://github.com/${pair.public}/issues/${publicIssueNumber}`;

  const importTitle = `[Public #${publicIssueNumber}] ${publicIssue.title ?? "Imported Issue"}`;
  const importBody = [
    `> Imported from public repo: ${publicUrl}`,
    "",
    "---",
    "",
    publicIssue.body ?? "",
  ].join("\n");

  const { owner, name: repo } = privateRepo;
  const repoId = await getRepoId(owner, repo);
  if (!repoId) {
    logger.error("Could not get repository ID for private repo");
    return 1;
  }

  interface CreateResult {
    data?: {
      createIssue?: {
        issue?: { id?: string; number?: number; url?: string; title?: string };
      };
    };
  }

  const createResult = await runGraphQL<CreateResult>(GRAPHQL_MUTATION_CREATE_ISSUE, {
    repositoryId: repoId,
    title: importTitle,
    body: importBody,
    labelIds: null,
  });

  if (!createResult.success) {
    logger.error("Failed to create issue in private repo");
    return 1;
  }

  const privateIssue = createResult.data?.data?.createIssue?.issue;
  if (!privateIssue?.number) {
    logger.error("Failed to create issue in private repo");
    return 1;
  }

  logger.success(`Created private issue #${privateIssue.number}`);

  const importStatusValue = options.fieldStatus ?? getDefaultStatus();
  const projectId = await getProjectId(owner, repo);
  if (projectId && privateIssue.id) {
    const itemId = await addItemToProject(projectId, privateIssue.id, logger);
    if (itemId) {
      logger.success("Added to project");
      // ADR-v3-014 / FIX-4 (#2159): Status は `autoSetTimestamps` を発動させるため `updateProjectStatus` 経由で設定する。
      // 新規追加のため `previousStatus: undefined`（Backlog / Pending 等のマッピング対象外ステータスは
      // `autoSetTimestamps` 内でサイレントスキップされる）。重複パターンを setFieldsWithStatusRouting に集約 (#2173)。
      const nonStatusFields: Record<string, string> = {};
      if (options.priority) nonStatusFields["Priority"] = options.priority;
      if (options.size) nonStatusFields["Size"] = options.size;
      await setFieldsWithStatusRouting({
        projectId,
        itemId,
        nonStatusFields,
        statusValue: importStatusValue,
        logger,
        previousStatus: undefined,
      });
    }
  }

  const publicIssueId = await getIssueId(publicRepoParsed.owner, publicRepoParsed.name, publicIssueNumber);
  if (publicIssueId) {
    const commentBody = `This issue is being tracked internally. Thank you for the report.`;
    await runGraphQL(GRAPHQL_MUTATION_ADD_COMMENT, {
      subjectId: publicIssueId,
      body: commentBody,
    });
    logger.debug("Added tracking comment to public issue");
  }

  const output = {
    private_issue: {
      number: privateIssue.number,
      title: privateIssue.title,
      url: privateIssue.url,
    },
    public_issue: {
      number: publicIssueNumber,
      url: publicUrl,
      repo: pair.public,
    },
  };

  console.log(JSON.stringify(output, null, 2));
  return 0;
}
