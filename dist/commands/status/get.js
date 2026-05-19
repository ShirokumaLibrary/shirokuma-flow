/**
 * status get サブコマンド
 *
 * 指定した Issue / PR の現在ステータスと遷移可能なステータス一覧を JSON で返す。
 */
import { parseIssueNumber, isIssueNumber } from "../../utils/github.js";
import { resolveTargetRepo } from "../../utils/repo-pairs.js";
import { STATUS_TRANSITIONS } from "../../utils/status-workflow.js";
import { resolveCurrentStatus } from "./shared/resolve-status.js";
export async function cmdStatusGet(numberStr, options, logger) {
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
    const number = parseIssueNumber(numberStr);
    const { status: currentStatus } = await resolveCurrentStatus(owner, repo, number, logger);
    const allowedTransitions = currentStatus
        ? [...(STATUS_TRANSITIONS[currentStatus] ?? [])]
        : [];
    const result = {
        number,
        status: currentStatus,
        allowed_transitions: allowedTransitions,
    };
    console.log(JSON.stringify(result, null, 2));
    return 0;
}
//# sourceMappingURL=get.js.map