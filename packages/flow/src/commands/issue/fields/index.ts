/**
 * items fields サブコマンド (#1814)
 *
 * issues fields から移行。プロジェクトフィールド定義を表示する。
 */

import { resolveTargetRepo } from "../../../utils/repo-pairs.js";
import {
  getProjectFields,
} from "../../../utils/project-fields.js";
import { getProjectId } from "../../../utils/project-utils.js";
import type { Logger } from "../../../utils/logger.js";
import type { FieldsOptions } from "../../items/types.js";

// =============================================================================
// Command
// =============================================================================

/**
 * items fields サブコマンド - プロジェクトフィールド定義を表示する。
 */
export async function cmdFields(
  options: FieldsOptions,
  logger: Logger
): Promise<number> {
  const repoInfo = resolveTargetRepo(options);
  if (!repoInfo) {
    logger.error("Could not determine repository");
    return 1;
  }

  const { owner, name: repoName } = repoInfo;

  const projectId = await getProjectId(owner, repoName);
  if (!projectId) {
    logger.error(`No project found for owner '${owner}'`);
    return 1;
  }

  const fields = await getProjectFields(projectId);
  console.log(JSON.stringify(fields, null, 2));
  return 0;
}
