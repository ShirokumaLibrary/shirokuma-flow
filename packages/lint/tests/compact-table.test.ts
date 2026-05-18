import { describe, expect, it } from 'vitest';
import { checkCompactTables } from '../src/compact-table.js';

const FILE = '/tmp/test.md';

describe('checkCompactTables', () => {
  it('returns valid for content without tables', () => {
    const result = checkCompactTables('# heading\n\nprose only\n', FILE);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts compact table with single-space padding', () => {
    const md = '| a | b |\n| --- | --- |\n| x | y |\n';
    const result = checkCompactTables(md, FILE);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts compact table with empty cell (| |)', () => {
    const md = '| a | b |\n| --- | --- |\n| x | |\n';
    const result = checkCompactTables(md, FILE);
    expect(result.valid).toBe(true);
  });

  it('accepts alignment markers :-- / --: / :-:', () => {
    const md = '| a | b | c |\n| :-- | --: | :-: |\n| x | y | z |\n';
    const result = checkCompactTables(md, FILE);
    expect(result.valid).toBe(true);
  });

  it('rejects over-padded content cell', () => {
    const md = '| a  | b |\n| --- | --- |\n| x | y |\n';
    const result = checkCompactTables(md, FILE);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.rule).toBe('compact-table');
    expect(result.errors[0]?.line).toBe(1);
  });

  it('rejects separator with 4+ dashes', () => {
    const md = '| a | b |\n| ---- | --- |\n| x | y |\n';
    const result = checkCompactTables(md, FILE);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.line).toBe(2);
  });

  it('rejects separator with only 2 dashes', () => {
    const md = '| a | b |\n| -- | --- |\n| x | y |\n';
    const result = checkCompactTables(md, FILE);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.line).toBe(2);
  });

  it('rejects empty cell with 2 spaces (|  |)', () => {
    const md = '| a | b |\n| --- | --- |\n| x |  |\n';
    const result = checkCompactTables(md, FILE);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.line).toBe(3);
  });

  it('rejects zero-padded cell (|a|)', () => {
    const md = '|a|b|\n| --- | --- |\n| x | y |\n';
    const result = checkCompactTables(md, FILE);
    expect(result.valid).toBe(false);
  });

  it('rejects leading whitespace before pipe', () => {
    const md = '  | a | b |\n  | --- | --- |\n  | x | y |\n';
    const result = checkCompactTables(md, FILE);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === 'compact-table-leading-indent')).toBe(true);
  });

  it('ignores table-like lines inside fenced code blocks', () => {
    const md = '```\n| a  | b  |\n| ---- | ---- |\n| x | y |\n```\n';
    const result = checkCompactTables(md, FILE);
    expect(result.valid).toBe(true);
  });

  it('ignores table-like lines inside tilde fenced code blocks', () => {
    const md = '~~~\n| a  | b  |\n~~~\n';
    const result = checkCompactTables(md, FILE);
    expect(result.valid).toBe(true);
  });

  it('resumes detection after code fence closes', () => {
    const md = '```\n| a  | b  |\n```\n\n| a  | b |\n| --- | --- |\n';
    const result = checkCompactTables(md, FILE);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.line).toBe(5);
  });

  it('handles escaped pipes in cell content', () => {
    const md = '| a \\| b | c |\n| --- | --- |\n| x | y |\n';
    const result = checkCompactTables(md, FILE);
    expect(result.valid).toBe(true);
  });

  it('reports multiple violations with correct line numbers', () => {
    const md = '| a  | b |\n| --- | --- |\n| x  | y |\n';
    const result = checkCompactTables(md, FILE);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
    const lines = result.errors.map((e) => e.line);
    expect(lines).toContain(1);
    expect(lines).toContain(3);
  });

  // Issue #56: allow indented tables inside list items
  it('accepts numbered-list-nested table with leading whitespace matching list content indent', () => {
    const md = [
      '1. `New category` をクリック',
      '2. 入力:',
      '   | 項目 | 値 |',
      '   | --- | --- |',
      '   | Category name | `ADR` |',
      '',
    ].join('\n');
    const result = checkCompactTables(md, FILE);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts bullet-list-nested table with leading whitespace', () => {
    const md = ['- note:', '  | a | b |', '  | --- | --- |', '  | x | y |', ''].join('\n');
    const result = checkCompactTables(md, FILE);
    expect(result.valid).toBe(true);
  });

  it('still rejects top-level indented table with no enclosing list', () => {
    const md = ['# heading', '', '   | a | b |', '   | --- | --- |', ''].join('\n');
    const result = checkCompactTables(md, FILE);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === 'compact-table-leading-indent')).toBe(true);
  });

  it('checks cell format in list-nested table (bad padding still flagged)', () => {
    const md = ['1. 入力:', '   | a  | b |', '   | --- | --- |', ''].join('\n');
    const result = checkCompactTables(md, FILE);
    expect(result.valid).toBe(false);
    const cellErrors = result.errors.filter((e) => e.rule === 'compact-table');
    expect(cellErrors.length).toBeGreaterThanOrEqual(1);
    // The leading-indent error should NOT fire for list-nested tables
    expect(result.errors.some((e) => e.rule === 'compact-table-leading-indent')).toBe(false);
  });

  it('exits list context when subsequent non-indented content appears', () => {
    const md = [
      '1. step one',
      '',
      '   | a | b |',
      '   | --- | --- |',
      '',
      'Non-list paragraph.',
      '',
      '  | c | d |',
      '  | --- | --- |',
      '',
    ].join('\n');
    const result = checkCompactTables(md, FILE);
    expect(result.valid).toBe(false);
    // The first table (inside list) should be OK; the second (post-paragraph) should flag leading-indent
    const indentErrors = result.errors.filter((e) => e.rule === 'compact-table-leading-indent');
    expect(indentErrors.length).toBeGreaterThanOrEqual(1);
    // All indent errors should be on the second table (lines 8-9), not the first (3-4)
    for (const err of indentErrors) {
      expect(err.line).toBeGreaterThanOrEqual(8);
    }
  });
});
