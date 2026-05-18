import { describe, expect, it } from 'vitest';
import { lintCommitFormat } from '../src/commit-format.js';

describe('lintCommitFormat', () => {
  it('passes when commits are empty', () => {
    const report = lintCommitFormat({ config: { commits: [] } });
    expect(report.passed).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.summary.commitsChecked).toBe(0);
  });

  it('passes a valid conventional commit', () => {
    const report = lintCommitFormat({
      config: { commits: [{ hash: 'abc1234', subject: 'feat: add login' }] },
    });
    expect(report.passed).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.summary.commitsChecked).toBe(1);
  });

  it('accepts scope syntax feat(api):', () => {
    const report = lintCommitFormat({
      config: { commits: [{ hash: 'abc1234', subject: 'feat(api): add endpoint' }] },
    });
    expect(report.passed).toBe(true);
  });

  it('flags non-conventional subject', () => {
    const report = lintCommitFormat({
      config: { commits: [{ hash: 'abc1234', subject: 'oops forgot prefix' }] },
    });
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toMatchObject({
      rule: 'not-conventional',
      status: 'warning',
      hash: 'abc1234',
    });
  });

  it('flags unknown commit type', () => {
    const report = lintCommitFormat({
      config: { commits: [{ hash: 'abc1234', subject: 'wibble: nope' }] },
    });
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toMatchObject({
      rule: 'unknown-type',
      status: 'warning',
      hash: 'abc1234',
    });
  });

  it('respects custom allowedTypes', () => {
    const report = lintCommitFormat({
      config: {
        commits: [{ hash: 'abc1234', subject: 'wibble: ok' }],
        allowedTypes: ['wibble'],
      },
    });
    expect(report.passed).toBe(true);
  });

  it('flags subjects exceeding maxSubjectLength as info', () => {
    const long = 'feat: ' + 'x'.repeat(80);
    const report = lintCommitFormat({
      config: { commits: [{ hash: 'abc1234', subject: long }] },
    });
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toMatchObject({
      rule: 'subject-too-long',
      status: 'info',
      hash: 'abc1234',
    });
  });

  it('skips Merge commits', () => {
    const report = lintCommitFormat({
      config: { commits: [{ hash: 'abc1234', subject: 'Merge branch foo into bar' }] },
    });
    expect(report.issues).toEqual([]);
    expect(report.summary.commitsChecked).toBe(1);
  });

  it('skips Revert commits', () => {
    const report = lintCommitFormat({
      config: { commits: [{ hash: 'abc1234', subject: 'Revert "feat: foo"' }] },
    });
    expect(report.issues).toEqual([]);
  });

  it('honors severity=error so passed becomes false', () => {
    const report = lintCommitFormat({
      config: {
        commits: [{ hash: 'abc1234', subject: 'oops' }],
        severity: 'error',
      },
    });
    expect(report.passed).toBe(false);
    expect(report.issues[0]?.status).toBe('error');
  });

  it('passes when only info issues exist', () => {
    const long = 'feat: ' + 'x'.repeat(80);
    const report = lintCommitFormat({
      config: { commits: [{ hash: 'abc1234', subject: long }] },
    });
    expect(report.passed).toBe(true);
    expect(report.summary.infoCount).toBe(1);
  });

  it('respects custom maxSubjectLength', () => {
    const report = lintCommitFormat({
      config: {
        commits: [{ hash: 'abc1234', subject: 'feat: short one' }],
        maxSubjectLength: 5,
      },
    });
    expect(report.issues.some((i) => i.rule === 'subject-too-long')).toBe(true);
  });

  it('counts multiple issues across commits', () => {
    const report = lintCommitFormat({
      config: {
        commits: [
          { hash: 'a1', subject: 'feat: ok' },
          { hash: 'a2', subject: 'oops' },
          { hash: 'a3', subject: 'wibble: no' },
        ],
      },
    });
    expect(report.summary.commitsChecked).toBe(3);
    expect(report.issues).toHaveLength(2);
    expect(report.summary.warningCount).toBe(2);
  });
});
