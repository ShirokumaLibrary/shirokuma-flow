import { describe, expect, it } from 'vitest';
import { extractImageUrls, rewriteImagePaths } from '../../src/context/images.js';

describe('extractImageUrls', () => {
  it('extracts Markdown image URLs', () => {
    const md = '![alt](https://example.com/a.png) some text ![b](https://example.com/b.jpg)';
    expect(extractImageUrls(md)).toEqual([
      'https://example.com/a.png',
      'https://example.com/b.jpg',
    ]);
  });

  it('extracts <img src="..."> URLs', () => {
    const md = '<img src="https://example.com/c.svg" alt="c"/>';
    expect(extractImageUrls(md)).toEqual(['https://example.com/c.svg']);
  });

  it('dedupes repeated URLs preserving first-seen order', () => {
    const md =
      '![a](https://example.com/a.png) ![a again](https://example.com/a.png) ![b](https://example.com/b.png)';
    expect(extractImageUrls(md)).toEqual([
      'https://example.com/a.png',
      'https://example.com/b.png',
    ]);
  });

  it('ignores images without file extensions', () => {
    const md = '![dynamic](https://example.com/thumbnail)';
    expect(extractImageUrls(md)).toEqual([]);
  });

  it('ignores relative <img> srcs', () => {
    const md = '<img src="/local/img.png"/>';
    expect(extractImageUrls(md)).toEqual([]);
  });

  it('treats URLs as same when query string differs but path matches (Markdown)', () => {
    const md = '![a](https://example.com/a.png?v=1) ![a](https://example.com/a.png?v=2)';
    // first one wins (dedupe key is the extensionless split, which is "https://example.com/a.png")
    expect(extractImageUrls(md)).toEqual(['https://example.com/a.png?v=1']);
  });

  it('dedupes across Markdown and <img> referring to the same path', () => {
    const md = '![a](https://example.com/a.png?v=1) <img src="https://example.com/a.png?v=2"/>';
    expect(extractImageUrls(md)).toEqual(['https://example.com/a.png?v=1']);
  });

  it('dedupes <img> srcs by canonical path (query differences)', () => {
    const md = '<img src="https://x/i.png?v=1"/> <img src="https://x/i.png?v=2"/>';
    expect(extractImageUrls(md)).toEqual(['https://x/i.png?v=1']);
  });

  it('rejects pseudo-http schemes (e.g. httpfoo://)', () => {
    const md = '<img src="httpfoo://example.com/a.png"/>';
    expect(extractImageUrls(md)).toEqual([]);
  });
});

describe('rewriteImagePaths', () => {
  it('replaces absolute URLs with relative ./name paths', () => {
    const md = '![a](https://example.com/a.png) ![b](https://example.com/b.jpg)';
    const rewrites = new Map([
      ['https://example.com/a.png', 'a.png'],
      ['https://example.com/b.jpg', 'b.jpg'],
    ]);
    expect(rewriteImagePaths(md, rewrites)).toBe('![a](./a.png) ![b](./b.jpg)');
  });

  it('replaces all occurrences of the same URL', () => {
    const md = '![](https://x/a.png) text ![](https://x/a.png)';
    expect(rewriteImagePaths(md, new Map([['https://x/a.png', 'a.png']]))).toBe(
      '![](./a.png) text ![](./a.png)',
    );
  });

  it('is a no-op when rewrites is empty', () => {
    expect(rewriteImagePaths('hello', new Map())).toBe('hello');
  });
});
