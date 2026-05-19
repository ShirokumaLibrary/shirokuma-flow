import chalk from 'chalk';
import ora from 'ora';
import { loadConfig } from '../../utils/md/config.js';
import { Lister } from '../../generators/md/lister.js';
import { EXIT_ERROR } from '../../utils/md/constants.js';
import * as path from 'path';
import * as fs from 'fs/promises';
export async function listCommand(options) {
    const spinner = ora('Loading configuration...').start();
    try {
        // Load configuration
        const config = await loadConfig(options.config);
        spinner.succeed('Configuration loaded');
        // Create lister
        const lister = new Lister(config);
        const sourceDir = path.resolve(config.directories.source);
        // Parse layer option
        const layer = options.layer !== undefined ? parseInt(options.layer, 10) : undefined;
        spinner.start('Collecting files...');
        // List files
        const result = await lister.list(sourceDir, {
            format: options.format,
            layer,
            type: options.type,
            category: options.category,
            includePattern: options.include,
            groupBy: options.groupBy,
            sortBy: options.sortBy,
        });
        spinner.succeed(`Found ${result.stats.totalFiles} files`);
        // Format output
        const format = (options.format || config.list?.default_format || 'markdown');
        const formatted = lister.format(result, format, sourceDir);
        // Output
        if (options.output) {
            // Write to file
            await fs.writeFile(options.output, formatted, 'utf-8');
            console.log();
            console.log(chalk.green(`✓ Output written to ${options.output}`));
        }
        else {
            // Print to stdout
            console.log();
            console.log(formatted);
        }
        // Display stats summary
        if (options.verbose) {
            console.log();
            console.log(chalk.bold('Statistics:'));
            console.log(`  Total files: ${result.stats.totalFiles}`);
            if (result.stats.layers && Object.keys(result.stats.layers).length > 0) {
                console.log();
                console.log(chalk.bold('  Files by layer:'));
                for (const [layer, count] of Object.entries(result.stats.layers).sort()) {
                    console.log(`    Layer ${layer}: ${count} files`);
                }
            }
            if (result.stats.types && Object.keys(result.stats.types).length > 0) {
                console.log();
                console.log(chalk.bold('  Files by type:'));
                for (const [type, count] of Object.entries(result.stats.types).sort()) {
                    console.log(`    ${type}: ${count} files`);
                }
            }
            if (result.stats.categories && Object.keys(result.stats.categories).length > 0) {
                console.log();
                console.log(chalk.bold('  Files by category:'));
                for (const [category, count] of Object.entries(result.stats.categories).sort()) {
                    console.log(`    ${category}: ${count} files`);
                }
            }
        }
        return 0;
    }
    catch (error) {
        spinner.fail('List command failed');
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
//# sourceMappingURL=list.js.map