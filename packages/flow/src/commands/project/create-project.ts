/**
 * projects create-project subcommand
 *
 * @deprecated コマンドとして無効化済み（2026-03-03, Issue #1202）。
 * GitHub の createProjectV2 API ではワークフロー（Item closed→Done 等）が
 * デフォルト無効で作成され、有効化する API も存在しないため、
 * Web UI 手動作成 + `projects setup` フローへ移行した。
 * API が整備された際（updateProjectV2Workflow 等が公開された場合）に
 * 再有効化する想定でコードを保持する。
 * See: Knowledge Discussion #1199, Issue #1167, Issue #1202
 *
 * 1. gh project create で Project を作成
 * 2. gh project link でリポジトリにリンク
 * 3. Discussions を自動有効化
 * 4. cmdSetup() でフィールド初期設定
 */

import { Logger } from "../../utils/logger.js";
import {
  diagnoseRepoFailure,
} from "../../utils/github.js";
import { getOctokit } from "../../utils/octokit-client.js";
import { getRepoId } from "../../utils/graphql-queries.js";
import {
  getOwnerNodeId,
} from "../../utils/project-utils.js";
import {
  runGraphQL,
  getOwner,
  getRepoName,
  getProjectId,
} from "./helpers.js";
import { cmdSetup, type SetupOptions } from "./setup.js";

/** create-project サブコマンドのオプション */
type CreateProjectOptions = SetupOptions;

/**
 * create-project subcommand - Project 作成からフィールド設定まで一括実行
 */
export async function cmdCreateProject(
  options: CreateProjectOptions,
  logger: Logger,
): Promise<number> {
  if (!options.title) {
    logger.error("--title is required");
    logger.info("Usage: shirokuma-flow projects create-project --title \"Project Name\" [--lang ja]");
    return 1;
  }

  const owner = options.owner || getOwner();
  const repo = getRepoName();
  if (!owner || !repo) {
    const diagnosis = await diagnoseRepoFailure();
    logger.error(`Could not determine repository owner/name: ${diagnosis.cause}`);
    logger.info(`  ${diagnosis.suggestion}`);
    return 1;
  }

  // ステップ 1: Project 作成 (GraphQL mutation: createProjectV2)
  logger.info(`[1/4] Creating project "${options.title}"...`);

  const ownerId = await getOwnerNodeId(owner);
  if (!ownerId) {
    logger.error(`Could not resolve owner ID for '${owner}'`);
    return 1;
  }

  const GRAPHQL_MUTATION_CREATE_PROJECT = `
    mutation($ownerId: ID!, $title: String!) {
      createProjectV2(input: {ownerId: $ownerId, title: $title}) {
        projectV2 {
          id
          number
          url
        }
      }
    }
  `;

  interface CreateProjectResult {
    data?: {
      createProjectV2?: {
        projectV2?: {
          id?: string;
          number?: number;
          url?: string;
        };
      };
    };
  }

  const createResult = await runGraphQL<CreateProjectResult>(GRAPHQL_MUTATION_CREATE_PROJECT, {
    ownerId,
    title: options.title,
  });

  if (!createResult.success) {
    logger.error(`Failed to create project: ${createResult.error}`);
    return 1;
  }

  const createdProject = createResult.data?.data?.createProjectV2?.projectV2;
  const projectNumber = createdProject?.number;
  const projectUrl = createdProject?.url;
  if (projectNumber === undefined) {
    logger.error("Failed to get project number from creation response");
    return 1;
  }
  logger.success(`  Project created: #${projectNumber} ${projectUrl ?? ""}`);

  // ステップ 2: リポジトリにリンク (GraphQL mutation: linkProjectV2ToRepository)
  logger.info(`[2/4] Linking project to ${owner}/${repo}...`);

  const repoId = await getRepoId(owner, repo);
  const createdProjectId = createdProject?.id;
  if (!repoId || !createdProjectId) {
    logger.error(`Failed to link project to repository`);
    logger.info(`  Project was created successfully (URL: ${projectUrl ?? "unknown"})`);
    logger.info(`  Link manually: gh project link ${projectNumber} --owner ${owner} --repo ${owner}/${repo}`);
    return 1;
  }

  const GRAPHQL_MUTATION_LINK_PROJECT = `
    mutation($projectId: ID!, $repositoryId: ID!) {
      linkProjectV2ToRepository(input: {projectId: $projectId, repositoryId: $repositoryId}) {
        repository { id }
      }
    }
  `;

  const linkResult = await runGraphQL(GRAPHQL_MUTATION_LINK_PROJECT, {
    projectId: createdProjectId,
    repositoryId: repoId,
  });

  if (!linkResult.success) {
    logger.error(`Failed to link project to repository`);
    logger.info(`  Project was created successfully (URL: ${projectUrl ?? "unknown"})`);
    logger.info(`  Link manually: gh project link ${projectNumber} --owner ${owner} --repo ${owner}/${repo}`);
    return 1;
  }

  logger.success("  Project linked to repository");

  // ステップ 3: Discussions 有効化 (octokit REST API)
  logger.info(`[3/4] Enabling Discussions for ${owner}/${repo}...`);
  try {
    const octokit = getOctokit();
    await octokit.rest.repos.update({
      owner,
      repo,
      has_discussions: true,
    });
    logger.success("  Discussions enabled");
  } catch {
    logger.warn("  Failed to enable Discussions automatically");
    logger.info(`  Enable manually: gh api -X PATCH /repos/${owner}/${repo} -f has_discussions=true`);
  }

  // ステップ 4: フィールド設定（cmdSetup を呼び出し）
  logger.info("[4/4] Setting up project fields...");

  // 新しく作成した Project の ID を取得して setup に渡す
  const projectId = await getProjectId(owner, options.title);
  if (!projectId) {
    logger.error("Failed to resolve project ID after creation");
    logger.info("  Run 'shirokuma-flow projects setup' manually to set up fields");
    return 1;
  }

  const setupResult = await cmdSetup(
    { ...options, projectId, owner, force: true },
    logger,
  );

  // 出力
  const output = {
    project_number: projectNumber,
    project_url: projectUrl,
    project_id: projectId,
    owner,
    repository: `${owner}/${repo}`,
    setup: setupResult === 0 ? "completed" : "failed",
    next_steps: [
      `Add Issue Types: https://github.com/organizations/${owner}/settings/issue-types`,
      "  - Chore, Docs, Research (in addition to Feature / Bug / Task)",
      "Enable recommended workflows: Project → Workflows",
      "  - Item closed → Done",
      "  - Pull request merged → Done",
      `Create Discussion categories: https://github.com/${owner}/${repo}/discussions/categories`,
      "  - ADR (📐, Open-ended discussion)",
      "  - Knowledge (💡, Open-ended discussion)",
      "  - Research (🔬, Open-ended discussion)",
      "Rename default View \"View 1\" in GitHub UI (API not supported):",
      "  - TABLE → \"Board\", BOARD → \"Kanban\", ROADMAP → \"Roadmap\"",
    ],
  };

  console.log(JSON.stringify(output, null, 2));
  return setupResult;
}
