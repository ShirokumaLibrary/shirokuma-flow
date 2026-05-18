import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractSection, search, searchFile } from '../../src/context/search.js';

function withTmp<T>(run: (dir: string) => Promise<T> | T): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'context-search-'));
  return Promise.resolve(run(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

function makeSource(root: string, name: string, files: Record<string, string>): void {
  const dir = join(root, '.shirokuma', 'contexts', name);
  mkdirSync(dir, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const target = join(dir, rel);
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, content);
  }
}

describe('searchFile', () => {
  it('returns matching lines with 1-based line numbers', async () => {
    await withTmp((root) => {
      const file = join(root, 'a.md');
      writeFileSync(file, 'foo\nbar\nfoo again\n');
      const matches = searchFile(file, /foo/i, 0);
      expect(matches.map((m) => m.line)).toEqual([1, 3]);
      expect(matches[0]?.text).toBe('foo');
    });
  });

  it('attaches surrounding lines when context > 0', async () => {
    await withTmp((root) => {
      const file = join(root, 'a.md');
      writeFileSync(file, 'a\nb\nfoo\nd\ne\n');
      const matches = searchFile(file, /foo/, 1);
      expect(matches[0]?.context).toEqual(['2: b', '3: foo', '4: d']);
    });
  });

  it('returns [] on read failure', () => {
    expect(searchFile('/tmp/does-not-exist-ctx-search', /x/, 0)).toEqual([]);
  });
});

describe('extractSection', () => {
  it('returns the section containing the target line', () => {
    const content = '# A\nbody of A\n\n# B\nbody of B\nmatch here\n\n# C\n';
    const section = extractSection(content, 6);
    expect(section.content).toContain('# B');
    expect(section.content).not.toContain('# A');
    expect(section.content).not.toContain('# C');
    expect(section.startLine).toBe(4);
  });

  it('returns preamble when target is before first heading', () => {
    const content = 'preamble\nline 2\n# H1\nbody';
    const section = extractSection(content, 1);
    expect(section.content).toBe('preamble\nline 2');
    expect(section.startLine).toBe(1);
  });

  it('returns full content when no heading exists', () => {
    const section = extractSection('no heading here\nline 2', 1);
    expect(section.startLine).toBe(1);
    expect(section.content).toBe('no heading here\nline 2');
  });
});

describe('search', () => {
  it('finds keyword across all filesystem sources', async () => {
    await withTmp((root) => {
      makeSource(root, 'bun', { 'a.md': 'bun is fast\nignored' });
      makeSource(root, 'vue', { 'b.md': 'vue framework' });
      const result = search({ projectPath: root, query: 'framework' });
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0]).toMatchObject({ source: 'vue', line: 1 });
    });
  });

  it('restricts to a specific source and reports sourceNotFound', async () => {
    await withTmp((root) => {
      makeSource(root, 'bun', { 'a.md': 'x' });
      const result = search({ projectPath: root, query: 'x', source: 'missing' });
      expect(result.sourceNotFound).toBe(true);
      expect(result.matches).toEqual([]);
    });
  });

  it('honors limit across sources', async () => {
    await withTmp((root) => {
      makeSource(root, 'bun', { 'a.md': 'x\nx\nx\n' });
      makeSource(root, 'vue', { 'b.md': 'x\nx\n' });
      const result = search({ projectPath: root, query: 'x', limit: 2 });
      expect(result.matches).toHaveLength(2);
    });
  });

  it('collapses section-mode duplicate sections within a file', async () => {
    await withTmp((root) => {
      makeSource(root, 'bun', {
        'a.md': '# Intro\nfoo\nfoo again\n\n# Next\nfoo\n',
      });
      const result = search({ projectPath: root, query: 'foo', section: true });
      // Intro のマッチ 2 件は 1 件にまとめ、Next の 1 件と合わせて合計 2 件
      expect(result.matches).toHaveLength(2);
      expect(result.matches[0]?.sectionContent).toContain('# Intro');
      expect(result.matches[1]?.sectionContent).toContain('# Next');
    });
  });

  it('supports regex mode', async () => {
    await withTmp((root) => {
      makeSource(root, 'bun', { 'a.md': 'version 1.2.3\n' });
      const result = search({
        projectPath: root,
        query: 'version \\d+\\.\\d+\\.\\d+',
        regex: true,
      });
      expect(result.matches).toHaveLength(1);
    });
  });

  it('returns [] when no sources exist', async () => {
    await withTmp((root) => {
      expect(search({ projectPath: root, query: 'anything' }).matches).toEqual([]);
    });
  });
});
