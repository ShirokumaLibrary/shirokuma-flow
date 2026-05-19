/**
 * status allowed サブコマンド
 *
 * 指定したステータスから遷移可能なステータス一覧を返す。
 *
 * 使い方:
 *   status allowed 123                      # Issue #123 の現在ステータスから照会
 *   status allowed --status "In progress"   # ステータス名で静的照会
 */
import { parseIssueNumber, isIssueNumber } from "../../utils/github.js";
import { resolveTargetRepo } from "../../utils/repo-pairs.js";
import { STATUS_TRANSITIONS } from "../../utils/status-workflow.js";
import { resolveCurrentStatus } from "./shared/resolve-status.js";
export async function cmdStatusAllowed(numberStr, options, logger) {
    if (options.status) {
        const currentStatus = options.status;
        const allowedTransitions = [...(STATUS_TRANSITIONS[currentStatus] ?? [])];
        const result = {
            current_status: currentStatus,
            allowed_transitions: allowedTransitions,
            static: true,
        };
        console.log(JSON.stringify(result, null, 2));
        return 0;
    }
    if (!numberStr) {
        logger.error("Issue 番号または --status フラグを指定してください");
        return 1;
    }
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
        current_status: currentStatus,
        allowed_transitions: allowedTransitions,
    };
    console.log(JSON.stringify(result, null, 2));
    return 0;
}
//# sourceMappingURL=allowed.js.map