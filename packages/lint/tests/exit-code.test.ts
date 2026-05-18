import { describe, expect, it } from 'vitest';
import { determineLintExitCode } from '../src/exit-code.js';

describe('determineLintExitCode', () => {
  it('returns 0 when passed', () => {
    expect(determineLintExitCode(true, true)).toBe(0);
    expect(determineLintExitCode(true, false)).toBe(0);
  });

  it('returns 1 only when strict and failed', () => {
    expect(determineLintExitCode(false, true)).toBe(1);
  });

  it('returns 0 when failed but not strict', () => {
    expect(determineLintExitCode(false, false)).toBe(0);
  });
});
