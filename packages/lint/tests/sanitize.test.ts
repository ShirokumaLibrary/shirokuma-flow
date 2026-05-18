import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { escapeRegExp, safeRegExp, validateProjectPath } from '../src/sanitize.js';

describe('escapeRegExp', () => {
  it('escapes regex metacharacters', () => {
    expect(escapeRegExp('a.b*c+')).toBe('a\\.b\\*c\\+');
    expect(escapeRegExp('(foo|bar)')).toBe('\\(foo\\|bar\\)');
    expect(escapeRegExp('[x]{2}')).toBe('\\[x\\]\\{2\\}');
  });

  it('returns plain strings unchanged', () => {
    expect(escapeRegExp('hello')).toBe('hello');
  });
});

describe('safeRegExp', () => {
  it('compiles valid patterns', () => {
    const re = safeRegExp('^abc\\d+$');
    expect(re).not.toBeNull();
    expect(re?.test('abc123')).toBe(true);
  });

  it('supports flags', () => {
    const re = safeRegExp('hello', 'i');
    expect(re?.test('HELLO')).toBe(true);
  });

  it('returns null for invalid patterns', () => {
    expect(safeRegExp('[')).toBeNull();
  });
});

describe('validateProjectPath', () => {
  it('rejects empty input', () => {
    expect(() => validateProjectPath('')).toThrow(/must not be empty/);
  });

  it('rejects root directory', () => {
    expect(() => validateProjectPath('/')).toThrow(/root directory/);
  });

  it('rejects system prefixes', () => {
    expect(() => validateProjectPath('/etc/passwd')).toThrow(/system directory/);
    expect(() => validateProjectPath('/var/log')).toThrow(/system directory/);
    expect(() => validateProjectPath('/sbin/init')).toThrow(/system directory/);
  });

  it('accepts paths under /tmp', () => {
    expect(validateProjectPath('/tmp/some-project')).toBe('/tmp/some-project');
  });

  it('accepts paths under home', () => {
    const home = homedir();
    expect(validateProjectPath(`${home}/project`)).toBe(`${home}/project`);
  });

  describe('os.tmpdir() support (cross-platform)', () => {
    let real: string;
    beforeAll(() => {
      real = mkdtempSync(join(tmpdir(), 'lint-sanitize-'));
    });
    afterAll(() => {
      rmSync(real, { recursive: true, force: true });
    });

    it('accepts os.tmpdir() output even when it is under /var (macOS)', () => {
      expect(validateProjectPath(real)).toBe(real);
    });
  });

  it('rejects paths outside home and tmp', () => {
    expect(() => validateProjectPath('/opt/other')).toThrow(/outside/);
  });
});
