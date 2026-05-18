import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverProjectRoot, resolveAutoConfigPath } from '../src/project-root.js';

describe('discoverProjectRoot (Issue #49)', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'lint-project-root-'));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('finds .shirokuma/ in the same directory as project path', () => {
    mkdirSync(join(tmp, '.shirokuma'));
    const root = discoverProjectRoot(tmp);
    expect(root).toBe(tmp);
  });

  it('walks up multiple parent directories to find .shirokuma/', () => {
    mkdirSync(join(tmp, '.shirokuma'));
    mkdirSync(join(tmp, 'packages/flow'), { recursive: true });
    const root = discoverProjectRoot(join(tmp, 'packages/flow'));
    expect(root).toBe(tmp);
  });

  it('returns null when no .shirokuma/ is found within stopAt bound', () => {
    // tmp has no .shirokuma subdirectory; stopAt bounds the walk so ambient
    // /tmp/.shirokuma or any ancestor doesn't leak into the test.
    const root = discoverProjectRoot(tmp, tmp);
    expect(root).toBe(null);
  });

  it('stops at the project path itself even if deeper scan would succeed', () => {
    // .shirokuma only in subdir — should NOT match since walk goes up, not down
    mkdirSync(join(tmp, 'inner/.shirokuma'), { recursive: true });
    const root = discoverProjectRoot(tmp, tmp);
    expect(root).toBe(null);
  });
});

describe('resolveAutoConfigPath (Issue #49)', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'lint-auto-config-'));
    mkdirSync(join(tmp, '.shirokuma/lint'), { recursive: true });
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns .shirokuma/lint/<rule>.yaml when present', () => {
    writeFileSync(join(tmp, '.shirokuma/lint/structure.yaml'), 'dirRequired: []\n');
    const path = resolveAutoConfigPath(tmp, 'structure');
    expect(path).toBe(join(tmp, '.shirokuma/lint/structure.yaml'));
  });

  it('returns .shirokuma/lint/<rule>.yml when only .yml exists', () => {
    writeFileSync(join(tmp, '.shirokuma/lint/structure.yml'), 'dirRequired: []\n');
    const path = resolveAutoConfigPath(tmp, 'structure');
    expect(path).toBe(join(tmp, '.shirokuma/lint/structure.yml'));
  });

  it('prefers .yaml over .yml when both present', () => {
    writeFileSync(join(tmp, '.shirokuma/lint/structure.yaml'), 'dirRequired: []\n');
    writeFileSync(join(tmp, '.shirokuma/lint/structure.yml'), 'dirRequired: []\n');
    const path = resolveAutoConfigPath(tmp, 'structure');
    expect(path).toBe(join(tmp, '.shirokuma/lint/structure.yaml'));
  });

  it('returns null when rule config file does not exist', () => {
    const path = resolveAutoConfigPath(tmp, 'docs');
    expect(path).toBe(null);
  });

  it('returns null when projectRoot is null (no .shirokuma/ found upstream)', () => {
    const path = resolveAutoConfigPath(null, 'structure');
    expect(path).toBe(null);
  });
});
