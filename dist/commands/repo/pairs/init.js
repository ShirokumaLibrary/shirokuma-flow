/**
 * repo pairs init subcommand - Initialize a new repo pair
 */
import chalk from "chalk";
import { readFileSync, writeFileSync } from "node:fs";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { parseRepoFullName, DEFAULT_EXCLUDE_PATTERNS, } from "../../../utils/repo-pairs.js";
import { getRepoInfo } from "../../../utils/github.js";
import { getOctokit } from "../../../utils/octokit-client.js";
import { findConfigFile } from "./helpers.js";
// =============================================================================
// Handler
// =============================================================================
export async function cmdInit(alias, options, logger) {
    if (!alias) {
        logger.error("Alias is required. Usage: repo-pairs init <alias>");
        return 1;
    }
    // Determine private/public repos
    let privateRepo = options.private;
    let publicRepo = options.public;
    // If not specified, derive from current repo
    if (!privateRepo) {
        const repoInfo = getRepoInfo();
        if (repoInfo) {
            privateRepo = `${repoInfo.owner}/${repoInfo.name}`;
        }
    }
    if (!publicRepo && privateRepo) {
        publicRepo = `${privateRepo}-public`;
    }
    if (!privateRepo || !publicRepo) {
        logger.error("Could not determine repositories. Use --private and --public flags.");
        return 1;
    }
    // Validate repos exist
    const octokit = getOctokit();
    const privateParsed = parseRepoFullName(privateRepo);
    if (!privateParsed) {
        logger.error(`Invalid repo format: ${privateRepo}`);
        return 1;
    }
    const publicParsed = parseRepoFullName(publicRepo);
    if (!publicParsed) {
        logger.error(`Invalid repo format: ${publicRepo}`);
        return 1;
    }
    logger.verbose(`Validating private repo: ${privateRepo}`);
    try {
        await octokit.rest.repos.get({
            owner: privateParsed.owner,
            repo: privateParsed.name,
        });
    }
    catch {
        logger.error(`Private repo not found: ${privateRepo}`);
        return 1;
    }
    logger.verbose(`Validating public repo: ${publicRepo}`);
    try {
        await octokit.rest.repos.get({
            owner: publicParsed.owner,
            repo: publicParsed.name,
        });
    }
    catch {
        logger.info(`Public repo not found: ${publicRepo}`);
        logger.info("Create it? Run:");
        logger.info(chalk.gray(`  gh repo create ${publicRepo} --public`));
        // Continue anyway - user can create it later
    }
    // Read existing config
    const configPath = findConfigFile();
    if (!configPath) {
        logger.error("No shirokuma-docs.config.yaml found. Run: shirokuma-docs init");
        return 1;
    }
    const content = readFileSync(configPath, "utf-8");
    const config = parseYaml(content) || {};
    // Add/update repoPairs section
    const repoPairs = config.repoPairs || {};
    repoPairs[alias] = {
        private: privateRepo,
        public: publicRepo,
        exclude: options.exclude ?? DEFAULT_EXCLUDE_PATTERNS,
        ...(options.sourceDir && { sourceDir: options.sourceDir }),
    };
    config.repoPairs = repoPairs;
    // Write back
    writeFileSync(configPath, stringifyYaml(config, { lineWidth: 120 }));
    logger.success(`Repo pair "${alias}" added to ${configPath}`);
    logger.info(`  Private: ${privateRepo}`);
    logger.info(`  Public:  ${publicRepo}`);
    if (options.sourceDir) {
        logger.info(`  Source:  ${options.sourceDir}`);
    }
    return 0;
}
//# sourceMappingURL=init.js.map