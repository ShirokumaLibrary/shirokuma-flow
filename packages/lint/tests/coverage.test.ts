import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeFile } from '../src/file.js';
import { extractSkipTest, lintCoverage } from '../src/coverage.js';
import type { ConventionMapping } from '../src/coverage-types.js';

const PNPM_CONVENTIONS: ConventionMapping[] = [
  { source: 'src/**/*.ts', test: 'tests/**/*.test.ts' },
];

describe('extractSkipTest', () => {
  it('extracts reason only', () => {
    const content = '/** @skip-test pure type util */';
    expect(extractSkipTest(content)).toEqual({ reason: 'pure type util' });
  });

  it('extracts reason and @see reference', () => {
    const content = [
      '/**',
      ' * @skip-test delegated to contract test',
      ' * @see packages/foo/tests/contract.test.ts',
      ' */',
    ].join('\n');
    expect(extractSkipTest(content)).toEqual({
      reason: 'delegated to contract test',
      seeReference: 'packages/foo/tests/contract.test.ts',
    });
  });

  it('returns undefined when no annotation', () => {
    expect(extractSkipTest('export const x = 1;')).toBeUndefined();
  });
});

describe('lintCoverage', () => {
  let project: string;
  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), 'lint-coverage-'));
  });
  afterEach(() => {
    rmSync(project, { recursive: true, force: true });
  });

  it('reports covered / missing status based on convention mapping', () => {
    writeFile(join(project, 'src/a.ts'), 'export const a = 1;');
    writeFile(join(project, 'src/b.ts'), 'export const b = 2;');
    writeFile(join(project, 'tests/a.test.ts'), 'it("a", () => {});');

    const report = lintCoverage({
      projectPath: project,
      config: { conventions: PNPM_CONVENTIONS },
    });

    const statuses = report.results.map((r) => ({ source: r.source, status: r.status }));
    expect(statuses).toEqual([
      { source: 'src/a.ts', status: 'covered' },
      { source: 'src/b.ts', status: 'missing' },
    ]);
    expect(report.summary.coveredCount).toBe(1);
    expect(report.summary.missingCount).toBe(1);
    expect(report.passed).toBe(false);
  });

  it('counts tests in matched test file', () => {
    writeFile(join(project, 'src/a.ts'), 'export const a = 1;');
    writeFile(
      join(project, 'tests/a.test.ts'),
      'it("a", () => {}); test("b", () => {}); it("c", () => {});',
    );

    const report = lintCoverage({
      projectPath: project,
      config: { conventions: PNPM_CONVENTIONS },
    });
    expect(report.results[0]?.testCount).toBe(3);
  });

  it('marks @skip-test files as skipped', () => {
    writeFile(join(project, 'src/a.ts'), '/** @skip-test pure re-export */\nexport * from "./b";');
    const report = lintCoverage({
      projectPath: project,
      config: { conventions: PNPM_CONVENTIONS },
    });
    expect(report.results[0]).toMatchObject({
      source: 'src/a.ts',
      status: 'skipped',
      skipReason: 'pure re-export',
    });
    expect(report.summary.skippedCount).toBe(1);
    expect(report.passed).toBe(true);
  });

  it('honors exclude patterns', () => {
    writeFile(join(project, 'src/a.ts'), 'export const a = 1;');
    writeFile(join(project, 'src/index.ts'), 'export * from "./a";');
    writeFile(join(project, 'tests/a.test.ts'), 'it("a", () => {});');

    const report = lintCoverage({
      projectPath: project,
      config: {
        conventions: PNPM_CONVENTIONS,
        exclude: ['**/index.ts'],
      },
    });
    expect(report.results.map((r) => r.source)).toEqual(['src/a.ts']);
  });

  it('detects orphan test files with no matching source and guesses expectedSource', () => {
    writeFile(join(project, 'src/a.ts'), 'export const a = 1;');
    writeFile(join(project, 'tests/a.test.ts'), 'it("a", () => {});');
    writeFile(join(project, 'tests/phantom.test.ts'), 'it("nobody", () => {});');

    const report = lintCoverage({
      projectPath: project,
      config: { conventions: PNPM_CONVENTIONS },
    });
    expect(report.orphans).toEqual([
      { test: 'tests/phantom.test.ts', expectedSource: 'src/phantom.ts' },
    ]);
    expect(report.summary.orphanCount).toBe(1);
  });

  it('propagates @skip-test @see to FileCoverageResult.seeReference', () => {
    writeFile(
      join(project, 'src/a.ts'),
      '/**\n * @skip-test type-only util\n * @see tests/contract.test.ts\n */\nexport type X = 1;',
    );
    const report = lintCoverage({
      projectPath: project,
      config: { conventions: PNPM_CONVENTIONS },
    });
    expect(report.results[0]).toMatchObject({
      source: 'src/a.ts',
      status: 'skipped',
      skipReason: 'type-only util',
      seeReference: 'tests/contract.test.ts',
    });
  });

  it('computes coveragePercent as (covered+skipped)/total*100', () => {
    writeFile(join(project, 'src/a.ts'), 'export const a = 1;');
    writeFile(join(project, 'src/b.ts'), '/** @skip-test reason */ export const b = 2;');
    writeFile(join(project, 'src/c.ts'), 'export const c = 3;');
    writeFile(join(project, 'tests/a.test.ts'), 'it("a", () => {});');

    const report = lintCoverage({
      projectPath: project,
      config: { conventions: PNPM_CONVENTIONS },
    });
    expect(report.summary.totalSources).toBe(3);
    expect(report.summary.coveragePercent).toBe(67);
  });

  it('passes=true when no missing (even with orphans)', () => {
    writeFile(join(project, 'src/a.ts'), 'export const a = 1;');
    writeFile(join(project, 'tests/a.test.ts'), 'it("a", () => {});');
    writeFile(join(project, 'tests/orphan.test.ts'), 'it("x", () => {});');

    const report = lintCoverage({
      projectPath: project,
      config: { conventions: PNPM_CONVENTIONS },
    });
    expect(report.passed).toBe(true);
    expect(report.orphans).toHaveLength(1);
  });

  it('uses default convention/excludes when config omitted', () => {
    writeFile(join(project, 'src/a.ts'), 'export const a = 1;');
    writeFile(join(project, 'tests/a.test.ts'), 'it("a", () => {});');

    const report = lintCoverage({ projectPath: project });
    expect(report.passed).toBe(true);
    expect(report.summary.totalSources).toBe(1);
  });

  it('empty project returns 100% coverage', () => {
    const report = lintCoverage({
      projectPath: project,
      config: { conventions: PNPM_CONVENTIONS },
    });
    expect(report.summary.coveragePercent).toBe(100);
    expect(report.passed).toBe(true);
  });

  it('does not double-credit a single test file to multiple sources with the same basename', () => {
    writeFile(join(project, 'src/a/util.ts'), 'export const a = 1;');
    writeFile(join(project, 'src/b/util.ts'), 'export const b = 2;');
    writeFile(join(project, 'tests/util.test.ts'), 'it("a", () => {});');

    const report = lintCoverage({
      projectPath: project,
      config: { conventions: PNPM_CONVENTIONS },
    });
    const statuses = report.results.map((r) => ({ source: r.source, status: r.status }));
    expect(statuses).toContainEqual({ source: 'src/a/util.ts', status: 'covered' });
    expect(statuses).toContainEqual({ source: 'src/b/util.ts', status: 'missing' });
    expect(report.summary.coveredCount).toBe(1);
    expect(report.summary.missingCount).toBe(1);
  });
});
