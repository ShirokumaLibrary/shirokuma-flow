/**
 * init command - Initialize configuration file
 *
 * @description Initializes shirokuma-docs configuration for a project and
 * optionally installs the bundled shirokuma-skills-en plugin.
 *
 * @example
 * ```bash
 * # Create config file only
 * shirokuma-docs init
 *
 * # Install plugin (skills + rules)
 * shirokuma-docs init --with-skills
 *
 * # Install specific skills only
 * shirokuma-docs init --with-skills=review-issue,implement-flow
 * ```
 */
/**
 * init command options
 */
interface InitOptions {
    /** Project path */
    project: string;
    /** Overwrite existing files */
    force?: boolean;
    /** Install skills (true=all, string=comma-separated) */
    withSkills?: boolean | string;
    /** Install rules */
    withRules?: boolean;
    /** Verbose logging */
    verbose?: boolean;
    /** Language setting (en|ja) */
    lang?: string;
    /** Plugin release channel (overrides config) */
    channel?: "stable" | "rc" | "beta" | "alpha";
    /** Manage .gitignore (default: true, set false by --no-gitignore) */
    gitignore?: boolean;
    /** Scaffold Next.js monorepo structure */
    nextjs?: boolean;
    /** Install shirokuma-nextjs optional plugin */
    withNextjs?: boolean;
}
/**
 * init command error
 */
declare class InitError extends Error {
    readonly cause?: unknown | undefined;
    constructor(message: string, cause?: unknown | undefined);
}
/** Next.js monorepo scaffold result */
export interface ScaffoldResult {
    directories_created: string[];
    files_created: string[];
    git_initialized: boolean;
}
/**
 * Scaffold Next.js monorepo directory structure and base files.
 * Skips existing directories and files to avoid overwriting user data.
 */
export declare function scaffoldNextjsMonorepo(projectPath: string): Promise<ScaffoldResult>;
/**
 * init command handler
 *
 * @param options - Command options
 * @throws {InitError} On fatal error
 */
export declare function initCommand(options: InitOptions): Promise<void>;
export { InitError };
//# sourceMappingURL=init.d.ts.map