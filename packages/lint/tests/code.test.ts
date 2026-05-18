import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeFile } from '../src/file.js';
import { lintCode } from '../src/code.js';

describe('lintCode', () => {
  let project: string;
  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), 'lint-code-'));
  });
  afterEach(() => {
    rmSync(project, { recursive: true, force: true });
  });

  it('passes when no rules are configured', () => {
    const report = lintCode({ projectPath: project, config: { rules: [] } });
    expect(report.passed).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.summary.rulesRun).toBe(0);
    expect(report.summary.filesChecked).toBe(0);
  });

  it('reports missing module tag on file-level JSDoc', () => {
    writeFile(join(project, 'src/a.ts'), `/**\n * @feature users\n */\nexport const a = 1;\n`);
    const report = lintCode({
      projectPath: project,
      config: { rules: [{ filePattern: 'src/**/*.ts', moduleTags: ['@feature', '@owner'] }] },
    });
    expect(report.passed).toBe(false);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toMatchObject({
      rule: 'module-tag-required',
      status: 'error',
      file: 'src/a.ts',
      tag: '@owner',
    });
  });

  it('treats a file without any JSDoc header as missing every required module tag', () => {
    writeFile(join(project, 'src/a.ts'), `export const a = 1;\n`);
    const report = lintCode({
      projectPath: project,
      config: { rules: [{ filePattern: 'src/**/*.ts', moduleTags: ['@feature'] }] },
    });
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toMatchObject({ rule: 'module-tag-required', tag: '@feature' });
  });

  it('reports export function with no JSDoc', () => {
    writeFile(join(project, 'src/a.ts'), `export function foo() {}\n`);
    const report = lintCode({
      projectPath: project,
      config: { rules: [{ filePattern: 'src/**/*.ts', functionTags: ['@returns'] }] },
    });
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toMatchObject({
      rule: 'function-jsdoc-required',
      functionName: 'foo',
      file: 'src/a.ts',
    });
    expect(report.issues[0]?.line).toBeGreaterThan(0);
  });

  it('reports missing function tag when JSDoc is present but incomplete', () => {
    writeFile(
      join(project, 'src/a.ts'),
      `/**\n * do thing\n * @returns void\n */\nexport async function bar() {}\n`,
    );
    const report = lintCode({
      projectPath: project,
      config: {
        rules: [{ filePattern: 'src/**/*.ts', functionTags: ['@returns', '@throws'] }],
      },
    });
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toMatchObject({
      rule: 'function-tag-required',
      functionName: 'bar',
      tag: '@throws',
    });
  });

  it('passes when every exported function has every required tag', () => {
    writeFile(
      join(project, 'src/a.ts'),
      `/**\n * @returns void\n * @throws never\n */\nexport function bar() {}\n`,
    );
    const report = lintCode({
      projectPath: project,
      config: {
        rules: [{ filePattern: 'src/**/*.ts', functionTags: ['@returns', '@throws'] }],
      },
    });
    expect(report.passed).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.summary.filesChecked).toBe(1);
  });

  it('honors excludePatterns', () => {
    writeFile(join(project, 'src/a.ts'), `export function foo() {}\n`);
    writeFile(join(project, 'src/a.test.ts'), `export function bar() {}\n`);
    const report = lintCode({
      projectPath: project,
      config: {
        rules: [
          {
            filePattern: 'src/**/*.ts',
            excludePatterns: ['src/**/*.test.ts'],
            functionTags: ['@returns'],
          },
        ],
      },
    });
    expect(report.summary.filesChecked).toBe(1);
    expect(report.issues.every((i) => i.file === 'src/a.ts')).toBe(true);
  });

  it('does not match files outside the project root via ../ glob', () => {
    const outside = mkdtempSync(join(tmpdir(), 'lint-code-outside-'));
    try {
      writeFile(join(outside, 'leaked.ts'), `export function foo() {}\n`);
      const report = lintCode({
        projectPath: project,
        config: {
          rules: [{ filePattern: '../lint-code-outside-**/*.ts', functionTags: ['@returns'] }],
        },
      });
      expect(report.issues.some((i) => i.file.includes('leaked.ts'))).toBe(false);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it('counts each file once across multiple rules', () => {
    writeFile(
      join(project, 'src/a.ts'),
      `/**\n * @feature x\n */\n\nconst helper = 1;\nvoid helper;\n\nexport function foo() {}\n`,
    );
    const report = lintCode({
      projectPath: project,
      config: {
        rules: [
          { filePattern: 'src/**/*.ts', moduleTags: ['@feature'] },
          { filePattern: 'src/**/*.ts', functionTags: ['@returns'] },
        ],
      },
    });
    expect(report.summary.filesChecked).toBe(1);
    expect(report.summary.rulesRun).toBe(2);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]?.rule).toBe('function-jsdoc-required');
  });

  it('detects module tag when imports precede the JSDoc header', () => {
    writeFile(
      join(project, 'src/a.ts'),
      `import { x } from './x.js';\nimport { y } from './y.js';\n\n/**\n * @module foo\n */\nexport const a = 1;\n`,
    );
    const report = lintCode({
      projectPath: project,
      config: { rules: [{ filePattern: 'src/**/*.ts', moduleTags: ['@module'] }] },
    });
    expect(report.passed).toBe(true);
    expect(report.issues).toEqual([]);
  });

  it('reports function line at the declaration keyword, not the JSDoc start', () => {
    writeFile(
      join(project, 'src/a.ts'),
      `import { x } from './x.js';\n\n/**\n * doc line 1\n * doc line 2\n * @returns void\n */\nexport function bar() {}\n`,
    );
    const report = lintCode({
      projectPath: project,
      config: {
        rules: [{ filePattern: 'src/**/*.ts', functionTags: ['@returns', '@throws'] }],
      },
    });
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toMatchObject({
      rule: 'function-tag-required',
      functionName: 'bar',
      tag: '@throws',
      line: 8,
    });
  });
});
