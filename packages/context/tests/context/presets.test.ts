import { describe, expect, it } from 'vitest';
import { PRESETS, listPresetNames, resolvePresetMeta } from '../../src/context/presets.js';

describe('preset registry', () => {
  it('contains 38 entries (shirokuma-docs parity)', () => {
    expect(listPresetNames()).toHaveLength(38);
  });

  it('every meta has a non-empty url', () => {
    for (const [name, meta] of Object.entries(PRESETS)) {
      expect(meta.url, `${name}.url`).toMatch(/^https?:\/\//);
    }
  });

  it('full-split presets require fullUrl and splitPattern', () => {
    for (const [name, meta] of Object.entries(PRESETS)) {
      if ('fetchStrategy' in meta && meta.fetchStrategy === 'full-split') {
        expect(meta.fullUrl, `${name}.fullUrl`).toMatch(/^https?:\/\//);
        expect(meta.splitPattern, `${name}.splitPattern`).toBeTruthy();
      }
    }
  });

  it('listPresetNames returns sorted names', () => {
    const names = listPresetNames();
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it('resolvePresetMeta returns the stored entry', () => {
    expect(resolvePresetMeta('react-19')?.url).toBe('https://react.dev/llms.txt');
  });

  it('resolvePresetMeta returns null for unknown names', () => {
    expect(resolvePresetMeta('does-not-exist')).toBeNull();
  });
});
