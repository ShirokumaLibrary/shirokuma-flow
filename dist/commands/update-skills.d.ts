/**
 * update-skills command - Update installed skills/rules from bundled plugin
 *
 * @description Updates installed skills and rules to the version bundled
 * in the shirokuma-docs package, preserving project/ directories.
 *
 * @example
 * ```bash
 * # Update all installed skills
 * shirokuma-docs update-skills
 *
 * # Update specific skills only
 * shirokuma-docs update-skills --skills managing-agents,review-issue
 *
 * # Update with rules
 * shirokuma-docs update-skills --with-rules
 *
 * # Preview changes without updating
 * shirokuma-docs update-skills --dry-run
 *
 * # Force update (ignore local changes)
 * shirokuma-docs update-skills --force
 *
 * # Sync mode: detect new/removed skills
 * shirokuma-docs update-skills --sync
 * ```
 */
/**
 * update-skills command options
 */
interface UpdateSkillsOptions {
    /** Project path */
    project: string;
    /** Update rules as well */
    withRules?: boolean;
    /** Sync mode: detect and add new skills, detect removed skills */
    sync?: boolean;
    /** Auto-confirm destructive operations (removals) */
    yes?: boolean;
    /** Preview mode (no actual changes) */
    dryRun?: boolean;
    /** Force update (ignore local changes) */
    force?: boolean;
    /** Force global cache sync (claude plugin uninstall + install) */
    installCache?: boolean;
    /** Plugin release channel (overrides config) */
    channel?: "stable" | "rc" | "beta" | "alpha";
    /** Verbose logging */
    verbose?: boolean;
}
/**
 * update-skills command handler
 */
export declare function updateSkillsCommand(options: UpdateSkillsOptions): Promise<number>;
export {};
//# sourceMappingURL=update-skills.d.ts.map