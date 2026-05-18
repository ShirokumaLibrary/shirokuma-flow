/**
 * repo pairs status subcommand - Show sync status between repo pairs
 */

import chalk from "chalk";
import {
  getAllRepoPairs,
  getRepoPair,
  parseRepoFullName,
} from "../../../utils/repo-pairs.js";
import { loadGhConfig } from "../../../utils/gh-config.js";
import { getOctokit } from "../../../utils/octokit-client.js";
import type { RepoPairsOptions, PairsLogger } from "./helpers.js";

// =============================================================================
// Handler
// =============================================================================

export async function cmdStatus(
  alias: string | undefined,
  options: RepoPairsOptions,
  logger: PairsLogger
): Promise<number> {
  const config = loadGhConfig();

  if (alias) {
    const pair = getRepoPair(alias, config);
    if (!pair) {
      logger.error(`Unknown alias: ${alias}`);
      return 1;
    }
    return await showPairStatus(pair, logger);
  }

  // Show all pairs
  const pairs = getAllRepoPairs(config);
  if (pairs.length === 0) {
    logger.info("No repo pairs configured.");
    return 0;
  }

  for (const pair of pairs) {
    await showPairStatus(pair, logger);
    logger.info("");
  }

  return 0;
}

// =============================================================================
// Internal Helpers
// =============================================================================

async function showPairStatus(
  pair: { alias: string; private: string; public: string },
  logger: PairsLogger
): Promise<number> {
  logger.info(chalk.bold(`Status: ${pair.alias}`));
  logger.info(chalk.gray("\u2500".repeat(40)));

  // Get latest tags from both repos
  const privateTag = await getLatestTag(pair.private);
  const publicTag = await getLatestTag(pair.public);

  logger.info(`  Private: ${pair.private}`);
  logger.info(`    Latest tag: ${privateTag || "(none)"}`);
  logger.info(`  Public:  ${pair.public}`);
  logger.info(`    Latest tag: ${publicTag || "(none)"}`);

  if (privateTag && publicTag) {
    if (privateTag === publicTag) {
      logger.success("  Tags are in sync");
    } else {
      logger.info(chalk.yellow(`  \u26A0 Tags differ: private=${privateTag} public=${publicTag}`));
    }
  }

  return 0;
}

async function getLatestTag(repo: string): Promise<string | null> {
  const parsed = parseRepoFullName(repo);
  if (!parsed) return null;

  try {
    const octokit = getOctokit();
    const { data } = await octokit.rest.repos.listTags({
      owner: parsed.owner,
      repo: parsed.name,
      per_page: 1,
    });
    return data.length > 0 ? data[0].name : null;
  } catch {
    return null;
  }
}
