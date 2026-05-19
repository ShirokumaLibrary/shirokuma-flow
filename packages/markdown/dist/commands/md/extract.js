import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs/promises';
import { loadConfig } from '../../utils/md/config.js';
import { Extractor } from '../../generators/extractor.js';
import { EXIT_ERROR } from '../../utils/md/constants.js';
import YAML from 'yaml';
export async function extractCommand(options) {
    const spinner = ora('Loading configuration...').start();
    try {
        // Load configuration
        const config = await loadConfig(options.config);
        spinner.succeed('Configuration loaded');
        // Create extractor
        const extractor = new Extractor(config);
        // Extract
        spinner.start('Extracting information...');
        const result = await extractor.extract(options.input, options.type, options.output);
        if (!result.success) {
            spinner.fail('Extraction failed');
            console.error();
            console.error(chalk.red('Errors:'));
            result.errors.forEach(error => {
                console.error(chalk.red(`  • ${error}`));
            });
            return EXIT_ERROR;
        }
        spinner.succeed('Extraction completed');
        // Display results
        console.log();
        console.log(chalk.bold('Extraction Results:'));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(`${chalk.cyan('Fields extracted:')} ${result.stats.fieldsExtracted}/${result.stats.fieldsTotal} (${result.stats.extractionRate.toFixed(1)}%)`);
        console.log(`${chalk.cyan('Mappings applied:')} ${result.stats.mappingsApplied}`);
        if (result.warnings.length > 0) {
            console.log(`${chalk.yellow('Warnings:')} ${result.warnings.length}`);
        }
        console.log(chalk.gray('─'.repeat(50)));
        // Show warnings
        if (result.warnings.length > 0 && options.verbose) {
            console.log();
            console.log(chalk.yellow('Warnings:'));
            result.warnings.forEach(warning => {
                console.log(chalk.yellow(`  ⚠ ${warning}`));
            });
        }
        // Dry-run: display frontmatter
        if (options.dryRun) {
            console.log();
            console.log(chalk.bold('Generated Frontmatter (preview):'));
            console.log(chalk.gray('─'.repeat(50)));
            console.log(chalk.cyan('---'));
            console.log(chalk.cyan(YAML.stringify(result.frontmatter).trim()));
            console.log(chalk.cyan('---'));
            console.log();
            console.log(chalk.gray('(Original content would follow here)'));
            console.log();
            console.log(chalk.yellow('Dry-run mode: No files were written'));
        }
        else {
            // Write file
            spinner.start('Writing file...');
            const originalContent = await fs.readFile(options.input, 'utf-8');
            await extractor.writeExtractedFile(result, originalContent, options.overwrite);
            spinner.succeed(`File written to: ${result.outputPath}`);
            console.log();
            console.log(chalk.green(`✓ Extraction successful: ${result.outputPath}`));
        }
        return 0;
    }
    catch (error) {
        spinner.fail('Extraction failed');
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
export async function batchExtractCommand(options) {
    const spinner = ora('Loading configuration...').start();
    try {
        // Load configuration
        const config = await loadConfig(options.config);
        spinner.succeed('Configuration loaded');
        // Create extractor
        const extractor = new Extractor(config);
        // Batch extract
        spinner.start('Extracting files...');
        const result = await extractor.batchExtract(options.inputDir, options.type, options.outputDir, {
            pattern: options.pattern,
            continueOnError: options.continueOnError,
            overwrite: options.overwrite,
        });
        spinner.succeed('Batch extraction completed');
        // Display results
        console.log();
        console.log(chalk.bold('Batch Extraction Results:'));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(`${chalk.cyan('Total files:')} ${result.totalFiles}`);
        console.log(`${chalk.green('Successful:')} ${result.successCount} (${((result.successCount / result.totalFiles) * 100).toFixed(1)}%)`);
        if (result.failureCount > 0) {
            console.log(`${chalk.red('Failed:')} ${result.failureCount}`);
        }
        if (result.warningCount > 0) {
            console.log(`${chalk.yellow('Warnings:')} ${result.warningCount} files`);
        }
        console.log(chalk.gray('─'.repeat(50)));
        // Show field extraction rates
        if (options.verbose) {
            console.log();
            console.log(chalk.bold('Field Extraction Rates:'));
            console.log(chalk.gray('─'.repeat(50)));
            const sortedFields = Object.entries(result.fieldStats).sort((a, b) => b[1].rate - a[1].rate);
            for (const [field, stats] of sortedFields) {
                const rateColor = stats.rate === 100 ? chalk.green : stats.rate >= 80 ? chalk.yellow : chalk.red;
                console.log(`  ${field.padEnd(20)} ${rateColor(`${stats.extracted}/${stats.total}`)} (${rateColor(`${stats.rate.toFixed(1)}%`)})`);
            }
        }
        // Show unmapped values
        if (result.unmappedValues.length > 0) {
            console.log();
            console.log(chalk.yellow('Unmapped Values Found:'));
            console.log(chalk.gray('─'.repeat(50)));
            for (const unmapped of result.unmappedValues) {
                console.log(chalk.yellow(`  • ${unmapped.field}: "${unmapped.value}" (${unmapped.count} occurrences)`));
            }
            console.log();
            console.log(chalk.gray('Suggestion: Add these values to your extraction-config.yaml mappings'));
        }
        // Generate report
        if (options.report) {
            spinner.start('Generating report...');
            await generateReport(result, options);
            spinner.succeed(`Report written to: ${options.report}`);
        }
        // Exit with error if any files failed
        if (result.failureCount > 0) {
            return EXIT_ERROR;
        }
        return 0;
    }
    catch (error) {
        spinner.fail('Batch extraction failed');
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
async function generateReport(result, options) {
    const report = `# Batch Extraction Report
**Date**: ${new Date().toISOString().split('T')[0]}
**Type**: ${options.type}
**Input Directory**: ${options.inputDir}
**Output Directory**: ${options.outputDir || 'auto-determined'}

---

## Summary

| Metric | Value |
|--------|-------|
| Total files | ${result.totalFiles} |
| Successful | ${result.successCount} |
| Failed | ${result.failureCount} |
| Success rate | ${((result.successCount / result.totalFiles) * 100).toFixed(1)}% |

---

## Field Extraction Rate

| Field | Extracted | Rate | Notes |
|-------|-----------|------|-------|
${Object.entries(result.fieldStats)
        .map(([field, stats]) => `| ${field} | ${stats.extracted}/${stats.total} | ${stats.rate.toFixed(1)}% | ${stats.rate < 100 ? `${stats.total - stats.extracted} files missing` : '-'} |`)
        .join('\n')}

---

## Unmapped Values

${result.unmappedValues.length > 0
        ? `| Field | Value | Count | Suggestion |
|-------|-------|-------|------------|
${result.unmappedValues
            .map((u) => `| ${u.field} | "${u.value}" | ${u.count} | Add to mappings |`)
            .join('\n')}`
        : 'No unmapped values found.'}

---

## Failed Files

${result.results
        .filter((r) => !r.success)
        .map((r) => `### ${r.inputPath}
**Errors**:
${r.errors.map((e) => `- ${e}`).join('\n')}
`)
        .join('\n') || 'No failed files.'}

---

## Recommendations

${result.unmappedValues.length > 0 ? `1. Add missing mappings to extraction-config.yaml:
   \`\`\`yaml
   mappings:
     <mapping_name>:
${result.unmappedValues
        .map((u) => `       '${u.value}': <target_value>`)
        .join('\n')}
   \`\`\`

` : ''}${result.failureCount > 0 ? `2. Fix source files that failed extraction

` : ''}3. Re-run extraction after fixes:
   \`\`\`bash
   shirokuma-md batch-extract --type ${options.type} --input-dir ${options.inputDir}
   \`\`\`
`;
    if (options.report) {
        await fs.writeFile(options.report, report, 'utf-8');
    }
}
//# sourceMappingURL=extract.js.map