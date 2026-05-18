import { describe, expect, it } from 'vitest';
import {
  parseFrontmatter,
  validateDateFormat,
  validateFrontmatterField,
} from '../src/frontmatter.js';

describe('parseFrontmatter', () => {
  it('returns hasFrontmatter=false when absent', () => {
    expect(parseFrontmatter('# Title\nbody').hasFrontmatter).toBe(false);
  });

  it('parses YAML and returns data + content', () => {
    const input = '---\ntitle: Hello\nversion: 1\n---\nbody\n';
    const parsed = parseFrontmatter(input);
    expect(parsed.hasFrontmatter).toBe(true);
    expect(parsed.data).toEqual({ title: 'Hello', version: 1 });
    expect(parsed.content).toBe('body\n');
  });

  it('handles empty frontmatter block', () => {
    const input = '---\n---\nbody';
    const parsed = parseFrontmatter(input);
    expect(parsed.hasFrontmatter).toBe(true);
    expect(parsed.data).toEqual({});
  });

  it('reports parseError for broken YAML', () => {
    const input = '---\nkey: [unclosed\n---\nbody';
    const parsed = parseFrontmatter(input);
    expect(parsed.hasFrontmatter).toBe(true);
    expect(parsed.parseError).toBeDefined();
  });
});

describe('validateFrontmatterField', () => {
  it('missing required field errors', () => {
    const r = validateFrontmatterField({}, { name: 'title' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Missing required field');
  });

  it('allowed values enforcement', () => {
    const ok = validateFrontmatterField(
      { status: 'draft' },
      { name: 'status', values: ['draft', 'published'] },
    );
    expect(ok.valid).toBe(true);
    const ng = validateFrontmatterField(
      { status: 'invalid' },
      { name: 'status', values: ['draft', 'published'] },
    );
    expect(ng.valid).toBe(false);
    expect(ng.error).toContain('Invalid value');
  });

  it('YYYY-MM-DD format enforcement', () => {
    expect(
      validateFrontmatterField({ date: '2026-04-19' }, { name: 'date', format: 'YYYY-MM-DD' })
        .valid,
    ).toBe(true);
    expect(
      validateFrontmatterField({ date: 'not-a-date' }, { name: 'date', format: 'YYYY-MM-DD' })
        .valid,
    ).toBe(false);
  });
});

describe('validateDateFormat', () => {
  it('accepts valid dates', () => {
    expect(validateDateFormat('2026-04-19', 'YYYY-MM-DD')).toBe(true);
    expect(validateDateFormat('2026-02-29', 'YYYY-MM-DD')).toBe(false);
    expect(validateDateFormat('2024-02-29', 'YYYY-MM-DD')).toBe(true);
  });

  it('rejects invalid month/day', () => {
    expect(validateDateFormat('2026-13-01', 'YYYY-MM-DD')).toBe(false);
    expect(validateDateFormat('2026-01-32', 'YYYY-MM-DD')).toBe(false);
  });

  it('unknown format returns true (validation skipped)', () => {
    expect(validateDateFormat('whatever', 'UNKNOWN')).toBe(true);
  });
});
