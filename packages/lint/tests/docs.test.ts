import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeFile } from '../src/file.js';
import { lintDocs } from '../src/docs.js';
import { checkInternalLinks, checkSections, mergeResults } from '../src/markdown-structure.js';

describe('markdown-structure primitives', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'lint-docs-prim-'));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('checkSections flags missing required and warns on missing optional', () => {
    const md = '# Overview\ntext';
    const result = checkSections(
      md,
      [
        { pattern: '^# Overview$', description: 'Overview', required: true },
        { pattern: '^## Context$', description: 'Context', required: true },
        { pattern: '^## Nice$', description: 'Nice-to-have', required: false },
      ],
      'doc.md',
    );
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.rule)).toContain('section-required');
    expect(result.warnings.map((w) => w.rule)).toContain('section-optional');
  });

  it('checkInternalLinks reports broken relative link with line number', () => {
    writeFile(join(tmp, 'doc.md'), 'see [x](./missing.md)');
    const md = 'see [x](./missing.md)';
    const result = checkInternalLinks(md, tmp, join(tmp, 'doc.md'));
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.rule).toBe('internal-link');
    expect(result.errors[0]?.line).toBe(1);
  });

  it('mergeResults aggregates validity and issues', () => {
    const a = { valid: true, errors: [], warnings: [], infos: [] };
    const b = {
      valid: false,
      errors: [{ type: 'error' as const, message: 'x', file: 'f', rule: 'r' }],
      warnings: [],
      infos: [],
    };
    const merged = mergeResults(a, b);
    expect(merged.valid).toBe(false);
    expect(merged.errors).toHaveLength(1);
  });
});

describe('lintDocs', () => {
  let project: string;
  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), 'lint-docs-'));
  });
  afterEach(() => {
    rmSync(project, { recursive: true, force: true });
  });

  it('reports missing required file', () => {
    const report = lintDocs({
      projectPath: project,
      config: {
        required: [{ file: 'README.md', description: 'Project readme' }],
      },
    });
    expect(report.passed).toBe(false);
    expect(report.summary.errorCount).toBe(1);
    expect(report.fileResults[0]?.result.errors[0]?.rule).toBe('file-exists');
  });

  it('passes when all required files exist and structure matches', () => {
    writeFile(join(project, 'README.md'), '# Title\n## Overview\nbody');
    const report = lintDocs({
      projectPath: project,
      config: {
        required: [
          {
            file: 'README.md',
            description: 'Project readme',
            sections: [
              { pattern: '^# Title$', description: 'Title', required: true },
              { pattern: '^## Overview$', description: 'Overview', required: true },
            ],
            minLength: 2,
          },
        ],
      },
    });
    expect(report.passed).toBe(true);
    expect(report.summary.errorCount).toBe(0);
  });

  it('supports filePattern validation with minCount', () => {
    writeFile(join(project, 'docs/adr/0001-a.md'), '# ADR');
    writeFile(join(project, 'docs/adr/0002-b.md'), '# ADR');
    const report = lintDocs({
      projectPath: project,
      config: {
        required: [
          {
            filePattern: 'docs/adr/*.md',
            description: 'ADRs',
            minCount: 3,
          },
        ],
      },
    });
    expect(report.passed).toBe(false);
    const pr = report.patternResults[0];
    expect(pr?.matchedFiles.length).toBe(2);
    expect(pr?.result.errors[0]?.rule).toBe('min-file-count');
  });

  it('validates internal links when enabled', () => {
    writeFile(join(project, 'README.md'), 'see [broken](./missing.md)');
    const report = lintDocs({
      projectPath: project,
      config: {
        required: [{ file: 'README.md', description: 'readme' }],
        validateLinks: { enabled: true, checkInternal: true },
      },
    });
    expect(report.passed).toBe(false);
    expect(report.summary.errorCount).toBe(1);
    expect(report.fileResults[0]?.result.errors[0]?.rule).toBe('internal-link');
  });

  it('compactTable rule flags over-padded table rows', () => {
    writeFile(join(project, 'README.md'), '| a  | b |\n| --- | --- |\n| x | y |\n');
    const report = lintDocs({
      projectPath: project,
      config: {
        required: [],
        compactTable: { enabled: true, include: ['**/*.md'] },
      },
    });
    expect(report.passed).toBe(false);
    expect(report.compactTableResults?.length).toBe(1);
    expect(report.compactTableResults?.[0]?.result.errors[0]?.rule).toBe('compact-table');
  });

  it('compactTable rule skips when disabled', () => {
    writeFile(join(project, 'README.md'), '| a  | b |\n| --- | --- |\n');
    const report = lintDocs({
      projectPath: project,
      config: { required: [] },
    });
    expect(report.compactTableResults).toBeUndefined();
  });

  it('compactTable rule respects exclude globs', () => {
    writeFile(join(project, 'README.md'), '| a  | b |\n| --- | --- |\n');
    writeFile(join(project, 'dist/bundle.md'), '| a  | b |\n| --- | --- |\n');
    const report = lintDocs({
      projectPath: project,
      config: {
        required: [],
        compactTable: { enabled: true, include: ['**/*.md'], exclude: ['dist/**'] },
      },
    });
    const scanned = report.compactTableResults?.map((r) => r.file).sort();
    expect(scanned).toEqual(['README.md']);
  });

  it('frontmatter rule enforces required field', () => {
    writeFile(join(project, 'doc.md'), '---\ntitle: Hi\n---\nbody');
    const report = lintDocs({
      projectPath: project,
      config: {
        required: [
          {
            file: 'doc.md',
            description: 'doc',
            frontmatter: {
              required: true,
              fields: [{ name: 'status' }],
            },
          },
        ],
      },
    });
    expect(report.passed).toBe(false);
    const err = report.fileResults[0]?.result.errors[0];
    expect(err?.rule).toBe('frontmatter-field');
    expect(err?.message).toContain('status');
  });
});
