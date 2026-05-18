import { describe, expect, it } from 'vitest';
import { buildCodemap } from '../src/build.js';
import { extractCodemap } from '../src/index.js';

describe('公開 API エイリアス', () => {
  it('extractCodemap は内部 buildCodemap と参照的に同一である（YAGNI ラッパー不要）', () => {
    expect(extractCodemap).toBe(buildCodemap);
  });
});
