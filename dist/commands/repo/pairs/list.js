/**
 * repo pairs list subcommand - Show all configured repo pairs
 */
import chalk from "chalk";
import { getAllRepoPairs } from "../../../utils/repo-pairs.js";
// =============================================================================
// Handler
// =============================================================================
export function cmdList(logger) {
    const pairs = getAllRepoPairs();
    if (pairs.length === 0) {
        logger.info("No repo pairs configured.");
        logger.info("");
        logger.info("Add to shirokuma-docs.config.yaml:");
        logger.info(chalk.gray("  repoPairs:"));
        logger.info(chalk.gray("    myproject:"));
        logger.info(chalk.gray('      private: "owner/repo"'));
        logger.info(chalk.gray('      public: "owner/repo-public"'));
        return 0;
    }
    logger.info(chalk.bold("Configured Repo Pairs"));
    logger.info(chalk.gray("\u2500".repeat(60)));
    for (const pair of pairs) {
        logger.info("");
        logger.info(chalk.cyan(`  ${pair.alias}`));
        logger.info(`    Private: ${pair.private}`);
        logger.info(`    Public:  ${pair.public}`);
        logger.info(`    Branch:  ${pair.defaultBranch}`);
        if (pair.sourceDir) {
            logger.info(`    Source:  ${pair.sourceDir}`);
        }
        if (pair.exclude.length > 0) {
            logger.info(`    Exclude: ${pair.exclude.join(", ")}`);
        }
    }
    logger.info("");
    return 0;
}
//# sourceMappingURL=list.js.map