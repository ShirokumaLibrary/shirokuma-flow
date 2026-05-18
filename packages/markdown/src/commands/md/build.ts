import chalk from 'chalk';
import ora from 'ora';
import { loadConfig } from '../../utils/md/config.js';
import { Builder } from '../../generators/builder.js';
import { EXIT_ERROR } from '../../utils/md/constants.js';
import * as path from 'path';

interface BuildOptions {
  config?: string;
  output?: string;
  include?: string;
  exclude?: string;
  verbose?: boolean;
  watch?: boolean;
}

export async function buildCommand(options: BuildOptions): Promise<number> {
  const spinner = ora('Loading configuration...').start();

  try {
    // Load configuration
    const config = await loadConfig(options.config);
    spinner.succeed('Configuration loaded');

    // Override config with CLI options
    if (options.include) {
      config.build.include.push(options.include);
    }
    if (options.exclude) {
      config.build.exclude.push(options.exclude);
    }

    // Create builder
    const builder = new Builder(config);
    const sourceDir = path.resolve(config.directories.source);

    if (options.watch) {
      // Watch mode
      spinner.start('Starting watch mode...');
      const outputPath = options.output || path.join(config.directories.output, config.build.default_output);
      await builder.watch(sourceDir, outputPath);
    } else {
      // Single build
      spinner.start('Building document...');

      const result = await builder.build(sourceDir, options.output);

      spinner.succeed('Build completed!');

      // Display results
      console.log();
      console.log(chalk.bold('Build Results:'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(`${chalk.cyan('Files processed:')} ${result.fileCount}`);
      console.log(`${chalk.cyan('Output size:')} ${formatBytes(result.totalSize)}`);
      console.log(`${chalk.cyan('Build time:')} ${result.buildTime}ms`);
      if (result.tokenCount) {
        console.log(`${chalk.cyan('Estimated tokens:')} ${result.tokenCount.toLocaleString()}`);
      }
      console.log(`${chalk.cyan('Output file:')} ${result.outputPath}`);
      console.log(chalk.gray('─'.repeat(50)));

      if (options.verbose && result.stats.files.length > 0) {
        console.log();
        console.log(chalk.bold('Processed files:'));
        result.stats.files.forEach(file => {
          console.log(`  ${chalk.gray('•')} ${file}`);
        });
      }
    }
    return 0;
  } catch (error) {
    spinner.fail('Build failed');
    console.error();
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red('Error:'), message);

    if (options.verbose && error instanceof Error && error.stack) {
      console.error();
      console.error(chalk.gray(error.stack));
    }

    return EXIT_ERROR;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
