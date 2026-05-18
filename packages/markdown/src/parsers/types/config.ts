import { z } from 'zod';

/**
 * Configuration schema for shirokuma-md.config.yaml
 */
export const ConfigSchema = z.object({
  project: z.object({
    name: z.string(),
    version: z.string(),
    description: z.string().optional(),
  }),

  directories: z.object({
    source: z.string().default('docs/'),
    output: z.string().default('dist/'),
    config: z.string().default('.shirokuma/'),
    templates: z.string().optional(),
    schemas: z.string().optional(),
  }),

  build: z.object({
    default_output: z.string(),
    include: z.array(z.string()),
    exclude: z.array(z.string()),
    frontmatter: z.object({
      strip: z.boolean().default(true),
      preserve_fields: z.array(z.string()).optional(),
    }),
    toc: z.object({
      enabled: z.boolean().default(true),
      depth: z.number().default(3),
      title: z.string().default('Table of Contents'),
    }),
    file_separator: z.string().default('\n\n---\n\n'),
    sort: z.enum(['path', 'custom']).default('path'),
    strip_section_meta: z.boolean().default(true),
    strip_heading_numbers: z.boolean().default(true),
    optimizations: z.object({
      // Existing optimizations
      remove_internal_links: z.boolean().default(false),
      normalize_whitespace: z.boolean().default(false),

      // RAG enhancement: Hierarchical heading normalization
      normalize_headings: z.boolean().default(false),
      heading_separator: z.string().default(' / '),

      // Token optimization: Content removal
      remove_comments: z.boolean().default(false),
      remove_badges: z.boolean().default(false),
      remove_duplicates: z.boolean().default(false),
      remove_blockquotes: z.boolean().default(false),
    }).optional(),
  }),

  sort_order: z
    .array(
      z.object({
        pattern: z.string(),
      })
    )
    .optional(),

  validation: z.object({
    required_frontmatter: z.array(z.string()).default([]),
    custom_types: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())])).optional(),
    forbidden_patterns: z
      .array(
        z.object({
          pattern: z.string(),
          message: z.string(),
          apply_to: z.string().optional(),
        })
      )
      .optional(),
    no_internal_links: z.boolean().default(true),
    template_compliance: z
      .object({
        enabled: z.boolean().default(false),
        check_required_sections: z.boolean().default(true),
        check_variable_substitution: z.boolean().default(true),
        severity: z.enum(['error', 'warning', 'info']).default('error'),
      })
      .optional(),
  }),

  lint: z.object({
    builtin_rules: z.record(z.string(), z.boolean()),
    file_naming: z
      .object({
        pattern: z.string(),
        message: z.string().optional(),
      })
      .optional(),
    rules: z
      .object({
        consistent_structure: z
          .object({
            enabled: z.boolean().default(false),
            overview_location: z.enum(['inside', 'outside']).default('inside'),
            directory_threshold: z.number().default(4),
            overview_naming: z.string().default('overview.md'),
          })
          .optional(),
      })
      .optional(),
  }),

  analyze: z
    .object({
      dependency_detection: z.array(z.object({
        type: z.enum(['frontmatter', 'wiki-link', 'markdown-link']),
        pattern: z.string().optional(),
        enabled: z.boolean().default(true),
      })),
    })
    .optional(),

  plugins: z
    .array(
      z.object({
        module: z.string(),
        validators: z.array(z.string()).optional(),
        enabled: z.boolean().optional(),
        config: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .optional(),

  extraction: z
    .object({
      patterns: z.record(
        z.string(),
        z.record(
          z.string(),
          z.object({
            pattern: z.string(),
            group: z.number(),
            type: z.enum(['string', 'integer', 'boolean', 'array']),
            mapping: z.string().optional(),
            output_field: z.string().optional(),
            required: z.boolean().default(false),
            split: z.string().optional(), // For array types
          })
        )
      ),
      mappings: z.record(z.string(), z.record(z.string(), z.unknown())),
      templates: z.record(z.string(), z.record(z.string(), z.unknown())),
    })
    .optional(),

  list: z
    .object({
      default_format: z.enum(['simple', 'tree', 'detailed', 'markdown', 'json']).default('markdown'),
      include_frontmatter: z.boolean().default(true),
      include_dependencies: z.boolean().default(true),
      include_stats: z.boolean().default(true),
      group_by: z.enum(['layer', 'type', 'category', 'none']).default('layer'),
      sort_by: z.enum(['path', 'layer', 'title']).default('path'),
    })
    .nullable()
    .default({
      default_format: 'markdown',
      include_frontmatter: true,
      include_dependencies: true,
      include_stats: true,
      group_by: 'layer',
      sort_by: 'path',
    })
    .transform((val) => val ?? {
      default_format: 'markdown',
      include_frontmatter: true,
      include_dependencies: true,
      include_stats: true,
      group_by: 'layer',
      sort_by: 'path',
    }),

  layer_rules: z.record(z.string(), z.number()).optional(),

  output_paths: z.record(z.string(), z.string()).optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Build configuration
 */
export interface BuildConfig {
  output: string;
  exclude: string[];
  include: string[];
  stripFrontmatter: boolean;
  generateTOC: boolean;
  tocDepth: number;
  fileSeparator: string;
  sortBy: 'path' | 'custom';
}

/**
 * Build result
 */
export interface BuildResult {
  fileCount: number;
  totalSize: number;
  buildTime: number;
  outputPath: string;
  tokenCount?: number;
  stats: {
    files: string[];
    layers?: Record<string, number>;
  };
}

/**
 * Extraction result
 */
export interface ExtractionResult {
  success: boolean;
  inputPath: string;
  outputPath?: string;
  extractedFields: Record<string, unknown>;
  frontmatter: Record<string, unknown>;
  warnings: string[];
  errors: string[];
  stats: {
    fieldsExtracted: number;
    fieldsTotal: number;
    extractionRate: number;
    mappingsApplied: number;
  };
}

/**
 * Batch extraction result
 */
export interface BatchExtractionResult {
  totalFiles: number;
  successCount: number;
  failureCount: number;
  warningCount: number;
  results: ExtractionResult[];
  unmappedValues: Array<{
    field: string;
    value: string;
    count: number;
    suggestion?: string;
  }>;
  fieldStats: Record<
    string,
    {
      extracted: number;
      total: number;
      rate: number;
    }
  >;
}

/**
 * File information for list command
 */
export interface FileInfo {
  path: string;
  relativePath: string;
  title?: string;
  description?: string;
  layer?: number;
  type?: string;
  category?: string;
  depends_on?: string[];
  tags?: string[];
  size: number;
  modified?: Date;
}

/**
 * List result
 */
export interface ListResult {
  files: FileInfo[];
  stats: {
    totalFiles: number;
    layers?: Record<string, number>;
    types?: Record<string, number>;
    categories?: Record<string, number>;
  };
}
