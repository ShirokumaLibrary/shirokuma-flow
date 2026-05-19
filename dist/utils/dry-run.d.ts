/**
 * Dry-run output helper
 *
 * Provides consistent dry-run preview output across mutation commands.
 */
import type { Logger } from "./logger.js";
export interface DryRunPreview {
    command: string;
    operation: string;
    params: Record<string, unknown>;
}
/**
 * Output dry-run preview and return 0 (success).
 *
 * Prints a [DRY RUN] banner followed by the parameters that would be sent
 * as JSON, then returns 0 so the caller can `return dryRunPreview(...)`.
 */
export declare function dryRunPreview(preview: DryRunPreview, logger: Logger): number;
//# sourceMappingURL=dry-run.d.ts.map