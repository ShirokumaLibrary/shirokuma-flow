import { relative, resolve } from 'node:path';
import { globSync } from 'glob';
import { checkArtifactCrossRef } from './artifact-cross-ref.js';
import { checkCompactTables } from './compact-table.js';
import { readFile } from './file.js';
import {
  checkDocumentLength,
  checkFileExists,
  checkFrontmatter,
  checkInternalLinks,
  checkSections,
  mergeResults,
} from './markdown-structure.js';
import type {
  ArtifactCrossRefConfig,
  CompactTableConfig,
  DocValidationResult,
  FilePatternValidationConfig,
  FileValidationConfig,
  FileValidationReport,
  LintDocsConfig,
  LintDocsReport,
  PatternValidationReport,
} from './docs-types.js';
import { isFileConfig, isPatternConfig } from './docs-types.js';

export interface LintDocsParams {
  projectPath: string;
  config: LintDocsConfig;
}

export function lintDocs(params: LintDocsParams): LintDocsReport {
  const projectPath = resolve(params.projectPath);
  const { config } = params;

  const fileResults: FileValidationReport[] = [];
  const patternResults: PatternValidationReport[] = [];

  for (const reqConfig of config.required) {
    if (isFileConfig(reqConfig)) {
      fileResults.push(validateSingleFile(projectPath, reqConfig, config));
    } else if (isPatternConfig(reqConfig)) {
      patternResults.push(validateFilePattern(projectPath, reqConfig, config));
    }
  }

  const compactTableResults = config.compactTable?.enabled
    ? validateCompactTables(projectPath, config.compactTable)
    : undefined;

  const artifactCrossRefResults = config.artifactCrossRef?.enabled
    ? validateArtifactCrossRef(projectPath, config.artifactCrossRef)
    : undefined;

  let errorCount = 0;
  let warningCount = 0;
  let infoCount = 0;
  let totalFiles = 0;
  for (const fr of fileResults) {
    errorCount += fr.result.errors.length;
    warningCount += fr.result.warnings.length;
    infoCount += fr.result.infos.length;
    totalFiles += 1;
  }
  for (const pr of patternResults) {
    errorCount += pr.result.errors.length;
    warningCount += pr.result.warnings.length;
    infoCount += pr.result.infos.length;
    totalFiles += pr.matchedFiles.length;
  }
  if (compactTableResults) {
    for (const fr of compactTableResults) {
      errorCount += fr.result.errors.length;
      warningCount += fr.result.warnings.length;
      infoCount += fr.result.infos.length;
      totalFiles += 1;
    }
  }
  if (artifactCrossRefResults) {
    for (const fr of artifactCrossRefResults) {
      errorCount += fr.result.errors.length;
      warningCount += fr.result.warnings.length;
      infoCount += fr.result.infos.length;
      totalFiles += 1;
    }
  }

  return {
    fileResults,
    patternResults,
    ...(compactTableResults ? { compactTableResults } : {}),
    ...(artifactCrossRefResults ? { artifactCrossRefResults } : {}),
    summary: {
      totalFiles,
      validatedFiles: totalFiles,
      errorCount,
      warningCount,
      infoCount,
    },
    passed: errorCount === 0,
  };
}

function validateArtifactCrossRef(
  projectPath: string,
  config: ArtifactCrossRefConfig,
): FileValidationReport[] {
  const include =
    config.include && config.include.length > 0
      ? config.include
      : [
          '.claude/skills/**/*.md',
          '.claude/agents/*.md',
          '.claude/rules/**/*.md',
          '.shirokuma/rules/flow/**/*.md',
        ];
  const matched = globSync(include, {
    cwd: projectPath,
    nodir: true,
    absolute: true,
    ignore: config.exclude ?? [],
  });
  const reports: FileValidationReport[] = [];
  for (const filePath of matched) {
    const content = readFile(filePath);
    if (content === null) continue;
    const relPath = relative(projectPath, filePath);
    reports.push({
      file: relPath,
      description: 'artifact-cross-ref',
      result: checkArtifactCrossRef(content, relPath, {
        indexTypeRules: config.indexTypeRules,
        forbiddenPathPatterns: config.forbiddenPathPatterns,
      }),
    });
  }
  return reports;
}

function validateCompactTables(
  projectPath: string,
  config: CompactTableConfig,
): FileValidationReport[] {
  const include = config.include && config.include.length > 0 ? config.include : ['**/*.md'];
  const matched = globSync(include, {
    cwd: projectPath,
    nodir: true,
    absolute: true,
    ignore: config.exclude ?? [],
  });
  const reports: FileValidationReport[] = [];
  for (const filePath of matched) {
    const content = readFile(filePath);
    if (content === null) continue;
    const relPath = relative(projectPath, filePath);
    reports.push({
      file: relPath,
      description: 'compact-table',
      result: checkCompactTables(content, relPath),
    });
  }
  return reports;
}

function validateSingleFile(
  projectPath: string,
  fileConfig: FileValidationConfig,
  lintConfig: LintDocsConfig,
): FileValidationReport {
  const filePath = resolve(projectPath, fileConfig.file);
  const results: DocValidationResult[] = [];

  const content = readFile(filePath);
  if (content === null) {
    results.push(checkFileExists(filePath));
    return {
      file: fileConfig.file,
      description: fileConfig.description,
      result: mergeResults(...results),
    };
  }

  if (fileConfig.sections && fileConfig.sections.length > 0) {
    results.push(checkSections(content, fileConfig.sections, filePath));
  }

  if (fileConfig.minLength !== undefined || fileConfig.maxLength !== undefined) {
    results.push(
      checkDocumentLength(
        content,
        { minLength: fileConfig.minLength, maxLength: fileConfig.maxLength },
        filePath,
      ),
    );
  }

  if (fileConfig.frontmatter) {
    results.push(checkFrontmatter(content, fileConfig.frontmatter, filePath));
  }

  if (lintConfig.validateLinks?.enabled && lintConfig.validateLinks.checkInternal) {
    results.push(checkInternalLinks(content, projectPath, filePath));
  }

  return {
    file: fileConfig.file,
    description: fileConfig.description,
    result: mergeResults(...results),
  };
}

function validateFilePattern(
  projectPath: string,
  patternConfig: FilePatternValidationConfig,
  lintConfig: LintDocsConfig,
): PatternValidationReport {
  const fullPattern = resolve(projectPath, patternConfig.filePattern);
  const matchedFiles = globSync(fullPattern, { nodir: true });

  const results: DocValidationResult[] = [];
  const fileReports: FileValidationReport[] = [];

  if (patternConfig.minCount !== undefined && matchedFiles.length < patternConfig.minCount) {
    results.push({
      valid: false,
      errors: [
        {
          type: 'error',
          message: `${patternConfig.description}: Found ${matchedFiles.length} files, minimum required: ${patternConfig.minCount}`,
          file: patternConfig.filePattern,
          rule: 'min-file-count',
        },
      ],
      warnings: [],
      infos: [],
    });
  }

  for (const filePath of matchedFiles) {
    const perFile: DocValidationResult[] = [];
    const content = readFile(filePath);
    if (content === null) {
      perFile.push({
        valid: false,
        errors: [
          {
            type: 'error',
            message: 'Failed to read file content',
            file: filePath,
            rule: 'file-read',
          },
        ],
        warnings: [],
        infos: [],
      });
    } else {
      if (patternConfig.sections && patternConfig.sections.length > 0) {
        perFile.push(checkSections(content, patternConfig.sections, filePath));
      }
      if (patternConfig.frontmatter) {
        perFile.push(checkFrontmatter(content, patternConfig.frontmatter, filePath));
      }
      if (lintConfig.validateLinks?.enabled && lintConfig.validateLinks.checkInternal) {
        perFile.push(checkInternalLinks(content, projectPath, filePath));
      }
    }

    const merged = mergeResults(...perFile);
    results.push(merged);
    fileReports.push({
      file: filePath,
      description: patternConfig.description,
      result: merged,
    });
  }

  return {
    pattern: patternConfig.filePattern,
    description: patternConfig.description,
    matchedFiles,
    fileResults: fileReports,
    result: mergeResults(...results),
  };
}
