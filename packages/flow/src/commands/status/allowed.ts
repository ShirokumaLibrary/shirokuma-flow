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
import { getAllowedTransitions } from "../../utils/status-workflow.js";
import { resolveCurrentStatus } from "./shared/resolve-status.js";
import type { Logger } from "../../utils/logger.js";
import type { ItemsOptions } from "../items/types.js";

export interface StatusAllowedOptions extends ItemsOptions {
  /** 現在のステータスを直接指定（静的照会）。指定時は Issue 番号照会をスキップ */
  status?: string;
}

export interface StatusAllowedResult {
  current_status: string | null;
  allowed_transitions: string[];
  /** 照会が静的（--status フラグ経由）かどうか */
  static?: boolean;
}

export async function cmdStatusAllowed(
  numberStr: string | undefined,
  options: StatusAllowedOptions,
  logger: Logger,
): Promise<number> {
  if (options.status) {
    const currentStatus = options.status;
    // 静的照会では itemType 不明のため、issue / pr 両方の forward を合算して返す。
    // rollback は型を跨いで誤誘導するリスクがあるので静的照会では出力しない（番号指定経路でのみ allowRollback: true を設定）
    const issueAllowed = getAllowedTransitions("issue", currentStatus);
    const prAllowed = getAllowedTransitions("pr", currentStatus);
    const combined = [...new Set([...issueAllowed.forward, ...prAllowed.forward])];

    const result: StatusAllowedResult = {
      current_status: currentStatus,
      allowed_transitions: combined,
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

  const { status: currentStatus, isPr } = await resolveCurrentStatus(owner, repo, number, logger);
  const itemType: "issue" | "pr" = isPr ? "pr" : "issue";
  const allowedTransitions = currentStatus
    ? (() => {
        const { forward, rollback } = getAllowedTransitions(itemType, currentStatus, { allowRollback: true });
        return [...forward, ...rollback];
      })()
    : [];

  const result: StatusAllowedResult = {
    current_status: currentStatus,
    allowed_transitions: allowedTransitions,
  };

  console.log(JSON.stringify(result, null, 2));
  return 0;
}
