/**
 * repo status subcommand - Check npm / GitHub service status
 */

import type { Logger } from "../../utils/logger.js";
import {
  checkServiceStatus,
  formatIncidentReport,
  type ServiceName,
} from "../../utils/service-status.js";

// =============================================================================
// Types
// =============================================================================

export interface RepoStatusOptions {
  verbose?: boolean;
}

// =============================================================================
// Handler
// =============================================================================

export async function cmdStatus(
  _options: RepoStatusOptions,
  logger: Logger,
): Promise<number> {
  const services: ServiceName[] = ["npm", "github"];
  let hasIncident = false;

  for (const service of services) {
    const status = await checkServiceStatus(service);
    if (status.ok) {
      logger.info(`${service}: OK`);
    } else {
      hasIncident = true;
      const lines = formatIncidentReport(service, status);
      for (const line of lines) {
        logger.error(line);
      }
    }
  }

  return hasIncident ? 1 : 0;
}
