import matter from '@11ty/gray-matter';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Config } from '../parsers/types/config.js';
import type { AnalysisResult, DependencyEdge, FileMetrics, HeadingNode, SplitSuggestion } from '../parsers/types/validation.js';
import type { Document } from '../parsers/types/document.js';
import { parseHeadings, countLines, flattenHeadings } from '../utils/md/markdown.js';
import { estimateTokens } from '../utils/md/tokens.js';
import { FileCollector } from '../utils/md/file-collector.js';

/**
 * Document analyzer
 * Analyzes document structure and dependencies
 */
export class Analyzer {
  constructor(private config: Config) {}

  /**
   * Analyzes document structure and dependencies
   *
   * Performs comprehensive analysis including:
   * - Dependency graph extraction (frontmatter, wiki-links, markdown links)
   * - Circular dependency detection
   * - Orphan file detection
   * - File metrics (lines, tokens, headings)
   * - Split suggestions for large files (optional)
   *
   * @param sourceDir - Source directory containing markdown files
   * @param options - Analysis options (includeMetrics, includeSplitSuggestions)
   * @returns Analysis result with dependencies, metrics, and suggestions
   *
   * @example
   * ```typescript
   * const analyzer = new Analyzer(config);
   * const result = await analyzer.analyze('./docs', { includeMetrics: true });
   * console.log(`Found ${result.dependencies.length} dependencies`);
   * console.log(`Detected ${result.cycles.length} circular dependencies`);
   * ```
   */
  async analyze(sourceDir: string, options?: { includeMetrics?: boolean; includeSplitSuggestions?: boolean }): Promise<AnalysisResult> {
    // Collect all markdown files
    const collector = new FileCollector(this.config);
    const allFiles = await collector.collect(sourceDir);

    // Parse documents
    const documents: Document[] = [];
    for (const filePath of allFiles) {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = matter(content);

      documents.push({
        path: filePath,
        frontmatter: parsed.data,
        content: parsed.content,
        sections: [],
      });
    }

    // Extract dependencies
    const dependencies = this.extractDependencies(documents, sourceDir);

    // Detect cycles
    const cycles = this.detectCycles(dependencies);

    // Detect orphans
    const orphans = this.detectOrphans(documents, dependencies);

    // Calculate most referenced files
    const mostReferenced = this.calculateMostReferenced(dependencies);

    const result: AnalysisResult = {
      totalFiles: documents.length,
      dependencies,
      orphans,
      cycles,
      mostReferenced,
    };

    // Optionally compute file metrics
    if (options?.includeMetrics) {
      const fileMetrics = await this.calculateFileMetrics(documents, sourceDir);
      result.fileMetrics = fileMetrics;
      result.totalTokens = fileMetrics.reduce((sum, m) => sum + m.tokens, 0);
      result.averageTokensPerFile = result.totalTokens / fileMetrics.length;
    }

    // Optionally generate split suggestions
    if (options?.includeSplitSuggestions && result.fileMetrics) {
      result.splitSuggestions = this.generateSplitSuggestions(result.fileMetrics);
    }

    return result;
  }

  private extractDependencies(documents: Document[], sourceDir: string): DependencyEdge[] {
    const edges: DependencyEdge[] = [];

    for (const doc of documents) {
      const from = path.relative(sourceDir, doc.path);

      // 1. Extract from frontmatter dependencies
      if (doc.frontmatter.dependencies && Array.isArray(doc.frontmatter.dependencies)) {
        for (const dep of doc.frontmatter.dependencies) {
          edges.push({
            from,
            to: dep,
            type: 'frontmatter',
          });
        }
      }

      // 2. Extract wiki-links [[filename]]
      const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
      let match;
      while ((match = wikiLinkRegex.exec(doc.content)) !== null) {
        if (match[1]) {
          edges.push({
            from,
            to: match[1],
            type: 'wiki-link',
          });
        }
      }

      // 3. Extract markdown links [text](path.md)
      const mdLinkRegex = /\[([^\]]+)\]\(([^)]+\.md)\)/g;
      while ((match = mdLinkRegex.exec(doc.content)) !== null) {
        if (match[2]) {
          edges.push({
            from,
            to: match[2],
            type: 'markdown-link',
          });
        }
      }
    }

    return edges;
  }

  private detectCycles(dependencies: DependencyEdge[]): string[][] {
    const cycles: string[][] = [];
    const graph = this.buildGraph(dependencies);

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (node: string, path: string[]): void => {
      visited.add(node);
      recStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path]);
        } else if (recStack.has(neighbor)) {
          // Found a cycle
          const cycleStart = path.indexOf(neighbor);
          if (cycleStart !== -1) {
            cycles.push([...path.slice(cycleStart), neighbor]);
          }
        }
      }

      recStack.delete(node);
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  private detectOrphans(documents: Document[], dependencies: DependencyEdge[]): string[] {
    const referenced = new Set<string>();

    for (const edge of dependencies) {
      referenced.add(edge.to);
    }

    const orphans: string[] = [];
    for (const doc of documents) {
      const fileName = path.basename(doc.path);
      if (!referenced.has(fileName) && !referenced.has(doc.path)) {
        orphans.push(doc.path);
      }
    }

    return orphans;
  }

  private calculateMostReferenced(dependencies: DependencyEdge[]): Array<{ file: string; count: number }> {
    const counts = new Map<string, number>();

    for (const edge of dependencies) {
      counts.set(edge.to, (counts.get(edge.to) || 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([file, count]) => ({ file, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10
  }

  private buildGraph(dependencies: DependencyEdge[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    for (const edge of dependencies) {
      if (!graph.has(edge.from)) {
        graph.set(edge.from, []);
      }
      graph.get(edge.from)!.push(edge.to);
    }

    return graph;
  }

  private async calculateFileMetrics(documents: Document[], sourceDir: string): Promise<FileMetrics[]> {
    const metrics: FileMetrics[] = [];

    for (const doc of documents) {
      const stat = await fs.stat(doc.path);
      const lines = countLines(doc.content);
      const tokens = estimateTokens(doc.content);
      const headings = parseHeadings(doc.content);

      metrics.push({
        file: path.relative(sourceDir, doc.path),
        size: stat.size,
        lines,
        tokens,
        headings,
        topLevelSections: headings.length,
      });
    }

    return metrics;
  }

  private generateSplitSuggestions(fileMetrics: FileMetrics[]): SplitSuggestion[] {
    const suggestions: SplitSuggestion[] = [];

    // Thresholds for suggesting splits
    const MAX_LINES = 200;
    const MAX_TOKENS = 2000;
    const MIN_SPLIT_SIZE = 50; // Minimum lines for a split section

    for (const metrics of fileMetrics) {
      const shouldSplit = metrics.lines > MAX_LINES || metrics.tokens > MAX_TOKENS;

      if (!shouldSplit) {
        continue;
      }

      // Find Level 2 headings as split candidates
      const splitCandidates: SplitSuggestion['suggestedSplits'] = [];
      const allHeadings = flattenHeadings(metrics.headings);

      for (const heading of allHeadings) {
        if (heading.level === 2) {
          const sectionLines = heading.endLine - heading.startLine + 1;
          const sectionContent = this.extractSectionContent(heading);
          const sectionTokens = estimateTokens(sectionContent);

          if (sectionLines >= MIN_SPLIT_SIZE) {
            splitCandidates.push({
              heading: heading.text,
              level: heading.level,
              startLine: heading.startLine,
              endLine: heading.endLine,
              estimatedLines: sectionLines,
              estimatedTokens: sectionTokens,
            });
          }
        }
      }

      if (splitCandidates.length > 0) {
        let reason = '';
        if (metrics.lines > MAX_LINES && metrics.tokens > MAX_TOKENS) {
          reason = `File is too large (${metrics.lines} lines, ${metrics.tokens} tokens)`;
        } else if (metrics.lines > MAX_LINES) {
          reason = `File has too many lines (${metrics.lines})`;
        } else {
          reason = `File has too many tokens (${metrics.tokens})`;
        }

        suggestions.push({
          file: metrics.file,
          reason,
          currentSize: metrics.lines,
          currentTokens: metrics.tokens,
          suggestedSplits: splitCandidates,
        });
      }
    }

    return suggestions;
  }

  private extractSectionContent(heading: HeadingNode): string {
    // Rough estimate based on lines - in real implementation,
    // we'd need the original content
    const avgCharsPerLine = 80;
    const estimatedChars = (heading.endLine - heading.startLine + 1) * avgCharsPerLine;
    return 'x'.repeat(estimatedChars);
  }

  generateGraph(result: AnalysisResult): string {
    const lines: string[] = ['```mermaid', 'graph TD'];

    // Add nodes and edges
    const nodeIds = new Map<string, string>();
    let nodeCounter = 0;

    for (const edge of result.dependencies) {
      // Create node IDs
      if (!nodeIds.has(edge.from)) {
        nodeIds.set(edge.from, `N${nodeCounter++}`);
      }
      if (!nodeIds.has(edge.to)) {
        nodeIds.set(edge.to, `N${nodeCounter++}`);
      }

      const fromId = nodeIds.get(edge.from)!;
      const toId = nodeIds.get(edge.to)!;

      // Add edge with type label
      const edgeStyle = edge.type === 'frontmatter' ? '-->' : edge.type === 'wiki-link' ? '-..->' : '-->';
      lines.push(`  ${fromId}["${edge.from}"] ${edgeStyle} ${toId}["${edge.to}"]`);
    }

    lines.push('```');
    return lines.join('\n');
  }
}
