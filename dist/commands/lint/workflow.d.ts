/**
 * lint-workflow command - AI workflow validation
 *
 * Validates that AI workflow conventions are followed:
 * - Issue field completeness (Priority, Size)
 * - Branch naming convention ({type}/{number}-{slug})
 * - Protected branch protection (no direct commits on main/develop)
 * - Co-Authored-By signature detection
 *
 * Rules:
 * - issue-fields: Check open issues for missing project fields (P1)
 * - branch-naming: Validate current branch name convention (P1)
 * - main-protection: Detect direct commits on protected branches (P1)
 * - commit-format: Validate Conventional Commits format (P2)
 * - co-authored-by: Detect Co-Authored-By signatures in commits (P2)
 */
/**
 * Command options
 */
interface LintWorkflowOptions {
    project: string;
    config: string;
    format?: "terminal" | "json" | "summary";
    output?: string;
    strict?: boolean;
    verbose?: boolean;
    issues?: boolean;
    branches?: boolean;
    commits?: boolean;
}
/**
 * lint-workflow command handler
 */
export declare function lintWorkflowCommand(options: LintWorkflowOptions): Promise<number>;
export {};
//# sourceMappingURL=workflow.d.ts.map