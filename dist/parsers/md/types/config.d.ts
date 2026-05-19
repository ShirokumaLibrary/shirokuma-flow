import { z } from 'zod';
/**
 * Configuration schema for shirokuma-md.config.yaml
 */
export declare const ConfigSchema: z.ZodObject<{
    project: z.ZodObject<{
        name: z.ZodString;
        version: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    directories: z.ZodObject<{
        source: z.ZodDefault<z.ZodString>;
        output: z.ZodDefault<z.ZodString>;
        config: z.ZodDefault<z.ZodString>;
        templates: z.ZodOptional<z.ZodString>;
        schemas: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    build: z.ZodObject<{
        default_output: z.ZodString;
        include: z.ZodArray<z.ZodString>;
        exclude: z.ZodArray<z.ZodString>;
        frontmatter: z.ZodObject<{
            strip: z.ZodDefault<z.ZodBoolean>;
            preserve_fields: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>;
        toc: z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            depth: z.ZodDefault<z.ZodNumber>;
            title: z.ZodDefault<z.ZodString>;
        }, z.core.$strip>;
        file_separator: z.ZodDefault<z.ZodString>;
        sort: z.ZodDefault<z.ZodEnum<{
            path: "path";
            custom: "custom";
        }>>;
        strip_section_meta: z.ZodDefault<z.ZodBoolean>;
        strip_heading_numbers: z.ZodDefault<z.ZodBoolean>;
        optimizations: z.ZodOptional<z.ZodObject<{
            remove_internal_links: z.ZodDefault<z.ZodBoolean>;
            normalize_whitespace: z.ZodDefault<z.ZodBoolean>;
            normalize_headings: z.ZodDefault<z.ZodBoolean>;
            heading_separator: z.ZodDefault<z.ZodString>;
            remove_comments: z.ZodDefault<z.ZodBoolean>;
            remove_badges: z.ZodDefault<z.ZodBoolean>;
            remove_duplicates: z.ZodDefault<z.ZodBoolean>;
            remove_blockquotes: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    sort_order: z.ZodOptional<z.ZodArray<z.ZodObject<{
        pattern: z.ZodString;
    }, z.core.$strip>>>;
    validation: z.ZodObject<{
        required_frontmatter: z.ZodDefault<z.ZodArray<z.ZodString>>;
        custom_types: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull, z.ZodArray<z.ZodString>]>>>;
        forbidden_patterns: z.ZodOptional<z.ZodArray<z.ZodObject<{
            pattern: z.ZodString;
            message: z.ZodString;
            apply_to: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        no_internal_links: z.ZodDefault<z.ZodBoolean>;
        template_compliance: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            check_required_sections: z.ZodDefault<z.ZodBoolean>;
            check_variable_substitution: z.ZodDefault<z.ZodBoolean>;
            severity: z.ZodDefault<z.ZodEnum<{
                info: "info";
                error: "error";
                warning: "warning";
            }>>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    lint: z.ZodObject<{
        builtin_rules: z.ZodRecord<z.ZodString, z.ZodBoolean>;
        file_naming: z.ZodOptional<z.ZodObject<{
            pattern: z.ZodString;
            message: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        rules: z.ZodOptional<z.ZodObject<{
            consistent_structure: z.ZodOptional<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                overview_location: z.ZodDefault<z.ZodEnum<{
                    inside: "inside";
                    outside: "outside";
                }>>;
                directory_threshold: z.ZodDefault<z.ZodNumber>;
                overview_naming: z.ZodDefault<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    analyze: z.ZodOptional<z.ZodObject<{
        dependency_detection: z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<{
                frontmatter: "frontmatter";
                "wiki-link": "wiki-link";
                "markdown-link": "markdown-link";
            }>;
            pattern: z.ZodOptional<z.ZodString>;
            enabled: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    plugins: z.ZodOptional<z.ZodArray<z.ZodObject<{
        module: z.ZodString;
        validators: z.ZodOptional<z.ZodArray<z.ZodString>>;
        enabled: z.ZodOptional<z.ZodBoolean>;
        config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>>;
    extraction: z.ZodOptional<z.ZodObject<{
        patterns: z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodObject<{
            pattern: z.ZodString;
            group: z.ZodNumber;
            type: z.ZodEnum<{
                string: "string";
                boolean: "boolean";
                integer: "integer";
                array: "array";
            }>;
            mapping: z.ZodOptional<z.ZodString>;
            output_field: z.ZodOptional<z.ZodString>;
            required: z.ZodDefault<z.ZodBoolean>;
            split: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        mappings: z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        templates: z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
    list: z.ZodPipe<z.ZodDefault<z.ZodNullable<z.ZodObject<{
        default_format: z.ZodDefault<z.ZodEnum<{
            json: "json";
            markdown: "markdown";
            tree: "tree";
            detailed: "detailed";
            simple: "simple";
        }>>;
        include_frontmatter: z.ZodDefault<z.ZodBoolean>;
        include_dependencies: z.ZodDefault<z.ZodBoolean>;
        include_stats: z.ZodDefault<z.ZodBoolean>;
        group_by: z.ZodDefault<z.ZodEnum<{
            type: "type";
            category: "category";
            none: "none";
            layer: "layer";
        }>>;
        sort_by: z.ZodDefault<z.ZodEnum<{
            path: "path";
            title: "title";
            layer: "layer";
        }>>;
    }, z.core.$strip>>>, z.ZodTransform<{
        default_format: string;
        include_frontmatter: boolean;
        include_dependencies: boolean;
        include_stats: boolean;
        group_by: string;
        sort_by: string;
    }, {
        default_format: "json" | "markdown" | "tree" | "detailed" | "simple";
        include_frontmatter: boolean;
        include_dependencies: boolean;
        include_stats: boolean;
        group_by: "type" | "category" | "none" | "layer";
        sort_by: "path" | "title" | "layer";
    } | null>>;
    layer_rules: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    output_paths: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
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
    fieldStats: Record<string, {
        extracted: number;
        total: number;
        rate: number;
    }>;
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
//# sourceMappingURL=config.d.ts.map