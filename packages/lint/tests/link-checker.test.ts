import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeFile } from '../src/file.js';
import { classifyLink, extractLinks, validateInternalLink } from '../src/link-checker.js';

describe('classifyLink', () => {
  it('routes external / anchor / absolute / relative', () => {
    expect(classifyLink('https://example.com')).toBe('external');
    expect(classifyLink('mailto:a@b.com')).toBe('external');
    expect(classifyLink('#section')).toBe('anchor');
    expect(classifyLink('/abs/path')).toBe('absolute');
    expect(classifyLink('./rel/path')).toBe('relative');
    expect(classifyLink('../up')).toBe('relative');
  });
});

describe('extractLinks', () => {
  it('extracts inline markdown links with line numbers', () => {
    const md = ['# title', '', 'see [here](./other.md) and [docs](https://example.com)'].join('\n');
    const links = extractLinks(md);
    expect(links).toEqual([
      { text: 'here', url: './other.md', line: 3 },
      { text: 'docs', url: 'https://example.com', line: 3 },
    ]);
  });

  it('extracts reference-style link definitions', () => {
    const md = '[ref]: https://example.com/target\nsee [ref][ref]';
    const links = extractLinks(md);
    expect(links.some((l) => l.text === 'ref' && l.url === 'https://example.com/target')).toBe(
      true,
    );
  });
});

describe('validateInternalLink', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'lint-link-'));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('skips external links', () => {
    const r = validateInternalLink(
      { text: 'x', url: 'https://example.com', line: 1 },
      tmp,
      join(tmp, 'a.md'),
    );
    expect(r).toEqual({ valid: true, skipped: true });
  });

  it('passes anchor-only links', () => {
    const r = validateInternalLink({ text: 'x', url: '#section', line: 1 }, tmp, join(tmp, 'a.md'));
    expect(r.valid).toBe(true);
  });

  it('errors on broken relative link', () => {
    writeFile(join(tmp, 'a.md'), 'x');
    const r = validateInternalLink(
      { text: 'y', url: './missing.md', line: 1 },
      tmp,
      join(tmp, 'a.md'),
    );
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Broken link');
  });

  it('passes valid relative link', () => {
    writeFile(join(tmp, 'a.md'), 'x');
    writeFile(join(tmp, 'b.md'), 'y');
    const r = validateInternalLink({ text: 'y', url: './b.md', line: 1 }, tmp, join(tmp, 'a.md'));
    expect(r.valid).toBe(true);
  });

  it('resolves absolute link against basePath', () => {
    writeFile(join(tmp, 'sub/a.md'), 'x');
    const r = validateInternalLink(
      { text: 'y', url: '/sub/a.md', line: 1 },
      tmp,
      join(tmp, 'other.md'),
    );
    expect(r.valid).toBe(true);
  });
});
