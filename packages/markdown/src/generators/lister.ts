import { glob } from 'glob';
import matter from '@11ty/gray-matter';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Config, FileInfo, ListResult } from '../parsers/types/config.js';

/**
 * Format type for list output
 */
export type ListFormat = 'simple' | 'tree' | 'detailed' | 'markdown' | 'json';

/**
 * List options
 */
export interface ListOptions {
  format?: ListFormat;
  layer?: number;
  type?: string;
  category?: string;
  includePattern?: string;
  groupBy?: 'layer' | 'type' | 'category' | 'none';
  sortBy?: 'path' | 'layer' | 'title';
}

/**
 * File lister
 * Generates file listings in various formats
 */
export class Lister {
  constructor(private config: Config) {}

  async list(sourceDir: string, options: ListOptions = {}): Promise<ListResult> {
    // Collect files
    const files = await this.collectFiles(sourceDir, options);

    // Parse frontmatter
    const fileInfos = await this.parseFiles(files, sourceDir);

    // Filter files
    const filtered = this.filterFiles(fileInfos, options);

    // Sort files
    const sorted = this.sortFiles(filtered, options);

    // Calculate stats
    const stats = this.calculateStats(sorted);

    return {
      files: sorted,
      stats,
    };
  }

  /**
   * Format list result as string
   */
  format(result: ListResult, format: ListFormat, sourceDir: string): string {
    switch (format) {
      case 'simple':
        return this.formatSimple(result);
      case 'tree':
        return this.formatTree(result, sourceDir);
      case 'detailed':
        return this.formatDetailed(result);
      case 'markdown':
        return this.formatMarkdown(result);
      case 'json':
        return this.formatJSON(result);
      default:
        return this.formatMarkdown(result);
    }
  }

  private async collectFiles(sourceDir: string, options: ListOptions): Promise<string[]> {
    const patterns = options.includePattern
      ? [path.join(sourceDir, options.includePattern)]
      : this.config.build.include.map((p) => path.join(sourceDir, p));

    const excludePatterns = this.config.build.exclude.map((p) => path.join(sourceDir, p));

    const allFiles: string[] = [];

    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        ignore: excludePatterns,
        nodir: true,
      });
      allFiles.push(...matches);
    }

    // Remove duplicates
    return [...new Set(allFiles)].sort();
  }

  private async parseFiles(files: string[], sourceDir: string): Promise<FileInfo[]> {
    const fileInfos: FileInfo[] = [];

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = matter(content);
        const stats = await fs.stat(filePath);

        // gray-matter returns data as Record<string, any>
        /* eslint-disable @typescript-eslint/no-unsafe-assignment */
        fileInfos.push({
          path: filePath,
          relativePath: path.relative(sourceDir, filePath),
          title: parsed.data.title,
          description: parsed.data.description,
          layer: parsed.data.layer,
          type: parsed.data.type,
          category: parsed.data.category,
          depends_on: parsed.data.depends_on,
          tags: parsed.data.tags,
          size: stats.size,
          modified: stats.mtime,
        });
        /* eslint-enable @typescript-eslint/no-unsafe-assignment */
      } catch {
        // Skip files that can't be read
        console.warn(`Warning: Could not read ${filePath}`);
      }
    }

    return fileInfos;
  }

  private filterFiles(files: FileInfo[], options: ListOptions): FileInfo[] {
    let filtered = files;

    if (options.layer !== undefined) {
      filtered = filtered.filter((f) => f.layer === options.layer);
    }

    if (options.type) {
      filtered = filtered.filter((f) => f.type === options.type);
    }

    if (options.category) {
      filtered = filtered.filter((f) => f.category === options.category);
    }

    return filtered;
  }

  private sortFiles(files: FileInfo[], options: ListOptions): FileInfo[] {
    const sortBy = options.sortBy || this.config.list?.sort_by || 'path';

    return files.sort((a, b) => {
      switch (sortBy) {
        case 'layer':
          const layerA = a.layer ?? 999;
          const layerB = b.layer ?? 999;
          if (layerA !== layerB) return layerA - layerB;
          return a.relativePath.localeCompare(b.relativePath);

        case 'title':
          const titleA = a.title || a.relativePath;
          const titleB = b.title || b.relativePath;
          return titleA.localeCompare(titleB);

        case 'path':
        default:
          return a.relativePath.localeCompare(b.relativePath);
      }
    });
  }

  private calculateStats(files: FileInfo[]): ListResult['stats'] {
    const stats: ListResult['stats'] = {
      totalFiles: files.length,
      layers: {},
      types: {},
      categories: {},
    };

    for (const file of files) {
      // Count layers
      if (file.layer !== undefined) {
        const layerKey = String(file.layer);
        stats.layers![layerKey] = (stats.layers![layerKey] || 0) + 1;
      }

      // Count types
      if (file.type) {
        stats.types![file.type] = (stats.types![file.type] || 0) + 1;
      }

      // Count categories
      if (file.category) {
        stats.categories![file.category] = (stats.categories![file.category] || 0) + 1;
      }
    }

    return stats;
  }

  // Format methods

  private formatSimple(result: ListResult): string {
    return result.files.map((f) => f.relativePath).join('\n');
  }

  private formatTree(result: ListResult, sourceDir: string): string {
    // Build tree structure
    interface TreeNode {
      name: string;
      path: string;
      children: Map<string, TreeNode>;
      isFile: boolean;
    }

    const root: TreeNode = {
      name: path.basename(sourceDir),
      path: sourceDir,
      children: new Map(),
      isFile: false,
    };

    for (const file of result.files) {
      const parts = file.relativePath.split(path.sep);
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;

        if (!current.children.has(part)) {
          current.children.set(part, {
            name: part,
            path: parts.slice(0, i + 1).join(path.sep),
            children: new Map(),
            isFile: i === parts.length - 1,
          });
        }

        current = current.children.get(part)!;
      }
    }

    // Render tree
    const renderNode = (node: TreeNode, prefix: string = '', isLast: boolean = true): string => {
      const lines: string[] = [];

      if (node.name !== path.basename(sourceDir)) {
        const connector = isLast ? '└── ' : '├── ';
        lines.push(prefix + connector + node.name);
      } else {
        lines.push(node.name + '/');
      }

      const childEntries = Array.from(node.children.entries());
      childEntries.forEach(([_, child], index) => {
        const isLastChild = index === childEntries.length - 1;
        const newPrefix = node.name === path.basename(sourceDir) ? '' : prefix + (isLast ? '    ' : '│   ');
        lines.push(renderNode(child, newPrefix, isLastChild));
      });

      return lines.join('\n');
    };

    return renderNode(root);
  }

  private formatDetailed(result: ListResult): string {
    const lines: string[] = [];

    for (const file of result.files) {
      lines.push(file.relativePath);

      if (file.title) {
        lines.push(`  Title: ${file.title}`);
      }

      if (file.layer !== undefined) {
        lines.push(`  Layer: ${file.layer}`);
      }

      if (file.type) {
        lines.push(`  Type: ${file.type}`);
      }

      if (file.category) {
        lines.push(`  Category: ${file.category}`);
      }

      if (file.description) {
        lines.push(`  Description: ${file.description}`);
      }

      if (file.depends_on && file.depends_on.length > 0) {
        lines.push(`  Depends on: ${file.depends_on.join(', ')}`);
      }

      if (file.tags && file.tags.length > 0) {
        lines.push(`  Tags: ${file.tags.join(', ')}`);
      }

      lines.push(''); // Empty line between files
    }

    return lines.join('\n');
  }

  private formatMarkdown(result: ListResult): string {
    const lines: string[] = ['# Documentation Index', ''];

    // Group by layer if available
    const hasLayers = result.files.some((f) => f.layer !== undefined);

    if (hasLayers) {
      const byLayer = new Map<number, FileInfo[]>();

      for (const file of result.files) {
        const layer = file.layer ?? 999;
        if (!byLayer.has(layer)) {
          byLayer.set(layer, []);
        }
        byLayer.get(layer)!.push(file);
      }

      const sortedLayers = Array.from(byLayer.keys()).sort((a, b) => a - b);

      for (const layer of sortedLayers) {
        const files = byLayer.get(layer)!;
        const layerName = this.getLayerName(layer);

        lines.push(`## ${layerName}`, '');

        for (const file of files) {
          lines.push(`### ${file.relativePath}`);

          if (file.title) {
            lines.push(`Title: ${file.title}`);
          }

          if (file.description) {
            lines.push(`Description: ${file.description}`);
          }

          if (file.type) {
            lines.push(`Type: ${file.type}`);
          }

          if (file.category) {
            lines.push(`Category: ${file.category}`);
          }

          if (file.depends_on && file.depends_on.length > 0) {
            lines.push(`Depends on: ${file.depends_on.join(', ')}`);
          }

          if (file.tags && file.tags.length > 0) {
            lines.push(`Tags: ${file.tags.join(', ')}`);
          }

          lines.push('');
        }
      }
    } else {
      // No layers, just list files
      for (const file of result.files) {
        lines.push(`## ${file.relativePath}`);

        if (file.title) {
          lines.push(`Title: ${file.title}`);
        }

        if (file.description) {
          lines.push(`Description: ${file.description}`);
        }

        lines.push('');
      }
    }

    // Add stats (if enabled in config)
    if (this.config.list?.include_stats !== false) {
      lines.push('## Statistics', '');
      lines.push(`**Total Files**: ${result.stats.totalFiles}`);

      if (result.stats.layers && Object.keys(result.stats.layers).length > 0) {
        lines.push('', '**Files by Layer**:');
        for (const [layer, count] of Object.entries(result.stats.layers).sort()) {
          const layerName = this.getLayerName(Number(layer));
          lines.push(`- ${layerName}: ${count} files`);
        }
      }

      if (result.stats.types && Object.keys(result.stats.types).length > 0) {
        lines.push('', '**Files by Type**:');
        for (const [type, count] of Object.entries(result.stats.types).sort()) {
          lines.push(`- ${type}: ${count} files`);
        }
      }
    }

    return lines.join('\n');
  }

  private formatJSON(result: ListResult): string {
    return JSON.stringify(result, null, 2);
  }

  private getLayerName(layer: number): string {
    const layerNames: Record<number, string> = {
      0: 'Layer 0: Foundation',
      1: 'Layer 1: Getting Started',
      2: 'Layer 2: Usage',
      3: 'Layer 3: Reference',
      4: 'Layer 4: Advanced',
    };

    return layerNames[layer] || `Layer ${layer}`;
  }
}
