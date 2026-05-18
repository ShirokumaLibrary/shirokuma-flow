/**
 * projects workflows subcommand
 *
 * Display built-in automation workflow status.
 */

import { Logger } from "../../utils/logger.js";
import {
  ProjectsOptions,
  getOwner,
  getProjectId,
  RECOMMENDED_WORKFLOWS,
} from "./helpers.js";
import { fetchWorkflowsWithProject } from "../../utils/project-utils.js";

/**
 * workflows subcommand - ビルトイン自動化の状態を表示
 */
export async function cmdWorkflows(
  options: ProjectsOptions,
  logger: Logger
): Promise<number> {
  const owner = options.owner || getOwner();
  if (!owner) {
    logger.error("Could not determine repository owner");
    return 1;
  }

  const projectId = await getProjectId(owner);
  if (!projectId) {
    logger.error(`No project found for owner '${owner}'`);
    return 1;
  }

  const detail = await fetchWorkflowsWithProject(projectId);
  if (!detail || detail.workflows.length === 0) {
    logger.warn("No workflows found or failed to fetch");
    return 1;
  }

  const { workflows, url: projectUrl, number: projectNumber } = detail;
  // GitHub Projects V2 では `{project.url}/workflows` が workflows 設定画面の deep-link
  // url 不在（古い API 応答や mock）の場合は owner/projects 一覧画面にフォールバック
  const workflowsSettingsUrl = projectUrl
    ? `${projectUrl}/workflows`
    : `https://github.com/orgs/${owner}/projects (Settings > Workflows)`;

  // 推奨ワークフローの有効/無効をチェック
  const disabledRecommended = workflows.filter(
    (w) => RECOMMENDED_WORKFLOWS.includes(w.name) && !w.enabled
  );

  const output = {
    project_id: projectId,
    project_number: projectNumber,
    project_url: projectUrl,
    workflows_settings_url: workflowsSettingsUrl,
    workflows: workflows.map((w) => ({
      name: w.name,
      number: w.number,
      enabled: w.enabled,
      recommended: RECOMMENDED_WORKFLOWS.includes(w.name),
    })),
    recommendations: disabledRecommended.length > 0
      ? {
          message: "以下の推奨ワークフローが無効です。GitHub UI から有効化してください（GraphQL API では有効化できないため手動操作が必須）。",
          disabled: disabledRecommended.map((w) => w.name),
          settings_url: workflowsSettingsUrl,
          api_status: "GitHub Projects V2 GraphQL に updateProjectV2Workflow mutation は存在しません（2026 年時点）。setting-up-project スキル (#2325) を参照。",
        }
      : null,
  };

  console.log(JSON.stringify(output, null, 2));

  if (disabledRecommended.length > 0) {
    logger.warn(
      `${disabledRecommended.length} recommended workflow(s) disabled: ${disabledRecommended.map((w) => w.name).join(", ")}`
    );
    logger.info(`Enable here: ${workflowsSettingsUrl}`);
    logger.info("Note: GitHub does not provide an API to toggle workflows; manual UI step is required.");
  }

  return 0;
}
