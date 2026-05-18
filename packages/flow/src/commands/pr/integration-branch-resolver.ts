/**
 * Integration ブランチ解決ヘルパー
 *
 * PR 作成時のベースブランチ判定ロジックを共通化する。
 *
 * ベースブランチ判定マトリクス:
 * - Case 1: integration 検出済み + optionsBase 未指定 → integration を自動採用
 * - Case 2: integration 検出済み + optionsBase 明示   → 警告 + optionsBase を使用
 * - Case 3: integration 未検出  + optionsBase 未指定 + サブ Issue → エラーで停止
 * - その他: optionsBase ?? "develop"
 */

import type { Logger } from "../../utils/logger.js";
import { findIntegrationBranch } from "../issue/branch/index.js";

export interface ResolveIntegrationBaseBranchInput {
  parentNumber: number | null;
  parentBody: string | null;
  optionsBase: string | undefined;
  logger: Logger;
}

export interface ResolveIntegrationBaseBranchResult {
  baseBranch: string;
  isIntegrationTarget: boolean;
}

/**
 * PR 作成時のベースブランチを解決する。エラー（Case 3）時は null を返すため、
 * 呼び出し元はチェックして early return すること。
 */
export async function resolveIntegrationBaseBranch(
  input: ResolveIntegrationBaseBranchInput,
): Promise<ResolveIntegrationBaseBranchResult | null> {
  const { parentNumber, parentBody, optionsBase, logger } = input;

  // サブ Issue でない場合（または parentNumber が null）→ シンプルなデフォルト処理
  if (!parentNumber) {
    return {
      baseBranch: optionsBase ?? "develop",
      isIntegrationTarget: false,
    };
  }

  const integrationBranch = await findIntegrationBranch(
    parentNumber,
    parentBody ?? undefined,
  );

  if (!integrationBranch) {
    if (!optionsBase) {
      logger.error(
        `Integration ブランチが見つかりません。--base で明示的に指定してください（例: --base develop）`,
      );
      return null;
    }
    logger.warn(
      `Integration ブランチが見つかりませんでした。--base の指定（${optionsBase}）を使用します`,
    );
    return {
      baseBranch: optionsBase,
      isIntegrationTarget: false,
    };
  }

  if (optionsBase) {
    logger.warn(
      `Integration ブランチ \`${integrationBranch}\` が存在しますが --base の指定を優先します（${optionsBase}）`,
    );
    return {
      baseBranch: optionsBase,
      isIntegrationTarget: false,
    };
  }

  return {
    baseBranch: integrationBranch,
    isIntegrationTarget: true,
  };
}
