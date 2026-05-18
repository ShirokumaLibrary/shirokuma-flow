import { describe, expect, it } from 'vitest';
import { deriveSectionFilename, slugify } from '../../src/context/section-format.js';

describe('slugify', () => {
  it('lowercases and replaces non-alphanumeric runs with a single dash', () => {
    expect(slugify('Hello World!')).toBe('hello-world');
    expect(slugify('Foo  Bar--Baz')).toBe('foo-bar-baz');
  });

  it('strips leading and trailing dashes', () => {
    expect(slugify('---Hello---')).toBe('hello');
  });

  it('returns empty string for all-symbol input', () => {
    expect(slugify('!!!')).toBe('');
  });
});

describe('deriveSectionFilename', () => {
  it('prefers frontmatter title:', () => {
    const section = '---\ntitle: "Hello World"\n---\n\nbody';
    expect(deriveSectionFilename(section, 0, new Set())).toBe('hello-world');
  });

  it('falls back to body H1 when no frontmatter title', () => {
    const section = '# Intro\n\nbody';
    expect(deriveSectionFilename(section, 0, new Set())).toBe('intro');
  });

  it('falls back to first line when no H1', () => {
    const section = 'raw first line\n\nbody';
    expect(deriveSectionFilename(section, 0, new Set())).toBe('raw-first-line');
  });

  it('uses section-{N+1} when no usable candidate is present', () => {
    expect(deriveSectionFilename('!!!', 4, new Set())).toBe('section-5');
  });

  it('suffixes with -N when the base collides with usedNames', () => {
    const used = new Set(['foo']);
    expect(deriveSectionFilename('# foo', 0, used)).toBe('foo-2');
    expect(deriveSectionFilename('# foo', 1, used)).toBe('foo-3');
    expect(used.has('foo-2')).toBe(true);
    expect(used.has('foo-3')).toBe(true);
  });

  it('picks title over H1 when both are present', () => {
    const section = '---\ntitle: "Winner"\n---\n\n# Loser';
    expect(deriveSectionFilename(section, 0, new Set())).toBe('winner');
  });
});
