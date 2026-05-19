/**
 * repo status subcommand - Check npm / GitHub service status
 */
import { checkServiceStatus, formatIncidentReport, } from "../../utils/service-status.js";
// =============================================================================
// Handler
// =============================================================================
export async function cmdStatus(_options, logger) {
    const services = ["npm", "github"];
    let hasIncident = false;
    for (const service of services) {
        const status = await checkServiceStatus(service);
        if (status.ok) {
            logger.info(`${service}: OK`);
        }
        else {
            hasIncident = true;
            const lines = formatIncidentReport(service, status);
            for (const line of lines) {
                logger.error(line);
            }
        }
    }
    return hasIncident ? 1 : 0;
}
//# sourceMappingURL=status.js.map