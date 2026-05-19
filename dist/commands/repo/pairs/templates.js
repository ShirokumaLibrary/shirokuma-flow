/**
 * repo pairs templates subcommand - Generate public repo Issue templates
 */
import chalk from "chalk";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getRepoPair } from "../../../utils/repo-pairs.js";
// =============================================================================
// Handler
// =============================================================================
export function cmdTemplates(alias, options, logger) {
    if (!alias) {
        logger.error("Alias is required. Usage: repo-pairs templates <alias>");
        return 1;
    }
    const pair = getRepoPair(alias);
    if (!pair) {
        logger.error(`Unknown alias: ${alias}. Run: repo-pairs list`);
        return 1;
    }
    const outputDir = options.dryRun
        ? null
        : join(process.cwd(), ".github", "ISSUE_TEMPLATE");
    if (outputDir && !existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
    }
    // Bug report template
    const bugReport = `name: Bug Report
description: Report a bug or unexpected behavior
title: "[Bug]: "
labels: ["bug"]
body:
  - type: markdown
    attributes:
      value: |
        Thank you for reporting a bug! Please fill in the details below.

  - type: textarea
    id: description
    attributes:
      label: Bug Description
      description: A clear description of what the bug is.
      placeholder: What happened?
    validations:
      required: true

  - type: textarea
    id: steps
    attributes:
      label: Steps to Reproduce
      description: Steps to reproduce the behavior.
      placeholder: |
        1. Go to '...'
        2. Click on '...'
        3. See error
    validations:
      required: true

  - type: textarea
    id: expected
    attributes:
      label: Expected Behavior
      description: What did you expect to happen?
    validations:
      required: true

  - type: textarea
    id: environment
    attributes:
      label: Environment
      description: Please provide your environment details.
      placeholder: |
        - OS: [e.g., macOS 14.0]
        - Node.js: [e.g., 20.10.0]
        - Version: [e.g., 1.0.0]
    validations:
      required: false

  - type: textarea
    id: additional
    attributes:
      label: Additional Context
      description: Any other context about the problem.
    validations:
      required: false
`;
    // Feature request template
    const featureRequest = `name: Feature Request
description: Suggest a new feature or improvement
title: "[Feature]: "
labels: ["enhancement"]
body:
  - type: markdown
    attributes:
      value: |
        Thank you for suggesting a feature! Please describe your idea below.

  - type: textarea
    id: problem
    attributes:
      label: Problem Description
      description: Is your feature request related to a problem?
      placeholder: I'm always frustrated when...
    validations:
      required: false

  - type: textarea
    id: solution
    attributes:
      label: Proposed Solution
      description: Describe the solution you'd like.
      placeholder: I would like...
    validations:
      required: true

  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives Considered
      description: Have you considered any alternative solutions?
    validations:
      required: false

  - type: textarea
    id: additional
    attributes:
      label: Additional Context
      description: Any other context or screenshots about the feature request.
    validations:
      required: false
`;
    // Template chooser config
    const configYml = `blank_issues_enabled: false
contact_links:
  - name: Documentation
    url: https://github.com/${pair.public}
    about: Check the documentation before opening an issue
`;
    if (options.dryRun) {
        logger.info(chalk.yellow("[DRY RUN] Would generate:"));
        logger.info("  .github/ISSUE_TEMPLATE/bug_report.yml");
        logger.info("  .github/ISSUE_TEMPLATE/feature_request.yml");
        logger.info("  .github/ISSUE_TEMPLATE/config.yml");
        return 0;
    }
    if (outputDir) {
        writeFileSync(join(outputDir, "bug_report.yml"), bugReport);
        writeFileSync(join(outputDir, "feature_request.yml"), featureRequest);
        writeFileSync(join(outputDir, "config.yml"), configYml);
    }
    logger.success("Generated Issue templates:");
    logger.info("  .github/ISSUE_TEMPLATE/bug_report.yml");
    logger.info("  .github/ISSUE_TEMPLATE/feature_request.yml");
    logger.info("  .github/ISSUE_TEMPLATE/config.yml");
    logger.info("");
    logger.info("Copy these to your public repo, or use:");
    logger.info(chalk.gray(`  repo-pairs release ${alias} --tag <version>`));
    return 0;
}
//# sourceMappingURL=templates.js.map