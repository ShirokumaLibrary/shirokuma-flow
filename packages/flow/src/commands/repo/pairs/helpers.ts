/**
 * repo pairs helpers - Shared types and utilities for pairs subcommands
 */

import chalk from "chalk";
import { readdirSync, openSync, readSync, closeSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { existsSync } from "node:fs";
import { minimatch } from "minimatch";

// =============================================================================
// Types
// =============================================================================

export interface RepoPairsOptions {
  verbose?: boolean;
  private?: string;
  public?: string;
  exclude?: string[];
  tag?: string;
  dryRun?: boolean;
  sourceDir?: string;
}

export interface PairsLogger {
  info: (msg: string) => void;
  error: (msg: string) => void;
  verbose: (msg: string) => void;
  success: (msg: string) => void;
}

// =============================================================================
// Logger
// =============================================================================

export function createPairsLogger(isVerbose?: boolean): PairsLogger {
  return {
    info: (msg: string) => console.log(msg),
    error: (msg: string) => console.error(chalk.red(`Error: ${msg}`)),
    verbose: (msg: string) => {
      if (isVerbose) console.log(chalk.gray(msg));
    },
    success: (msg: string) => console.log(chalk.green(`\u2713 ${msg}`)),
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Collect local files recursively, filtering by exclude patterns.
 */
export function collectLocalFiles(
  basePath: string,
  excludePatterns: string[]
): Array<{ path: string; isBinary: boolean }> {
  const result: Array<{ path: string; isBinary: boolean }> = [];

  function walk(dir: string): void {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relPath = relative(basePath, fullPath);

      if (entry.isDirectory()) {
        const dirRelPath = relPath + "/";
        const isExcluded = excludePatterns.some(p => minimatch(dirRelPath, p, { dot: true }));
        if (!isExcluded) {
          walk(fullPath);
        }
        continue;
      }

      if (entry.isFile()) {
        const isExcluded = excludePatterns.some(p => minimatch(relPath, p, { dot: true }));
        if (!isExcluded) {
          result.push({ path: relPath, isBinary: isBinaryFile(fullPath) });
        }
      }
    }
  }

  walk(basePath);
  return result;
}

/**
 * Determine if a file is binary by checking for null bytes in the first 512 bytes.
 */
export function isBinaryFile(filePath: string): boolean {
  let fd: number | undefined;
  try {
    fd = openSync(filePath, "r");
    const buf = Buffer.alloc(512);
    const bytesRead = readSync(fd, buf, 0, 512, 0);
    for (let i = 0; i < bytesRead; i++) {
      if (buf[i] === 0) return true;
    }
    return false;
  } catch {
    return false;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/**
 * Find shirokuma-flow config file in current directory.
 */
export function findConfigFile(): string | null {
  const candidates = [
    ".shirokuma/config.yaml",
    ".shirokuma/config.yml",
  ];

  for (const name of candidates) {
    const path = resolve(process.cwd(), name);
    if (existsSync(path)) return path;
  }

  return null;
}
