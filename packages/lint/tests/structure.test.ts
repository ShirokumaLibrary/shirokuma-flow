import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeFile } from '../src/file.js';
import { lintStructure } from '../src/structure.js';

describe('lintStructure', () => {
  let project: string;
  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), 'lint-struct-'));
  });
  afterEach(() => {
    rmSync(project, { recursive: true, force: true });
  });

  it('passes when all required dirs/files exist', () => {
    writeFile(join(project, 'src/a.ts'), '');
    writeFile(join(project, 'package.json'), '{}');
    const report = lintStructure({
      projectPath: project,
      config: { dirRequired: ['src'], fileRequired: ['package.json'] },
    });
    expect(report.passed).toBe(true);
    expect(report.summary.errorCount).toBe(0);
    expect(report.summary.passCount).toBe(2);
  });

  it('reports missing required directory as error', () => {
    const report = lintStructure({
      projectPath: project,
      config: { dirRequired: ['src', 'tests'] },
    });
    expect(report.passed).toBe(false);
    expect(report.summary.errorCount).toBe(2);
    expect(report.checks[0]).toMatchObject({
      rule: 'dir-required',
      status: 'error',
      target: 'src',
    });
  });

  it('reports missing required file as error', () => {
    const report = lintStructure({
      projectPath: project,
      config: { fileRequired: ['README.md'] },
    });
    expect(report.passed).toBe(false);
    expect(report.checks[0]).toMatchObject({
      rule: 'file-required',
      status: 'error',
      target: 'README.md',
    });
  });

  it('reports missing recommended directory as warning (not error)', () => {
    const report = lintStructure({
      projectPath: project,
      config: { dirRecommended: ['docs'] },
    });
    expect(report.passed).toBe(true);
    expect(report.summary.errorCount).toBe(0);
    expect(report.summary.warningCount).toBe(1);
    expect(report.checks[0]).toMatchObject({
      rule: 'dir-recommended',
      status: 'warning',
      target: 'docs',
    });
  });

  it('passes on empty config', () => {
    const report = lintStructure({ projectPath: project, config: {} });
    expect(report.passed).toBe(true);
    expect(report.summary.totalChecks).toBe(0);
  });

  it('distinguishes file vs directory (file at dirRequired path is not a dir)', () => {
    writeFile(join(project, 'src'), 'not-a-dir');
    const report = lintStructure({
      projectPath: project,
      config: { dirRequired: ['src'] },
    });
    expect(report.passed).toBe(false);
    expect(report.checks[0]?.status).toBe('error');
  });

  it('rejects absolute paths and .. traversal with an error', () => {
    const report = lintStructure({
      projectPath: project,
      config: { dirRequired: ['/etc', '../outside'], fileRequired: ['/etc/passwd'] },
    });
    expect(report.passed).toBe(false);
    expect(report.summary.errorCount).toBe(3);
    for (const c of report.checks) {
      expect(c.status).toBe('error');
      expect(c.message).toMatch(/escapes project root/);
    }
  });

  it('aggregates errors, warnings, and passes in summary', () => {
    writeFile(join(project, 'src/a.ts'), '');
    const report = lintStructure({
      projectPath: project,
      config: {
        dirRequired: ['src', 'tests'],
        fileRequired: ['README.md'],
        dirRecommended: ['docs'],
      },
    });
    expect(report.summary).toEqual({
      totalChecks: 4,
      errorCount: 2,
      warningCount: 1,
      passCount: 1,
    });
  });
});
