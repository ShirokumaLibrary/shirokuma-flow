/**
 * 'md' サブコマンドグループの Commander.js Command を作成する。
 * shirokuma-md から統合済み。
 *
 * Usage:
 *   import { createMdCommand } from "./commands/md/program.js";
 *   program.addCommand(createMdCommand());
 */
// Commander.js action callbacks receive opts as any; types are cast at boundary.
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Command } from 'commander';
import { setExitCode } from '@shirokuma-library/lint';
import { buildCommand } from './build.js';
import { validateCommand } from './validate.js';
import { analyzeCommand } from './analyze.js';
import { lintCommand } from './lint.js';
import { listCommand } from './list.js';
import { extractCommand, batchExtractCommand } from './extract.js';
export function createMdCommand() {
    const md = new Command('md')
        .description('LLM-optimized Markdown document management (shirokuma-md)');
    // Build command
    md
        .command('build')
        .description('Build combined markdown document')
        .option('-c, --config <path>', 'Path to config file (default: shirokuma-md.config.yaml)')
        .option('-o, --output <path>', 'Output file path')
        .option('--include <pattern>', 'Additional include pattern')
        .option('--exclude <pattern>', 'Additional exclude pattern')
        .option('-v, --verbose', 'Verbose output')
        .option('-w, --watch', 'Watch mode - rebuild on file changes')
        .action(async (options) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setExitCode(await buildCommand(options));
    });
    // Validate command
    md
        .command('validate')
        .description('Validate markdown documents')
        .option('-c, --config <path>', 'Path to config file')
        .option('--severity <level>', 'Minimum severity level (error, warning, info)', 'info')
        .option('-v, --verbose', 'Verbose output')
        .action(async (options) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setExitCode(await validateCommand(options));
    });
    // Analyze command
    md
        .command('analyze')
        .description('Analyze document structure and dependencies')
        .option('-c, --config <path>', 'Path to config file')
        .option('-g, --graph', 'Generate dependency graph')
        .option('-o, --output <path>', 'Output file for graph')
        .option('-m, --metrics', 'Include file size and token metrics')
        .option('-s, --suggest', 'Generate split suggestions for large files')
        .option('-v, --verbose', 'Verbose output')
        .action(async (options) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setExitCode(await analyzeCommand(options));
    });
    // Lint command
    md
        .command('lint')
        .description('Lint markdown files')
        .option('-c, --config <path>', 'Path to config file')
        .option('--fix', 'Automatically fix issues')
        .option('--suggest-fixes', 'Analyze token optimization opportunities')
        .option('--format <format>', 'Report format (markdown, json)', 'markdown')
        .option('-o, --output <path>', 'Output file for report (default: stdout)')
        .option('-v, --verbose', 'Verbose output')
        .action(async (options) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setExitCode(await lintCommand(options));
    });
    // List command
    md
        .command('list')
        .description('List all documentation files')
        .option('-c, --config <path>', 'Path to config file')
        .option('-f, --format <format>', 'Output format (simple, tree, detailed, markdown, json)', 'markdown')
        .option('-o, --output <path>', 'Output file path (default: stdout)')
        .option('--layer <number>', 'Filter by layer')
        .option('--type <type>', 'Filter by type')
        .option('--category <category>', 'Filter by category')
        .option('--include <pattern>', 'Include pattern')
        .option('--group-by <field>', 'Group by field (layer, type, category, none)')
        .option('--sort-by <field>', 'Sort by field (path, layer, title)')
        .option('-v, --verbose', 'Verbose output')
        .action(async (options) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setExitCode(await listCommand(options));
    });
    // Extract command
    md
        .command('extract')
        .description('Extract information from markdown files')
        .requiredOption('-t, --type <type>', 'Document type (character, profession, equipment, etc.)')
        .requiredOption('-i, --input <path>', 'Input file path')
        .option('-o, --output <path>', 'Output file path (auto-determined if not specified)')
        .option('-c, --config <path>', 'Path to config file (default: extraction-config.yaml)')
        .option('--dry-run', 'Preview extraction without writing files')
        .option('-v, --verbose', 'Verbose output')
        .option('--validate', 'Validate after extraction', true)
        .option('--overwrite', 'Overwrite existing files')
        .action(async (options) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setExitCode(await extractCommand(options));
    });
    // Batch extract command
    md
        .command('batch-extract')
        .description('Extract information from multiple markdown files')
        .requiredOption('-t, --type <type>', 'Document type (all files must be same type)')
        .requiredOption('-i, --input-dir <path>', 'Input directory')
        .option('-o, --output-dir <path>', 'Output directory (auto-determined if not specified)')
        .option('-c, --config <path>', 'Path to config file')
        .option('-p, --pattern <glob>', 'File pattern (default: *.md)')
        .option('-r, --report <path>', 'Report output path (default: reports/extract-report.md)')
        .option('--continue-on-error', 'Continue processing even if some files fail')
        .option('-v, --verbose', 'Verbose output')
        .option('--overwrite', 'Overwrite existing files')
        .action(async (options) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setExitCode(await batchExtractCommand(options));
    });
    return md;
}
//# sourceMappingURL=program.js.map