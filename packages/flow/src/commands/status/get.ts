/**
 * status get サブコマンド
 *
 * 指定した Issue / PR の現在ステータスと遷移可能なステータス一覧を JSON で返す。
 */

import { parseIssueNumber, isIssueNumber } from "../../utils/github.js";
import { resolveTargetRepo } from "../../utils/repo-pairs.js";
import { getAllowedTransitions } from "../../utils/status-workflow.js";
import { resolveCurrentStatus } from "./shared/resolve-status.js";
import type { Logger } from "../../utils/logger.js";
import type { ItemsOptions } from "../items/types.js";

export interface StatusGetResult {
  number: number;
  status: string | null;
  allowed_transitions: string[];
}

export async function cmdStatusGet(
  numberStr: string,
  options: ItemsOptions,
  logger: Logger,
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
  const number = parseIssueNumber(numberStr);

  const { status: currentStatus, isPr } = await resolveCurrentStatus(owner, repo, number, logger);
  const itemType: "issue" | "pr" = isPr ? "pr" : "issue";
  const allowedTransitions = currentStatus
    ? (() => {
        const { forward, rollback } = getAllowedTransitions(itemType, currentStatus, { allowRollback: true });
        return [...forward, ...rollback];
      })()
    : [];

  const result: StatusGetResult = {
    number,
    status: currentStatus,
    allowed_transitions: allowedTransitions,
  };

  console.log(JSON.stringify(result, null, 2));
  return 0;
}
