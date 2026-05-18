import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  dirExists,
  ensureDir,
  fileExists,
  getFileMtime,
  listFiles,
  readFile,
  writeFile,
} from '../src/file.js';

describe('file utilities', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'lint-file-'));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('writeFile creates parent dirs and reads back via readFile', () => {
    const p = join(tmp, 'nested/deep/file.txt');
    writeFile(p, 'hello');
    expect(readFile(p)).toBe('hello');
  });

  it('readFile returns null for missing files', () => {
    expect(readFile(join(tmp, 'missing.txt'))).toBeNull();
  });

  it('fileExists returns true only for regular files, dirExists only for dirs', () => {
    const file = join(tmp, 'a.txt');
    writeFileSync(file, 'x');
    expect(fileExists(file)).toBe(true);
    expect(dirExists(file)).toBe(false);
    expect(fileExists(tmp)).toBe(false);
    expect(dirExists(tmp)).toBe(true);
  });

  it('ensureDir is idempotent', () => {
    ensureDir(join(tmp, 'd'));
    expect(() => ensureDir(join(tmp, 'd'))).not.toThrow();
  });

  it('getFileMtime returns Date or null', () => {
    const p = join(tmp, 'm.txt');
    writeFileSync(p, 'x');
    expect(getFileMtime(p)).toBeInstanceOf(Date);
    expect(getFileMtime(join(tmp, 'nope'))).toBeNull();
  });

  it('listFiles walks recursively and filters by extension', () => {
    writeFile(join(tmp, 'a.ts'), '');
    writeFile(join(tmp, 'sub/b.ts'), '');
    writeFile(join(tmp, 'sub/c.md'), '');

    const ts = listFiles(tmp, { extensions: ['.ts'] }).sort();
    expect(ts).toEqual([join(tmp, 'a.ts'), join(tmp, 'sub/b.ts')]);

    const all = listFiles(tmp).sort();
    expect(all.length).toBe(3);
  });

  it('listFiles honors recursive: false', () => {
    writeFile(join(tmp, 'a.ts'), '');
    writeFile(join(tmp, 'sub/b.ts'), '');
    const top = listFiles(tmp, { recursive: false });
    expect(top).toEqual([join(tmp, 'a.ts')]);
  });

  it('listFiles honors ignore substring patterns', () => {
    writeFile(join(tmp, 'keep.ts'), '');
    writeFile(join(tmp, 'node_modules/skip.ts'), '');
    const kept = listFiles(tmp, { ignore: ['node_modules'] });
    expect(kept).toEqual([join(tmp, 'keep.ts')]);
  });

  it('listFiles returns empty for missing directory', () => {
    expect(listFiles(join(tmp, 'does-not-exist'))).toEqual([]);
  });
});
