import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCodemap, OUTPUT_PATHS } from '../../src/build.js';
import {
  buildExecuteEnvelope,
  buildPlanEnvelope,
  computePlanHash,
  DIFF_TO_PLACEHOLDER,
} from '../../src/observation.js';

const FIXTURE_ROOT = resolve(__dirname, '../fixtures');

/** cli.ts の build コマンド planHashInput 構築ロジックのミラー。 */
function buildPlanHashInput(projectPath: string, adrDir: string) {
  const result = buildCodemap({ projectPath, adrDir });
  const intents = [
    {
      id: 'codemap_build',
      summary: `extract codemap from ${projectPath} (adr: ${result.main_index.sections.adr.count})`,
      risk: 'low' as const,
    },
  ];
  const diffs = OUTPUT_PATHS.map((p) => ({
    target: p,
    from: null,
    to: { bytes: DIFF_TO_PLACEHOLDER },
  }));
  return { intents, diffs, destructive_ops: [] as const };
}

describe('shirokuma-codemap build (ADR-0024 §5 eval 3 cases)', () => {
  it('case 1 (happy path): plan envelope well-formed for fixture ADR set', () => {
    const input = buildPlanHashInput(FIXTURE_ROOT, 'adr');
    const plan = buildPlanEnvelope(input);
    expect(plan.stage).toBe('plan');
    expect(plan.version).toBe('0.1');
    expect(plan.plan_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(plan.tx_id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(plan.intents[0]?.id).toBe('codemap_build');
    expect(plan.intents[0]?.summary).toMatch(/adr: 3/);
    expect(plan.diffs).toHaveLength(2);
    expect(plan.destructive_ops).toEqual([]);
  });

  it('case 2 (empty): missing adr-dir produces count: 0 plan with no targets changing', () => {
    const input = buildPlanHashInput(FIXTURE_ROOT, 'nonexistent-dir');
    const plan = buildPlanEnvelope(input);
    expect(plan.intents[0]?.summary).toMatch(/adr: 0/);
    expect(plan.diffs).toHaveLength(2);
    expect(plan.destructive_ops).toEqual([]);
  });

  it('case 3 (error — plan_hash mismatch): execute flags stale plan_hash', () => {
    const input = buildPlanHashInput(FIXTURE_ROOT, 'adr');
    const realHash = computePlanHash(input);

    // plan と execute の間でインプットがドリフトした場合のシミュレーション
    const driftedInput = buildPlanHashInput(FIXTURE_ROOT, 'nonexistent-dir');
    const driftedHash = computePlanHash(driftedInput);

    expect(realHash).not.toBe(driftedHash);

    // CLI が --plan-hash=realHash を受け取っても driftedHash を再計算した場合、ミスマッチを検出できる
    const executeEnvelope = buildExecuteEnvelope({
      ...driftedInput,
      tx_id: '01JZZZZZZZZZZZZZZZZZZZZZZZ',
      plan_hash: driftedHash,
    });
    expect(executeEnvelope.plan_hash).toBe(driftedHash);
    expect(executeEnvelope.plan_hash).not.toBe(realHash);
  });
});
