import { describe, expect, it } from 'vitest';
import { buildTitleMap, parseLlmsTxt, parseLlmsTxtWithTitles } from '../../src/context/llms-txt.js';

describe('parseLlmsTxtWithTitles', () => {
  it('extracts absolute Markdown links', () => {
    const content = '[Hello](https://example.com/a) and [World](https://example.com/b).';
    expect(parseLlmsTxtWithTitles(content)).toEqual([
      { url: 'https://example.com/a', title: 'Hello' },
      { url: 'https://example.com/b', title: 'World' },
    ]);
  });

  it('resolves relative links against baseUrl origin', () => {
    const content = '[Guide](/docs/guide)';
    expect(parseLlmsTxtWithTitles(content, 'https://example.com/llms.txt')).toEqual([
      { url: 'https://example.com/docs/guide', title: 'Guide' },
    ]);
  });

  it('ignores relative links when baseUrl is missing', () => {
    const content = '[Guide](/docs/guide)';
    expect(parseLlmsTxtWithTitles(content)).toEqual([]);
  });

  it('ignores relative links when baseUrl is malformed', () => {
    const content = '[Guide](/docs/guide)';
    expect(parseLlmsTxtWithTitles(content, 'not-a-url')).toEqual([]);
  });

  it('accepts empty-title Markdown links', () => {
    expect(parseLlmsTxtWithTitles('[](https://example.com/x)')).toEqual([
      { url: 'https://example.com/x', title: '' },
    ]);
  });

  it('captures bare URL lines with empty title', () => {
    const content = '# Overview\nhttps://example.com/bare\nmore text';
    expect(parseLlmsTxtWithTitles(content)).toEqual([
      { url: 'https://example.com/bare', title: '' },
    ]);
  });

  it('dedupes first-wins across all link types', () => {
    const content = `
[First](https://example.com/a)
https://example.com/a
[Second](https://example.com/a)
`;
    expect(parseLlmsTxtWithTitles(content)).toEqual([
      { url: 'https://example.com/a', title: 'First' },
    ]);
  });

  it('preserves absolute → relative → bare ordering', () => {
    const content = `
[Abs](https://example.com/a)
[Rel](/b)
https://example.com/c
`;
    expect(parseLlmsTxtWithTitles(content, 'https://example.com/llms.txt')).toEqual([
      { url: 'https://example.com/a', title: 'Abs' },
      { url: 'https://example.com/b', title: 'Rel' },
      { url: 'https://example.com/c', title: '' },
    ]);
  });
});

describe('parseLlmsTxt', () => {
  it('returns URLs in the same order as parseLlmsTxtWithTitles', () => {
    const content = '[A](https://x/a) [B](https://x/b)';
    expect(parseLlmsTxt(content)).toEqual(['https://x/a', 'https://x/b']);
  });
});

describe('buildTitleMap', () => {
  it('builds a URL→title map from titled entries only', () => {
    const content = `
[Titled](https://x/a)
https://x/b
`;
    expect([...buildTitleMap(content).entries()]).toEqual([['https://x/a', 'Titled']]);
  });

  it('returns empty map when there are no titled entries', () => {
    expect(buildTitleMap('https://x/a\nhttps://x/b').size).toBe(0);
  });
});
