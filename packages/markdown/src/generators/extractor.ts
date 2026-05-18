import * as fs from 'fs/promises';
import * as path from 'path';
import matter from '@11ty/gray-matter';
import YAML from 'yaml';
import { Config, ExtractionResult, BatchExtractionResult } from '../parsers/types/config.js';
import { isEnoent, safeRegExp } from '@shirokuma-library/lint';

/** Extraction pattern config derived from Config schema */
type ExtractionPatternConfig = NonNullable<Config['extraction']>['patterns'][string][string];

/**
 * Extractor class - Extracts information from markdown files and creates shirokuma-md compatible files
 */
export class Extractor {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Extract information from a single file
   */
  async extract(
    inputPath: string,
    documentType: string,
    outputPath?: string
  ): Promise<ExtractionResult> {
    const result: ExtractionResult = {
      success: false,
      inputPath,
      outputPath,
      extractedFields: {},
      frontmatter: {},
      warnings: [],
      errors: [],
      stats: {
        fieldsExtracted: 0,
        fieldsTotal: 0,
        extractionRate: 0,
        mappingsApplied: 0,
      },
    };

    try {
      // Read input file
      const content = await fs.readFile(inputPath, 'utf-8');

      // Get extraction configuration
      if (!this.config.extraction) {
        throw new Error('Extraction configuration not found in config');
      }

      const patterns = this.config.extraction.patterns[documentType];
      if (!patterns) {
        throw new Error(`No extraction patterns found for document type: ${documentType}`);
      }

      // Extract fields from content
      result.stats.fieldsTotal = Object.keys(patterns).length;

      for (const [fieldName, patternConfig] of Object.entries(patterns)) {
        try {
          const value = this.extractField(content, fieldName, patternConfig);

          if (value !== null) {
            // Apply mapping if specified
            const finalValue = patternConfig.mapping
              ? this.applyMapping(value, patternConfig.mapping, fieldName, result)
              : value;

            // Determine output field name
            const outputField = patternConfig.output_field || fieldName;
            result.extractedFields[outputField] = finalValue;
            result.stats.fieldsExtracted++;

            if (patternConfig.mapping) {
              result.stats.mappingsApplied++;
            }
          } else if (patternConfig.required) {
            result.errors.push(`Missing required field: ${fieldName}`);
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`Error extracting field ${fieldName}: ${message}`);
        }
      }

      // Calculate extraction rate
      result.stats.extractionRate =
        result.stats.fieldsTotal > 0
          ? (result.stats.fieldsExtracted / result.stats.fieldsTotal) * 100
          : 0;

      // Generate frontmatter
      if (result.errors.length === 0) {
        result.frontmatter = this.generateFrontmatter(documentType, result.extractedFields);

        // Validate extracted data
        this.validateExtractedData(documentType, result);

        if (result.errors.length === 0) {
          result.success = true;

          // Determine output path if not provided
          if (!outputPath) {
            outputPath = this.determineOutputPath(documentType, result.extractedFields);
          }
          result.outputPath = outputPath;
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Extraction failed: ${message}`);
    }

    return result;
  }

  /**
   * Extract a single field from content
   */
  private extractField(
    content: string,
    _fieldName: string,
    patternConfig: ExtractionPatternConfig
  ): string | number | boolean | string[] | null {
    const regex = safeRegExp(patternConfig.pattern, 'gm');
    if (!regex) {
      console.warn(`Invalid regex pattern: ${patternConfig.pattern} — skipping field`);
      return null;
    }
    const match = regex.exec(content);

    if (!match) {
      return null;
    }

    const matchedValue = match[patternConfig.group];
    if (!matchedValue) {
      return null;
    }

    const extracted = matchedValue.trim();

    // Type conversion
    switch (patternConfig.type) {
      case 'integer':
        return parseInt(extracted, 10);
      case 'boolean':
        return extracted.toLowerCase() === 'true' || extracted === '1';
      case 'array':
        return patternConfig.split
          ? extracted.split(patternConfig.split).map((s: string) => s.trim())
          : [extracted];
      case 'string':
      default:
        return extracted;
    }
  }

  /**
   * Apply mapping to a value
   */
  private applyMapping(
    value: string | number | boolean | string[],
    mappingName: string,
    fieldName: string,
    result: ExtractionResult
  ): unknown {
    if (!this.config.extraction?.mappings) {
      result.warnings.push(`Mapping ${mappingName} not found`);
      return value;
    }

    const mapping = this.config.extraction?.mappings?.[mappingName];
    if (!mapping) {
      result.warnings.push(`Mapping ${mappingName} not found`);
      return value;
    }

    const stringValue = String(value);

    // Try exact match first
    if (stringValue in mapping) {
      return mapping[stringValue];
    }

    // Try partial match (for values like "黒髪" matching "黒")
    for (const [key, mappedValue] of Object.entries(mapping)) {
      if (stringValue.includes(key)) {
        return mappedValue;
      }
    }

    // No mapping found
    result.warnings.push(
      `Unmapped value: ${fieldName} = "${stringValue}" (not found in ${mappingName})`
    );
    return value;
  }

  /**
   * Generate frontmatter from extracted fields
   */
  private generateFrontmatter(
    documentType: string,
    extractedFields: Record<string, unknown>
  ): Record<string, unknown> {
    const frontmatter: Record<string, unknown> = {};

    // Apply template defaults
    if (this.config.extraction?.templates?.[documentType]) {
      const template = this.config.extraction.templates[documentType];

      for (const [key, value] of Object.entries(template)) {
        if (key === 'depends_on' && Array.isArray(value)) {
          // Handle depends_on with variable substitution
          frontmatter[key] = (value as unknown[]).map((dep) =>
            typeof dep === 'string' ? this.substituteVariables(dep, extractedFields) : dep
          );
        } else {
          frontmatter[key] = value;
        }
      }
    }

    // Merge extracted fields (overrides template defaults)
    Object.assign(frontmatter, extractedFields);

    // Auto-determine layer if layer_rules exists
    if (this.config.layer_rules && documentType in this.config.layer_rules) {
      frontmatter.layer = this.config.layer_rules[documentType];
    }

    return frontmatter;
  }

  /**
   * Substitute variables in a string (e.g., ${profession} -> warrior)
   */
  private substituteVariables(template: string, fields: Record<string, unknown>): string {
    return template.replace(/\$\{(\w+)\}/g, (match, fieldName: string) => {
      const value = (fields)[fieldName];
      return typeof value === 'string' ? value : match;
    });
  }

  /**
   * Validate extracted data against rules
   */
  private validateExtractedData(_documentType: string, _result: ExtractionResult): void {
    // Check required fields from validation config
    const validationConfig = this.config.validation;
    if (!validationConfig) return;

    // Note: We're validating extracted fields, not full frontmatter yet
    // Full validation happens after writing
  }

  /**
   * Determine output path based on document type and extracted fields
   */
  private determineOutputPath(
    documentType: string,
    extractedFields: Record<string, unknown>
  ): string {
    if (!this.config.output_paths || !(documentType in this.config.output_paths)) {
      throw new Error(`Output path not configured for document type: ${documentType}`);
    }

    const outputDir = this.config.output_paths[documentType];
    if (!outputDir) {
      throw new Error(`Output path not defined for document type: ${documentType}`);
    }

    // Generate filename based on name field or type
    const nameRaw = extractedFields.name || extractedFields.type || 'unnamed';
    const name = typeof nameRaw === 'string' || typeof nameRaw === 'number' ? String(nameRaw) : 'unnamed';
    const filename = name.toLowerCase().replace(/\s+/g, '-') + '.md';

    return path.join(outputDir, filename);
  }

  /**
   * Write extracted content to output file
   */
  async writeExtractedFile(
    result: ExtractionResult,
    originalContent: string,
    overwrite: boolean = false
  ): Promise<void> {
    if (!result.success || !result.outputPath) {
      throw new Error('Cannot write file: extraction was not successful');
    }

    // Check if file exists
    try {
      await fs.access(result.outputPath);
      if (!overwrite) {
        throw new Error(`File already exists: ${result.outputPath}`);
      }
    } catch (error: unknown) {
      if (!isEnoent(error)) {
        throw error;
      }
    }

    // Ensure output directory exists
    const outputDir = path.dirname(result.outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    // Parse original content to preserve body
    const parsed = matter(originalContent);
    const body = parsed.content;

    // Generate final file content
    const frontmatterYaml = YAML.stringify(result.frontmatter);
    const finalContent = `---\n${frontmatterYaml}---\n\n${body}`;

    // Write to file
    await fs.writeFile(result.outputPath, finalContent, 'utf-8');
  }

  /**
   * Batch extract multiple files
   */
  async batchExtract(
    inputDir: string,
    documentType: string,
    outputDir?: string,
    options?: {
      pattern?: string;
      continueOnError?: boolean;
      overwrite?: boolean;
    }
  ): Promise<BatchExtractionResult> {
    const batchResult: BatchExtractionResult = {
      totalFiles: 0,
      successCount: 0,
      failureCount: 0,
      warningCount: 0,
      results: [],
      unmappedValues: [],
      fieldStats: {},
    };

    // Get all markdown files in input directory
    const files = await this.getMarkdownFiles(inputDir, options?.pattern);
    batchResult.totalFiles = files.length;

    // Process each file
    for (const file of files) {
      try {
        const inputPath = path.join(inputDir, file);
        const outputPath = outputDir
          ? path.join(outputDir, file)
          : undefined;

        const content = await fs.readFile(inputPath, 'utf-8');
        const result = await this.extract(inputPath, documentType, outputPath);

        // Write file if successful
        if (result.success && result.outputPath) {
          await this.writeExtractedFile(result, content, options?.overwrite);
          batchResult.successCount++;
        } else {
          batchResult.failureCount++;
          if (!options?.continueOnError) {
            throw new Error(`Extraction failed for ${file}: ${result.errors.join(', ')}`);
          }
        }

        if (result.warnings.length > 0) {
          batchResult.warningCount++;
        }

        batchResult.results.push(result);
      } catch (error: unknown) {
        batchResult.failureCount++;
        if (!options?.continueOnError) {
          throw error;
        }
      }
    }

    // Aggregate statistics
    this.aggregateStatistics(batchResult);

    return batchResult;
  }

  /**
   * Get all markdown files in a directory
   */
  private async getMarkdownFiles(dir: string, pattern?: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const patternRegex = pattern ? safeRegExp(pattern) : null;
        if (!pattern || (patternRegex && patternRegex.test(entry.name))) {
          files.push(entry.name);
        }
      }
    }

    return files;
  }

  /**
   * Aggregate statistics from batch results
   */
  private aggregateStatistics(batchResult: BatchExtractionResult): void {
    // Track unmapped values
    const unmappedMap = new Map<string, { count: number; field: string }>();

    for (const result of batchResult.results) {
      for (const warning of result.warnings) {
        if (warning.startsWith('Unmapped value:')) {
          const match = warning.match(/Unmapped value: (.+?) = "(.+?)"/);
          if (match && match[1] && match[2]) {
            const field = match[1];
            const value = match[2];
            const key = `${field}:${value}`;
            const existing = unmappedMap.get(key) || { count: 0, field };
            existing.count++;
            unmappedMap.set(key, existing);
          }
        }
      }

      // Track field extraction rates
      for (const [field] of Object.entries(result.extractedFields)) {
        if (!batchResult.fieldStats[field]) {
          batchResult.fieldStats[field] = { extracted: 0, total: 0, rate: 0 };
        }
        batchResult.fieldStats[field].extracted++;
        batchResult.fieldStats[field].total = batchResult.totalFiles;
      }
    }

    // Convert unmapped map to array
    batchResult.unmappedValues = Array.from(unmappedMap.entries())
      .map(([key, data]) => {
        const colonIdx = key.indexOf(':');
        const value = colonIdx >= 0 ? key.substring(colonIdx + 1) : undefined;
        if (!value) return null;
        return {
          field: data.field,
          value,
          count: data.count,
        };
      })
      .filter((item): item is { field: string; value: string; count: number } => item !== null);

    // Calculate field extraction rates
    for (const stats of Object.values(batchResult.fieldStats)) {
      stats.rate = (stats.extracted / stats.total) * 100;
    }
  }
}
