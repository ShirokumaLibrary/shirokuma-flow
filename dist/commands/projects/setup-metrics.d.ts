/**
 * projects setup-metrics subcommand
 *
 * Create Text fields for metrics tracking (idempotent).
 */
import { Logger } from "../../utils/logger.js";
import { ProjectsOptions } from "./helpers.js";
/**
 * Create Text fields for metrics tracking (idempotent).
 * Reads field names from metrics config, creates missing ones.
 */
export declare function cmdSetupMetrics(options: ProjectsOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=setup-metrics.d.ts.map