/**
 * repo pairs helpers - Shared types and utilities for pairs subcommands
 */
import chalk from "chalk";
import { readdirSync, openSync, readSync, closeSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { existsSync } from "node:fs";
import { minimatch } from "minimatch";
// =============================================================================
// Logger
// =============================================================================
export function createPairsLogger(isVerbose) {
    return {
        info: (msg) => console.log(msg),
        error: (msg) => console.error(chalk.red(`Error: ${msg}`)),
        verbose: (msg) => {
            if (isVerbose)
                console.log(chalk.gray(msg));
        },
        success: (msg) => console.log(chalk.green(`\u2713 ${msg}`)),
    };
}
// =============================================================================
// Helper Functions
// =============================================================================
/**
 * Collect local files recursively, filtering by exclude patterns.
 */
export function collectLocalFiles(basePath, excludePatterns) {
    const result = [];
    function walk(dir) {
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
export function isBinaryFile(filePath) {
    let fd;
    try {
        fd = openSync(filePath, "r");
        const buf = Buffer.alloc(512);
        const bytesRead = readSync(fd, buf, 0, 512, 0);
        for (let i = 0; i < bytesRead; i++) {
            if (buf[i] === 0)
                return true;
        }
        return false;
    }
    catch {
        return false;
    }
    finally {
        if (fd !== undefined)
            closeSync(fd);
    }
}
/**
 * Find shirokuma-docs config file in current directory.
 */
export function findConfigFile() {
    const candidates = [
        "shirokuma-docs.config.yaml",
        "shirokuma-docs.config.yml",
    ];
    for (const name of candidates) {
        const path = resolve(process.cwd(), name);
        if (existsSync(path))
            return path;
    }
    return null;
}
//# sourceMappingURL=helpers.js.map