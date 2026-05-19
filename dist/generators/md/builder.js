import matter from '@11ty/gray-matter';
import * as fs from 'fs/promises';
import * as path from 'path';
import { estimateTokens } from '../../utils/md/tokens.js';
import { FileCollector } from '../../utils/md/file-collector.js';
import { WATCH_DEBOUNCE_MS } from '../../utils/md/constants.js';
import { CodeBlockTracker } from '../../utils/md/code-blocks.js';
/**
 * Document builder
 * Combines multiple Markdown files into a single document
 */
export class Builder {
    config;
    constructor(config) {
        this.config = config;
    }
    /**
     * Builds combined markdown document from source directory
     *
     * Collects all markdown files matching include/exclude patterns, applies
     * build-time optimizations (frontmatter stripping, token optimization),
     * and combines them into a single output file.
     *
     * @param sourceDir - Source directory containing markdown files
     * @param outputPath - Optional output path (uses config default if not specified)
     * @returns Build result with file count, token count, and execution time
     * @throws {Error} If no files found or build fails
     *
     * @example
     * ```typescript
     * const builder = new Builder(config);
     * const result = await builder.build('./docs', './dist/output.md');
     * console.log(`Built ${result.fileCount} files in ${result.buildTime}ms`);
     * ```
     */
    async build(sourceDir, outputPath) {
        const startTime = Date.now();
        const output = outputPath || path.join(this.config.directories.output, this.config.build.default_output);
        // 1. Collect files using glob patterns
        const files = await this.collectFiles(sourceDir);
        if (files.length === 0) {
            throw new Error(`No files found matching patterns in ${sourceDir}`);
        }
        // 2. Parse frontmatter and content
        const documents = await this.parseDocuments(files);
        // 3. Sort documents
        const sortedDocs = this.sortDocuments(documents);
        // 4. Generate TOC if enabled
        let toc = '';
        if (this.config.build.toc.enabled) {
            toc = this.generateTOC(sortedDocs);
        }
        // 5. Combine documents
        const combined = this.combineDocuments(sortedDocs);
        // 6. Create final output
        const finalContent = toc ? `${toc}\n\n${this.config.build.file_separator}\n\n${combined}` : combined;
        // 7. Ensure output directory exists
        await fs.mkdir(path.dirname(output), { recursive: true });
        // 8. Write output
        await fs.writeFile(output, finalContent, 'utf-8');
        // 9. Calculate stats
        const totalSize = Buffer.byteLength(finalContent, 'utf-8');
        const buildTime = Date.now() - startTime;
        const tokenCount = estimateTokens(finalContent);
        return {
            fileCount: files.length,
            totalSize,
            buildTime,
            outputPath: output,
            tokenCount,
            stats: {
                files: files.map(f => path.relative(sourceDir, f)),
            },
        };
    }
    async collectFiles(sourceDir) {
        const collector = new FileCollector(this.config);
        const files = await collector.collect(sourceDir);
        return files.sort(); // Sort for consistent ordering
    }
    async parseDocuments(files) {
        const documents = [];
        for (const filePath of files) {
            const content = await fs.readFile(filePath, 'utf-8');
            const parsed = matter(content);
            // Process content based on config
            let processedContent = this.config.build.frontmatter.strip ? parsed.content : content;
            // Apply build-time optimizations (including section-meta and heading number stripping if enabled)
            processedContent = await this.applyBuildOptimizations(processedContent);
            documents.push({
                path: filePath,
                frontmatter: parsed.data,
                content: processedContent,
                sections: this.parseSections(parsed.content),
            });
        }
        return documents;
    }
    parseSections(content) {
        const lines = content.split('\n');
        const sections = [];
        const tracker = new CodeBlockTracker();
        for (const line of lines) {
            tracker.processLine(line);
            if (tracker.isInCodeBlock())
                continue;
            const match = line.match(/^(#{1,6})\s+(.+)$/);
            if (match && match[1] && match[2]) {
                sections.push({
                    level: match[1].length,
                    title: match[2].trim(),
                    content: '',
                    subsections: [],
                });
            }
        }
        return sections;
    }
    sortDocuments(documents) {
        if (this.config.build.sort === 'custom' && this.config.sort_order) {
            // Group documents by pattern
            const grouped = this.groupByPattern(documents);
            // Sort each group using topological sort (depends_on)
            const sorted = [];
            for (const group of grouped) {
                sorted.push(...this.topologicalSort(group));
            }
            return sorted;
        }
        // Default: sort by path
        return documents.sort((a, b) => a.path.localeCompare(b.path));
    }
    groupByPattern(documents) {
        const groups = new Map();
        for (const doc of documents) {
            const index = this.getSortIndex(doc.path);
            if (!groups.has(index)) {
                groups.set(index, []);
            }
            groups.get(index).push(doc);
        }
        // Return groups in pattern order
        return Array.from(groups.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([_, docs]) => docs);
    }
    /**
     * Topological sort of documents based on dependencies
     * Uses Kahn's algorithm with stable ordering by layer/category/title
     */
    topologicalSort(documents) {
        const basePath = path.resolve(this.config.directories.source);
        const pathMap = this.buildPathMap(documents, basePath);
        const { inDegree, dependents } = this.buildDependencyGraph(documents, pathMap);
        const result = this.kahnsAlgorithm(documents, inDegree, dependents);
        return this.handleCircularDependencies(documents, result);
    }
    /**
     * Build path map for quick document lookup
     */
    buildPathMap(documents, basePath) {
        const pathMap = new Map();
        for (const doc of documents) {
            const normalizedPath = path.relative(basePath, doc.path);
            pathMap.set(normalizedPath, doc);
        }
        return pathMap;
    }
    /**
     * Build dependency graph with in-degrees and dependents
     */
    buildDependencyGraph(documents, pathMap) {
        const inDegree = new Map();
        const dependents = new Map();
        // Initialize
        for (const doc of documents) {
            inDegree.set(doc, 0);
            dependents.set(doc, new Set());
        }
        // Build graph
        for (const doc of documents) {
            const deps = Array.isArray(doc.frontmatter?.depends_on) ? doc.frontmatter.depends_on : [];
            for (const depPath of deps) {
                const normalizedDep = String(depPath);
                const depDoc = pathMap.get(normalizedDep);
                if (depDoc && documents.includes(depDoc)) {
                    inDegree.set(doc, (inDegree.get(doc) || 0) + 1);
                    dependents.get(depDoc).add(doc);
                }
            }
        }
        return { inDegree, dependents };
    }
    /**
     * Sort documents by metadata (layer, category, title)
     */
    sortByMetadata(docs) {
        docs.sort((a, b) => {
            const aLayer = typeof a.frontmatter?.layer === 'number' ? a.frontmatter.layer : 999;
            const bLayer = typeof b.frontmatter?.layer === 'number' ? b.frontmatter.layer : 999;
            if (aLayer !== bLayer)
                return aLayer - bLayer;
            const aCategory = typeof a.frontmatter?.category === 'string' ? a.frontmatter.category : '';
            const bCategory = typeof b.frontmatter?.category === 'string' ? b.frontmatter.category : '';
            if (aCategory !== bCategory)
                return aCategory.localeCompare(bCategory);
            const aTitle = typeof a.frontmatter?.title === 'string' ? a.frontmatter.title : '';
            const bTitle = typeof b.frontmatter?.title === 'string' ? b.frontmatter.title : '';
            return aTitle.localeCompare(bTitle);
        });
    }
    /**
     * Kahn's algorithm for topological sorting
     */
    kahnsAlgorithm(documents, inDegree, dependents) {
        const queue = [];
        const result = [];
        // Start with documents that have no dependencies
        for (const doc of documents) {
            if (inDegree.get(doc) === 0) {
                queue.push(doc);
            }
        }
        // Sort initial queue for stable ordering
        this.sortByMetadata(queue);
        while (queue.length > 0) {
            const doc = queue.shift();
            result.push(doc);
            // Reduce in-degree for dependents
            for (const dependent of dependents.get(doc) || []) {
                const newInDegree = (inDegree.get(dependent) || 0) - 1;
                inDegree.set(dependent, newInDegree);
                if (newInDegree === 0) {
                    queue.push(dependent);
                    this.sortByMetadata(queue);
                }
            }
        }
        return result;
    }
    /**
     * Handle circular dependencies by appending remaining documents
     */
    handleCircularDependencies(documents, sorted) {
        if (sorted.length < documents.length) {
            const remaining = documents.filter(doc => !sorted.includes(doc));
            sorted.push(...remaining);
        }
        return sorted;
    }
    getSortIndex(filePath) {
        if (!this.config.sort_order)
            return 999;
        for (let i = 0; i < this.config.sort_order.length; i++) {
            const sortItem = this.config.sort_order[i];
            if (sortItem && sortItem.pattern) {
                // Simple pattern matching - can be enhanced with minimatch
                if (filePath.includes(sortItem.pattern)) {
                    return i;
                }
            }
        }
        return 999; // Not matched, put at end
    }
    generateTOC(documents) {
        const tocLines = [`# ${this.config.build.toc.title}`, ''];
        const maxDepth = this.config.build.toc.depth;
        for (const doc of documents) {
            for (const section of doc.sections) {
                if (section.level <= maxDepth) {
                    const indent = '  '.repeat(section.level - 1);
                    tocLines.push(`${indent}- [${section.title}](#${this.slugify(section.title)})`);
                }
            }
        }
        return tocLines.join('\n');
    }
    slugify(text) {
        return text
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s_-]/gu, '')
            .replace(/\s+/g, '-');
    }
    combineDocuments(documents) {
        return documents
            .map(doc => doc.content.trim())
            .join(this.config.build.file_separator);
    }
    /**
     * Apply build-time optimizations (non-destructive to source files)
     */
    /**
     * Apply build optimizations using unified remark pipeline
     * Migrated from regex-based to AST-based processing for safety
     */
    async applyBuildOptimizations(content) {
        const { processMarkdown } = await import('../../utils/md/remark.js');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const plugins = [];
        const opts = this.config.build.optimizations;
        // Strip heading numbers (if enabled at build level)
        if (this.config.build.strip_heading_numbers) {
            const { remarkStripHeadingNumbers } = await import('../../parsers/md/plugins/strip-heading-numbers.js');
            plugins.push(remarkStripHeadingNumbers);
        }
        // Strip section-meta (if enabled at build level)
        if (this.config.build.strip_section_meta) {
            const { remarkStripSectionMeta } = await import('../../parsers/md/plugins/strip-section-meta.js');
            plugins.push(remarkStripSectionMeta);
        }
        // RAG Enhancement: Hierarchical heading normalization
        if (opts?.normalize_headings) {
            const { remarkNormalizeHeadings } = await import('../../parsers/md/plugins/normalize-headings.js');
            plugins.push(remarkNormalizeHeadings({
                separator: opts.heading_separator || ' / ',
            }));
        }
        // Token Optimization: Remove HTML comments
        if (opts?.remove_comments) {
            const { remarkRemoveComments } = await import('../../parsers/md/plugins/remove-comments.js');
            plugins.push(remarkRemoveComments);
        }
        // Token Optimization: Remove badges
        if (opts?.remove_badges) {
            const { remarkRemoveBadges } = await import('../../parsers/md/plugins/remove-badges.js');
            plugins.push(remarkRemoveBadges);
        }
        // Token Optimization: Remove duplicates (use with caution)
        if (opts?.remove_duplicates) {
            const { remarkRemoveDuplicates } = await import('../../parsers/md/plugins/remove-duplicates.js');
            plugins.push(remarkRemoveDuplicates);
        }
        // Token Optimization: Remove internal links (redundant in combined output)
        if (opts?.remove_internal_links) {
            const { remarkRemoveInternalLinks } = await import('../../parsers/md/plugins/remove-internal-links.js');
            plugins.push(remarkRemoveInternalLinks);
        }
        // Token Optimization: Normalize whitespace
        if (opts?.normalize_whitespace) {
            const { remarkNormalizeWhitespace } = await import('../../parsers/md/plugins/normalize-whitespace.js');
            plugins.push(remarkNormalizeWhitespace);
        }
        // Process with remark pipeline
        let optimized = await processMarkdown(content, { plugins });
        // Post-process whitespace normalization if enabled
        if (opts?.normalize_whitespace) {
            const { normalizeWhitespaceContent } = await import('../../parsers/md/plugins/normalize-whitespace.js');
            optimized = normalizeWhitespaceContent(optimized);
        }
        return optimized;
    }
    /**
     * Watches source directory for changes and rebuilds automatically
     *
     * Starts a file watcher that monitors changes to markdown files and triggers
     * automatic rebuilds with debouncing. Runs indefinitely until interrupted.
     *
     * @param sourceDir - Source directory to watch
     * @param outputPath - Output path for rebuilt files
     * @returns Promise that never resolves (runs until process exit)
     * @throws {Error} If watcher setup fails (watcher is cleaned up on error)
     *
     * @example
     * ```typescript
     * const builder = new Builder(config);
     * await builder.watch('./docs', './dist/output.md');
     * // Press Ctrl+C to stop watching
     * ```
     */
    async watch(sourceDir, outputPath) {
        const chokidar = await import('chokidar');
        const chalk = (await import('chalk')).default;
        let watcher;
        try {
            console.log(chalk.blue('👀 Watching for changes...'));
            console.log(chalk.gray(`Source: ${sourceDir}`));
            console.log(chalk.gray(`Output: ${outputPath}`));
            console.log(chalk.gray('Press Ctrl+C to stop\n'));
            // Initial build
            try {
                const result = await this.build(sourceDir, outputPath);
                console.log(chalk.green(`✓ Initial build completed (${result.fileCount} files, ${result.tokenCount?.toLocaleString()} tokens)`));
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                console.error(chalk.red('✗ Initial build failed:'), message);
            }
            // Debounce timer
            let rebuildTimer = null;
            const debounceMs = WATCH_DEBOUNCE_MS;
            const rebuild = async () => {
                try {
                    console.log(chalk.blue('\n🔄 Rebuilding...'));
                    const result = await this.build(sourceDir, outputPath);
                    console.log(chalk.green(`✓ Build completed (${result.fileCount} files, ${result.tokenCount?.toLocaleString()} tokens)`));
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    console.error(chalk.red('✗ Build failed:'), message);
                }
            };
            const debouncedRebuild = () => {
                if (rebuildTimer) {
                    clearTimeout(rebuildTimer);
                }
                rebuildTimer = setTimeout(() => { void rebuild(); }, debounceMs);
            };
            // Watch patterns
            const watchPatterns = this.config.build.include.map(p => path.join(sourceDir, p));
            watcher = chokidar.watch(watchPatterns, {
                ignored: this.config.build.exclude.map(p => path.join(sourceDir, p)),
                persistent: true,
                ignoreInitial: true,
            });
            watcher
                .on('add', (filePath) => {
                console.log(chalk.gray(`[add] ${path.relative(sourceDir, filePath)}`));
                debouncedRebuild();
            })
                .on('change', (filePath) => {
                console.log(chalk.gray(`[change] ${path.relative(sourceDir, filePath)}`));
                debouncedRebuild();
            })
                .on('unlink', (filePath) => {
                console.log(chalk.gray(`[delete] ${path.relative(sourceDir, filePath)}`));
                debouncedRebuild();
            })
                .on('error', (error) => {
                console.error(chalk.red('Watcher error:'), error);
            });
            // Handle Ctrl+C
            process.on('SIGINT', () => {
                console.log(chalk.yellow('\n\n👋 Stopping watch mode...'));
                if (watcher) {
                    void watcher.close();
                }
                process.exit(0);
            });
            // Keep process alive
            return new Promise(() => { });
        }
        catch (error) {
            // Clean up on error
            if (watcher) {
                await watcher.close();
            }
            throw error;
        }
    }
}
//# sourceMappingURL=builder.js.map