/**
 * projects workflows subcommand
 *
 * Display built-in automation workflow status.
 */
import { getOwner, getProjectId, fetchWorkflows, RECOMMENDED_WORKFLOWS, } from "./helpers.js";
/**
 * workflows subcommand - ビルトイン自動化の状態を表示
 */
export async function cmdWorkflows(options, logger) {
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
    const workflows = await fetchWorkflows(projectId);
    if (workflows.length === 0) {
        logger.warn("No workflows found or failed to fetch");
        return 1;
    }
    // 推奨ワークフローの有効/無効をチェック
    const disabledRecommended = workflows.filter((w) => RECOMMENDED_WORKFLOWS.includes(w.name) && !w.enabled);
    const output = {
        project_id: projectId,
        workflows: workflows.map((w) => ({
            name: w.name,
            number: w.number,
            enabled: w.enabled,
            recommended: RECOMMENDED_WORKFLOWS.includes(w.name),
        })),
        recommendations: disabledRecommended.length > 0
            ? {
                message: "以下の推奨ワークフローが無効です。GitHub UI から有効化してください。",
                disabled: disabledRecommended.map((w) => w.name),
                settings_url: `https://github.com/orgs/${owner}/projects (Settings > Workflows)`,
            }
            : null,
    };
    console.log(JSON.stringify(output, null, 2));
    if (disabledRecommended.length > 0) {
        logger.warn(`${disabledRecommended.length} recommended workflow(s) disabled: ${disabledRecommended.map((w) => w.name).join(", ")}`);
        logger.info("Enable via: GitHub Project Settings > Workflows (API not supported)");
    }
    return 0;
}
//# sourceMappingURL=workflows.js.map