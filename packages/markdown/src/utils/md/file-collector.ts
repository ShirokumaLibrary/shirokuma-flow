import { glob } from 'glob';
import * as path from 'path';
import type { Config } from '../../parsers/types/config.js';

/**
 * Options for file collection
 */
export interface FileCollectionOptions {
  /**
   * Override include patterns from config
   */
  includePatterns?: string[];

  /**
   * Override exclude patterns from config
   */
  excludePatterns?: string[];

  /**
   * Additional glob options
   */
  globOptions?: {
    nodir?: boolean;
    dot?: boolean;
    absolute?: boolean;
  };
}

/**
 * Utility for collecting markdown files based on configuration
 *
 * Eliminates duplicated file collection logic across Builder, Validator, and Linter.
 *
 * @example
 * ```typescript
 * const collector = new FileCollector(config);
 * const files = await collector.collect(sourceDir);
 * ```
 */
export class FileCollector {
  constructor(private config: Config) {}

  /**
   * Collect all markdown files matching configuration patterns
   *
   * @param sourceDir - Base directory to search in
   * @param options - Override options
   * @returns Array of absolute file paths
   */
  async collect(
    sourceDir: string,
    options: FileCollectionOptions = {}
  ): Promise<string[]> {
    const includePatterns =
      options.includePatterns || this.config.build.include;
    const excludePatterns =
      options.excludePatterns || this.config.build.exclude;

    const patterns = includePatterns.map((p) => path.join(sourceDir, p));
    const exclude = excludePatterns.map((p) => path.join(sourceDir, p));

    const allFiles: string[] = [];
    const seen = new Set<string>();

    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        ignore: exclude,
        nodir: true,
        ...options.globOptions,
      });

      // Deduplicate files
      for (const file of matches) {
        if (!seen.has(file)) {
          seen.add(file);
          allFiles.push(file);
        }
      }
    }

    return allFiles;
  }

  /**
   * Collect files with custom filter function
   *
   * @param sourceDir - Base directory
   * @param filterFn - Custom filter function
   * @param options - Collection options
   * @returns Filtered file paths
   */
  async collectFiltered(
    sourceDir: string,
    filterFn: (filePath: string) => boolean | Promise<boolean>,
    options: FileCollectionOptions = {}
  ): Promise<string[]> {
    const allFiles = await this.collect(sourceDir, options);
    const filtered: string[] = [];

    for (const file of allFiles) {
      const shouldInclude = await filterFn(file);
      if (shouldInclude) {
        filtered.push(file);
      }
    }

    return filtered;
  }

  /**
   * Get relative paths from source directory
   *
   * @param sourceDir - Base directory
   * @param options - Collection options
   * @returns Array of relative file paths
   */
  async collectRelative(
    sourceDir: string,
    options: FileCollectionOptions = {}
  ): Promise<string[]> {
    const absolutePaths = await this.collect(sourceDir, options);
    return absolutePaths.map((file) => path.relative(sourceDir, file));
  }

  /**
   * Count total files matching patterns
   *
   * @param sourceDir - Base directory
   * @param options - Collection options
   * @returns Number of files
   */
  async count(
    sourceDir: string,
    options: FileCollectionOptions = {}
  ): Promise<number> {
    const files = await this.collect(sourceDir, options);
    return files.length;
  }
}

/**
 * Helper function to create FileCollector instance
 *
 * @param config - Configuration object
 * @returns FileCollector instance
 */
export function createFileCollector(config: Config): FileCollector {
  return new FileCollector(config);
}
