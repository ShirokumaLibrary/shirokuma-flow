/**
 * Dry-run output helper
 *
 * Provides consistent dry-run preview output across mutation commands.
 */

import chalk from "chalk";
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
export function dryRunPreview(
  preview: DryRunPreview,
  logger: Logger,
): number {
  logger.info(chalk.yellow(`\n[DRY RUN] ${preview.command} ${preview.operation} — no changes will be made.`));

  // Filter out undefined/null values for cleaner output
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(preview.params)) {
    if (value !== undefined && value !== null) {
      cleaned[key] = value;
    }
  }

  console.log(JSON.stringify(cleaned, null, 2));
  return 0;
}
