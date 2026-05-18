import { describe, expect, it } from 'vitest';
import { transformMdxToMd } from '../../src/context/presets/tailwindcss-mdx-transform.js';

describe('transformMdxToMd', () => {
  it('extracts title / description and writes frontmatter', () => {
    const input = [
      'export const title = "Getting Started";',
      'export const description = "Install tailwindcss";',
      '',
      '# Body starts here',
      '',
      'Some paragraph.',
    ].join('\n');
    const out = transformMdxToMd(input);
    expect(out).toMatch(/^---\ntitle: "Getting Started"\ndescription: "Install tailwindcss"\n---/);
    expect(out).not.toContain('export const');
    expect(out).toContain('# Body starts here');
    expect(out).toContain('Some paragraph.');
  });

  it('removes import statements', () => {
    const input = [
      'import Foo from "./foo";',
      'import { Bar, Baz } from "./bar";',
      '',
      'body text',
    ].join('\n');
    const out = transformMdxToMd(input);
    expect(out).not.toContain('import ');
    expect(out.trim()).toContain('body text');
  });

  it('converts <ApiTable> to a Markdown table', () => {
    const input = [
      '<ApiTable',
      '  rows={[',
      '    ["cls-a", "background: red;"],',
      '    ["cls-b", "color: blue;"],',
      '  ]}',
      '/>',
    ].join('\n');
    const out = transformMdxToMd(input);
    expect(out).toContain('| Class | Styles |');
    expect(out).toContain('| --- | --- |');
    expect(out).toContain('| cls-a | background: red; |');
    expect(out).toContain('| cls-b | color: blue; |');
  });

  it('strips wrapper JSX tags while keeping inner content', () => {
    const input = ['<Figure>', '', '![img](pic.png)', '', '</Figure>'].join('\n');
    const out = transformMdxToMd(input);
    expect(out).toContain('![img](pic.png)');
    expect(out).not.toMatch(/<\/?Figure>/);
  });

  it('drops self-closing boilerplate components and their headings', () => {
    const input = [
      '## Responsive design',
      '',
      '<ResponsiveDesign />',
      '',
      '## Other heading',
      '',
      'Kept body.',
    ].join('\n');
    const out = transformMdxToMd(input);
    expect(out).not.toContain('ResponsiveDesign');
    expect(out).not.toMatch(/Responsive design/);
    expect(out).toContain('## Other heading');
    expect(out).toContain('Kept body.');
  });

  it('converts TipBad / TipGood / TipInfo to blockquote markers', () => {
    const input = [
      '<TipBad>do not do this</TipBad>',
      '<TipGood>do this instead</TipGood>',
      '<TipInfo>note</TipInfo>',
    ].join('\n');
    const out = transformMdxToMd(input);
    expect(out).toContain('> **Bad:** do not do this');
    expect(out).toContain('> **Good:** do this instead');
    expect(out).toContain('> **Info:** note');
  });

  it('collapses 3+ blank lines to 2', () => {
    const input = 'a\n\n\n\n\nb';
    const out = transformMdxToMd(input);
    expect(out).toBe('a\n\nb\n');
  });
});
