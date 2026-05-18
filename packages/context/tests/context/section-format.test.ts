import { describe, expect, it } from 'vitest';
import { resolveSectionFormatter } from '../../src/context/section-format.js';

describe('resolveSectionFormatter', () => {
  it('returns a passthrough for undefined / unknown names', () => {
    const passthrough = resolveSectionFormatter(undefined);
    expect(passthrough('hello', new Map())).toBe('hello');

    const fallback = resolveSectionFormatter('not-a-real-formatter');
    expect(fallback('hello', new Map())).toBe('hello');
  });

  it('returns the metadata formatter when asked', () => {
    const format = resolveSectionFormatter('metadata-to-frontmatter');
    const section = ['Source: https://example.com/a', '', '# Hello', '', 'body'].join('\n');
    const out = format(section, new Map([['https://example.com/a', 'Hello']]));
    expect(out).toContain('---\ntitle: "Hello"\nsource: https://example.com/a\n---');
    expect(out).toContain('body');
  });
});

describe('metadata-to-frontmatter formatter', () => {
  const format = resolveSectionFormatter('metadata-to-frontmatter');

  it('returns the input unchanged when there is no Source/URL header', () => {
    expect(format('no source here', new Map())).toBe('no source here');
  });

  it('converts Source + H1 title to frontmatter, moves H1 below frontmatter', () => {
    const section = ['Source: https://x/page', '', '# Page', '', 'paragraph'].join('\n');
    const out = format(section, new Map([['https://x/page', 'Page']]));
    expect(out).toBe(
      // 既存の `# Page` は一旦除去され、frontmatter 直後に canonical な位置で再挿入される。
      ['---', 'title: "Page"', 'source: https://x/page', '---', '', '# Page', 'paragraph'].join(
        '\n',
      ),
    );
  });

  it('also accepts URL: in place of Source:', () => {
    const section = ['URL: https://x/p', '', 'hi'].join('\n');
    const out = format(section, new Map());
    expect(out).toContain('source: https://x/p');
  });

  it('strips `import ... from "..."` noise lines', () => {
    const section = ['Source: https://x/p', '', 'import Foo from "./foo";', 'body'].join('\n');
    const out = format(section, new Map());
    expect(out).not.toContain('import Foo');
    expect(out).toContain('body');
  });

  it('injects H1 when title exists but body has none', () => {
    const section = ['Source: https://x/p', '', 'body line'].join('\n');
    const out = format(section, new Map([['https://x/p', 'Synthetic']]));
    expect(out).toContain('# Synthetic\nbody line');
  });

  it('omits title field when the llms.txt has no matching entry', () => {
    const section = ['Source: https://x/p', '', 'body'].join('\n');
    const out = format(section, new Map());
    expect(out).not.toContain('title:');
    expect(out).toContain('source: https://x/p');
  });

  it('escapes double quotes and backslashes in titles (YAML safety)', () => {
    const section = ['Source: https://x/p', '', 'body'].join('\n');
    const out = format(section, new Map([['https://x/p', 'He said "hi" \\ok']]));
    expect(out).toContain('title: "He said \\"hi\\" \\\\ok"');
  });
});
