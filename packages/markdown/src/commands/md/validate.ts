import chalk from 'chalk';
import ora from 'ora';
import { loadConfig } from '../../utils/md/config.js';
import { Validator } from '../../validators/index.js';
import { Issue } from '../../parsers/types/validation.js';
import { EXIT_ERROR } from '../../utils/md/constants.js';
import * as path from 'path';

interface ValidateOptions {
  config?: string;
  severity?: 'error' | 'warning' | 'info';
  verbose?: boolean;
}

export async function validateCommand(options: ValidateOptions): Promise<number> {
  const spinner = ora('Loading configuration...').start();

  try {
    // Load configuration
    const config = await loadConfig(options.config);
    spinner.succeed('Configuration loaded');

    // Create validator
    const validator = new Validator(config);
    const sourceDir = path.resolve(config.directories.source);

    spinner.start('Validating documents...');

    const result = await validator.validate(sourceDir);

    if (result.valid) {
      spinner.succeed('Validation passed!');
    } else {
      spinner.fail(`Validation failed with ${result.errors.length} error(s)`);
    }

    // Display results
    console.log();
    console.log(chalk.bold('Validation Results:'));
    console.log(chalk.gray('─'.repeat(50)));

    const minSeverity = options.severity || 'info';
    const severityLevels = { error: 3, warning: 2, info: 1 };

    // Show errors
    if (severityLevels[minSeverity] <= severityLevels.error && result.errors.length > 0) {
      console.log();
      console.log(chalk.red.bold(`Errors (${result.errors.length}):`));
      result.errors.forEach(issue => {
        console.log(formatIssue(issue, options.verbose));
      });
    }

    // Show warnings
    if (severityLevels[minSeverity] <= severityLevels.warning && result.warnings.length > 0) {
      console.log();
      console.log(chalk.yellow.bold(`Warnings (${result.warnings.length}):`));
      result.warnings.forEach(issue => {
        console.log(formatIssue(issue, options.verbose));
      });
    }

    // Show info
    if (severityLevels[minSeverity] <= severityLevels.info && result.info.length > 0) {
      console.log();
      console.log(chalk.blue.bold(`Info (${result.info.length}):`));
      result.info.forEach(issue => {
        console.log(formatIssue(issue, options.verbose));
      });
    }

    console.log();
    console.log(chalk.gray('─'.repeat(50)));

    // Exit with error code if validation failed
    if (!result.valid) {
      return EXIT_ERROR;
    }
    return 0;
  } catch (error: unknown) {
    spinner.fail('Validation failed');
    const err = error instanceof Error ? error : new Error(String(error));
    console.error();
    console.error(chalk.red('Error:'), err.message);

    if (options.verbose && err.stack) {
      console.error();
      console.error(chalk.gray(err.stack));
    }

    return EXIT_ERROR;
  }
}

function formatIssue(issue: Issue, verbose?: boolean): string {
  const location = issue.line
    ? `${issue.file}:${issue.line}${issue.column ? `:${issue.column}` : ''}`
    : issue.file;

  const severityColor =
    issue.severity === 'error' ? chalk.red : issue.severity === 'warning' ? chalk.yellow : chalk.blue;

  if (verbose) {
    return `  ${severityColor('•')} [${issue.rule}] ${location}\n    ${issue.message}`;
  }

  return `  ${severityColor('•')} ${location}: ${issue.message}`;
}
