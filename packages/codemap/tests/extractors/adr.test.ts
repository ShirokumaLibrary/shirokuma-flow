import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractAdrIndex } from '../../src/extractors/adr.js';

const FIXTURES = resolve(__dirname, '../fixtures/adr');

describe('extractAdrIndex', () => {
  it('returns ADR entries for NNNN-*.md in the target directory', () => {
    const entries = extractAdrIndex(FIXTURES);
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.number)).toEqual(['0001', '0002', '0003']);
  });

  it('parses title / status / date from bullet-metadata format', () => {
    const [first] = extractAdrIndex(FIXTURES);
    expect(first).toMatchObject({
      number: '0001',
      title: 'Sample Foo Decision',
      status: 'Accepted',
      date: '2026-01-15',
      path: '0001-sample-foo.md',
    });
  });

  it('tolerates bullet without bold (`- Status:` vs `- **Status**:`)', () => {
    const entries = extractAdrIndex(FIXTURES);
    const third = entries.find((e) => e.number === '0003');
    expect(third?.status).toBe('Accepted');
    expect(third?.date).toBe('2026-03-10');
  });

  it('preserves full Superseded status text', () => {
    const entries = extractAdrIndex(FIXTURES);
    const second = entries.find((e) => e.number === '0002');
    expect(second?.status).toBe('Superseded by ADR-0003');
  });

  it('skips non-NNNN-*.md files (README.md) and returns sorted by number', () => {
    const entries = extractAdrIndex(FIXTURES);
    for (const e of entries) expect(e.path).toMatch(/^\d{4}-/);
    const numbers = entries.map((e) => e.number);
    expect(numbers).toEqual([...numbers].sort());
  });

  it('returns [] for a non-existent directory', () => {
    const entries = extractAdrIndex(resolve(FIXTURES, '__nope__'));
    expect(entries).toEqual([]);
  });
});
