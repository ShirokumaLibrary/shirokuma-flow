/**
 * GitHub setup validation utility (#345, #527)
 *
 * Checks whether manual GitHub configuration steps have been completed:
 * - Discussion categories (Handovers, ADR, Knowledge, Research) with recommended settings
 * - Project existence and required fields (Status, Priority, Size)
 * - Project workflow automations (Item closed → Done, PR merged → Done)
 * - Metrics text fields (if metrics enabled)
 */
import type { Logger } from "./logger.js";
/** Discussion カテゴリの推奨設定 */
export interface RecommendedCategorySetting {
    description: string;
    emoji: string;
    format: "Open-ended discussion" | "Question / Answer";
}
export interface SetupCheckItem {
    category: "discussions" | "workflows" | "metrics" | "project";
    name: string;
    ok: boolean;
    hint?: string;
    url?: string;
    /** Discussion カテゴリの推奨設定（discussions カテゴリのみ） */
    recommended?: RecommendedCategorySetting;
}
export interface SetupCheckResult {
    repository: string;
    items: SetupCheckItem[];
    summary: {
        total: number;
        ok: number;
        missing: number;
    };
}
/**
 * 各 Discussion カテゴリの推奨設定
 * GitHub UI でカテゴリを作成する際に使用する値
 */
export declare const RECOMMENDED_CATEGORY_SETTINGS: Record<string, RecommendedCategorySetting>;
/**
 * Validate GitHub setup and return results
 */
export declare function validateGitHubSetup(logger: Logger): Promise<SetupCheckResult | null>;
/**
 * Print setup check results to logger (human-friendly format)
 */
export declare function printSetupCheckResults(result: SetupCheckResult, logger: Logger): void;
//# sourceMappingURL=setup-check.d.ts.map