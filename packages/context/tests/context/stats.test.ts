import { describe, expect, it } from 'vitest';
import { createEmptyStats } from '../../src/context/stats.js';

describe('createEmptyStats', () => {
  it('returns all-zero counters', () => {
    expect(createEmptyStats()).toEqual({
      downloaded: 0,
      skipped: 0,
      failed: 0,
      imagesDownloaded: 0,
      imagesSkipped: 0,
      imagesFailed: 0,
      svgConverted: 0,
      svgKept: 0,
    });
  });

  it('returns a fresh object on each call', () => {
    const a = createEmptyStats();
    const b = createEmptyStats();
    a.downloaded = 5;
    expect(b.downloaded).toBe(0);
  });
});
