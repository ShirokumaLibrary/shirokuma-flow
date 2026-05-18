/**
 * projects fields subcommand
 *
 * Show available field options.
 */

import { Logger } from "../../utils/logger.js";
import { getProjectFields } from "../../utils/project-fields.js";
import {
  ProjectsOptions,
  getOwner,
  getProjectId,
} from "./helpers.js";

/**
 * fields subcommand
 */
export async function cmdFields(
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

  const fields = await getProjectFields(projectId);
  console.log(JSON.stringify(fields, null, 2));
  return 0;
}
