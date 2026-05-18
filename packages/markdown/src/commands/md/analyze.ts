import chalk from 'chalk';
import ora from 'ora';
import { loadConfig } from '../../utils/md/config.js';
import { Analyzer } from '../../analyzers/index.js';
import { EXIT_ERROR } from '../../utils/md/constants.js';
import * as path from 'path';
import * as fs from 'fs/promises';

interface AnalyzeOptions {
  config?: string;
  graph?: boolean;
  output?: string;
  verbose?: boolean;
  metrics?: boolean;
  suggest?: boolean;
}

export async function analyzeCommand(options: AnalyzeOptions): Promise<number> {
  const spinner = ora('Loading configuration...').start();

  try {
    // Load configuration
    const config = await loadConfig(options.config);
    spinner.succeed('Configuration loaded');

    // Create analyzer
    const analyzer = new Analyzer(config);
    const sourceDir = path.resolve(config.directories.source);

    spinner.start('Analyzing documents...');

    const result = await analyzer.analyze(sourceDir, {
      includeMetrics: options.metrics,
      includeSplitSuggestions: options.suggest,
    });

    spinner.succeed('Analysis completed!');

    // Display results
    console.log();
    console.log(chalk.bold('Analysis Results:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`${chalk.cyan('Total files:')} ${result.totalFiles}`);
    console.log(`${chalk.cyan('Dependencies:')} ${result.dependencies.length}`);
    console.log(`${chalk.cyan('Orphaned files:')} ${result.orphans.length}`);
    console.log(`${chalk.cyan('Circular dependencies:')} ${result.cycles.length}`);
    console.log(chalk.gray('─'.repeat(50)));

    // Show most referenced files
    if (result.mostReferenced.length > 0) {
      console.log();
      console.log(chalk.bold('Most Referenced Files:'));
      result.mostReferenced.slice(0, 5).forEach((item, index) => {
        console.log(`  ${chalk.gray(`${index + 1}.`)} ${item.file} ${chalk.gray(`(${item.count} refs)`)}`);
      });
    }

    // Show orphaned files
    if (result.orphans.length > 0) {
      console.log();
      console.log(chalk.yellow.bold('Orphaned Files:'));
      result.orphans.forEach(file => {
        console.log(`  ${chalk.yellow('•')} ${file}`);
      });
    }

    // Show cycles
    if (result.cycles.length > 0) {
      console.log();
      console.log(chalk.red.bold('Circular Dependencies:'));
      result.cycles.forEach((cycle, index) => {
        console.log(`  ${chalk.red(`${index + 1}.`)} ${cycle.join(' → ')}`);
      });
    }

    // Show file metrics
    if (result.fileMetrics && result.fileMetrics.length > 0) {
      console.log();
      console.log(chalk.bold('File Metrics:'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(`${chalk.cyan('Total tokens:')} ${result.totalTokens?.toLocaleString()}`);
      console.log(`${chalk.cyan('Average tokens per file:')} ${Math.round(result.averageTokensPerFile || 0)}`);
      console.log(chalk.gray('─'.repeat(50)));

      // Show top 10 largest files by tokens
      const sortedByTokens = [...result.fileMetrics]
        .sort((a, b) => b.tokens - a.tokens)
        .slice(0, 10);

      console.log();
      console.log(chalk.bold('Largest Files (by tokens):'));
      sortedByTokens.forEach((metric, index) => {
        console.log(
          `  ${chalk.gray(`${index + 1}.`)} ${metric.file} ${chalk.gray(`(${metric.tokens} tokens, ${metric.lines} lines)`)}`
        );
      });
    }

    // Show split suggestions
    if (result.splitSuggestions && result.splitSuggestions.length > 0) {
      console.log();
      console.log(chalk.yellow.bold('Split Suggestions:'));
      console.log(chalk.gray('─'.repeat(50)));

      for (const suggestion of result.splitSuggestions) {
        console.log();
        console.log(chalk.yellow('●'), chalk.bold(suggestion.file));
        console.log(`  ${chalk.gray('Reason:')} ${suggestion.reason}`);
        console.log(`  ${chalk.gray('Current size:')} ${suggestion.currentSize} lines, ${suggestion.currentTokens} tokens`);

        if (suggestion.suggestedSplits.length > 0) {
          console.log(`  ${chalk.gray('Suggested splits:')}`);
          suggestion.suggestedSplits.forEach((split, idx) => {
            console.log(
              `    ${chalk.cyan(`${idx + 1}.`)} ${split.heading} ${chalk.gray(`(lines ${split.startLine}-${split.endLine}, ~${split.estimatedTokens} tokens)`)}`
            );
          });
        }
      }
    }

    // Generate and output graph
    if (options.graph) {
      const graph = analyzer.generateGraph(result);

      if (options.output) {
        await fs.writeFile(options.output, graph, 'utf-8');
        console.log();
        console.log(chalk.green(`Graph saved to: ${options.output}`));
      } else {
        console.log();
        console.log(chalk.bold('Dependency Graph:'));
        console.log(graph);
      }
    }
    return 0;
  } catch (error: unknown) {
    spinner.fail('Analysis failed');
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
