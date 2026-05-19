import chalk from 'chalk';
import ora from 'ora';
import { loadConfig } from '../../utils/md/config.js';
import { Linter } from '../../lint/index.js';
import { TokenOptimizer } from '../../lint/token-optimizer.js';
import { EXIT_ERROR } from '../../utils/md/constants.js';
import * as path from 'path';
import * as fs from 'fs/promises';
import matter from '@11ty/gray-matter';
export async function lintCommand(options) {
    const spinner = ora('Loading configuration...').start();
    try {
        // Load configuration
        const config = await loadConfig(options.config);
        spinner.succeed('Configuration loaded');
        // Create linter
        const linter = new Linter(config);
        const sourceDir = path.resolve(config.directories.source);
        if (options.suggestFixes) {
            // Token optimization mode
            await runTokenOptimization(config, sourceDir, options, spinner);
        }
        else if (options.fix) {
            // Fix mode
            spinner.start('Fixing markdown files...');
            await linter.fix(sourceDir);
            spinner.succeed('Files fixed!');
        }
        else {
            // Lint mode
            spinner.start('Linting markdown files...');
            const issues = await linter.lint(sourceDir);
            spinner.succeed('Linting completed!');
            // Display results
            console.log();
            console.log(chalk.bold('Lint Results:'));
            console.log(chalk.gray('─'.repeat(50)));
            if (issues.length === 0) {
                console.log(chalk.green('No issues found!'));
            }
            else {
                // Group by severity
                const errors = issues.filter(i => i.severity === 'error');
                const warnings = issues.filter(i => i.severity === 'warning');
                const infos = issues.filter(i => i.severity === 'info');
                if (errors.length > 0) {
                    console.log();
                    console.log(chalk.red.bold(`Errors (${errors.length}):`));
                    errors.forEach(issue => {
                        console.log(formatIssue(issue, options.verbose));
                    });
                }
                if (warnings.length > 0) {
                    console.log();
                    console.log(chalk.yellow.bold(`Warnings (${warnings.length}):`));
                    warnings.forEach(issue => {
                        console.log(formatIssue(issue, options.verbose));
                    });
                }
                if (infos.length > 0) {
                    console.log();
                    console.log(chalk.blue.bold(`Info (${infos.length}):`));
                    infos.forEach(issue => {
                        console.log(formatIssue(issue, options.verbose));
                    });
                }
                console.log();
                console.log(chalk.gray('─'.repeat(50)));
                console.log(`Total: ${chalk.red(errors.length + ' errors')}, ${chalk.yellow(warnings.length + ' warnings')}, ${chalk.blue(infos.length + ' info')}`);
                if (errors.length > 0) {
                    return EXIT_ERROR;
                }
            }
        }
        return 0;
    }
    catch (error) {
        spinner.fail('Lint failed');
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
function formatIssue(issue, verbose) {
    const location = issue.line
        ? `${issue.file}:${issue.line}${issue.column ? `:${issue.column}` : ''}`
        : issue.file;
    const severityColor = issue.severity === 'error' ? chalk.red : issue.severity === 'warning' ? chalk.yellow : chalk.blue;
    if (verbose) {
        return `  ${severityColor('•')} [${issue.rule}] ${location}\n    ${issue.message}`;
    }
    return `  ${severityColor('•')} ${location}: ${issue.message}`;
}
async function runTokenOptimization(config, sourceDir, options, spinner) {
    spinner.start('Analyzing token optimization opportunities...');
    const optimizer = new TokenOptimizer();
    const patterns = config.build.include.map((p) => path.join(sourceDir, p));
    const excludePatterns = config.build.exclude.map((p) => path.join(sourceDir, p));
    // Collect markdown files
    const glob = (await import('glob')).glob;
    const allFiles = [];
    for (const pattern of patterns) {
        const matches = await glob(pattern, {
            ignore: excludePatterns,
            nodir: true,
        });
        allFiles.push(...matches);
    }
    // Analyze each file
    const allIssues = [];
    for (const filePath of allFiles) {
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = matter(content);
        const issues = optimizer.analyze(parsed.content, filePath);
        allIssues.push(...issues);
    }
    spinner.succeed('Analysis completed!');
    // Generate report
    const report = optimizer.generateReport(allIssues);
    // Format output
    let output;
    if (options.format === 'json') {
        output = optimizer.formatReportJSON(report);
    }
    else {
        output = optimizer.formatReportMarkdown(report);
    }
    // Save to file or print
    if (options.output) {
        await fs.writeFile(options.output, output, 'utf-8');
        console.log();
        console.log(chalk.green(`✓ Report saved to ${options.output}`));
    }
    else {
        console.log();
        console.log(output);
    }
    // Print summary
    console.log();
    console.log(chalk.bold('━'.repeat(60)));
    console.log(chalk.bold('Summary:'));
    console.log(`  Issues Found: ${chalk.yellow(report.totalIssues)}`);
    console.log(`  Potential Token Savings: ${chalk.green(report.totalTokenSavings)} tokens`);
    console.log();
    console.log(chalk.bold('By Severity:'));
    console.log(`  ${chalk.red('Errors')}: ${report.issuesBySeverity.error.length}`);
    console.log(`  ${chalk.yellow('Warnings')}: ${report.issuesBySeverity.warning.length}`);
    console.log(`  ${chalk.blue('Info')}: ${report.issuesBySeverity.info.length}`);
    console.log();
    console.log(chalk.bold('By Rule:'));
    for (const [rule, issues] of Object.entries(report.issuesByRule)) {
        const savings = issues.reduce((sum, i) => sum + i.tokenSavings, 0);
        console.log(`  ${rule}: ${issues.length} issues (${savings} tokens)`);
    }
    console.log(chalk.bold('━'.repeat(60)));
    console.log();
    console.log(chalk.bold('Recommendations:'));
    for (const rec of report.recommendations) {
        console.log(`  ${rec}`);
    }
}
//# sourceMappingURL=lint.js.map