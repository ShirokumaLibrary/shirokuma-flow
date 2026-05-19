import * as fs from 'fs/promises';
import * as path from 'path';
import YAML from 'yaml';
import { ConfigSchema } from '../../parsers/md/types/config.js';
/**
 * Load configuration from file
 */
export async function loadConfig(configPath) {
    let resolvedPath;
    if (configPath) {
        // Use provided path
        resolvedPath = path.resolve(configPath);
    }
    else {
        // Search for default config files
        const defaultPaths = [
            'shirokuma-md.config.yaml',
            'shirokuma-md.config.json',
            '.shirokuma-md.yaml',
            '.shirokuma-md.json',
        ];
        let found = false;
        for (const defaultPath of defaultPaths) {
            const fullPath = path.resolve(defaultPath);
            try {
                await fs.access(fullPath);
                resolvedPath = fullPath;
                found = true;
                break;
            }
            catch {
                // File doesn't exist, continue searching
            }
        }
        if (!found) {
            throw new Error('No configuration file found. Please create shirokuma-md.config.yaml or specify path with --config');
        }
        resolvedPath = resolvedPath;
    }
    // Read file
    const content = await fs.readFile(resolvedPath, 'utf-8');
    // Parse based on extension
    let rawConfig;
    const ext = path.extname(resolvedPath);
    if (ext === '.yaml' || ext === '.yml') {
        rawConfig = YAML.parse(content);
    }
    else if (ext === '.json') {
        rawConfig = JSON.parse(content);
    }
    else {
        throw new Error(`Unsupported config file format: ${ext}`);
    }
    // Validate with Zod schema
    try {
        const config = ConfigSchema.parse(rawConfig);
        return config;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Configuration validation failed:\n${message}`);
    }
}
/**
 * Get default configuration
 */
export function getDefaultConfig() {
    return {
        directories: {
            source: 'docs/',
            output: 'dist/',
            config: '.shirokuma/',
        },
        build: {
            default_output: 'output.md',
            include: ['**/*.md'],
            exclude: ['node_modules/**', '**/dist/**'],
            frontmatter: {
                strip: true,
            },
            toc: {
                enabled: true,
                depth: 3,
                title: 'Table of Contents',
            },
            file_separator: '\n\n---\n\n',
            sort: 'path',
            strip_section_meta: true,
            strip_heading_numbers: false,
        },
        validation: {
            required_frontmatter: [],
            no_internal_links: true,
        },
        lint: {
            builtin_rules: {},
        },
    };
}
//# sourceMappingURL=config.js.map