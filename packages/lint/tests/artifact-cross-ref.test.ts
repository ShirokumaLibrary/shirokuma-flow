import { describe, it, expect } from 'vitest';
import {
  ARTIFACT_CROSS_REF_RULES,
  checkArtifactCrossRef,
  DEFAULT_FORBIDDEN_PATH_PATTERNS,
} from '../src/artifact-cross-ref.js';

const DEFAULTS = { forbiddenPathPatterns: DEFAULT_FORBIDDEN_PATH_PATTERNS };

describe('checkArtifactCrossRef (ADR-0027 §8)', () => {
  it('skill body referencing .shirokuma/contexts/ path emits warning', () => {
    const content =
      'See [sub-agents](../../../.shirokuma/contexts/claude-code-2/sub-agents.md) for details.';
    const result = checkArtifactCrossRef(content, '.claude/skills/pr-flow/SKILL.md', DEFAULTS);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.rule).toBe(ARTIFACT_CROSS_REF_RULES.crossRef);
    expect(result.warnings[0]?.line).toBe(1);
    expect(result.warnings[0]?.message).toContain('.shirokuma/contexts/');
    expect(result.valid).toBe(true);
  });

  it('skill body referencing .claude/rules/ path emits warning', () => {
    const content = '手順は [pr-lifecycle.md §Merge](../../rules/pr-lifecycle.md) に従う。';
    const result = checkArtifactCrossRef(content, '.claude/skills/pr-flow/SKILL.md', DEFAULTS);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.message).toContain('.claude/rules/');
  });

  it('skill body with ADR cite does not warn', () => {
    const content = '[ADR-0025](../../../docs/adr/0025-plan-first-execution.md) §2 を参照。';
    const result = checkArtifactCrossRef(content, '.claude/skills/pr-flow/SKILL.md', DEFAULTS);
    expect(result.warnings).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('skill body with external URL breadcrumb does not warn', () => {
    const content = '公式 sub-agents ドキュメント（https://code.claude.com/docs/sub-agents 参照）';
    const result = checkArtifactCrossRef(content, '.claude/skills/pr-flow/SKILL.md', DEFAULTS);
    expect(result.warnings).toHaveLength(0);
  });

  it('agent body referencing .shirokuma/rules/ path emits warning', () => {
    const content = '[tdd.md](../../.shirokuma/rules/flow/tdd.md) に従う。';
    const result = checkArtifactCrossRef(content, '.claude/agents/verify-worker.md', DEFAULTS);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.message).toContain('.shirokuma/rules/');
  });

  it('rule body (non-index) referencing another rule emits warning', () => {
    const content = '詳細は [skills-structure.md](./skills-structure.md) 参照。';
    const result = checkArtifactCrossRef(content, '.claude/rules/pr-lifecycle.md', DEFAULTS);
    expect(result.warnings).toHaveLength(1);
  });

  it('index type rule (rules-overview.md) is exempt from rule-to-rule warnings', () => {
    const content = `
- [pr-lifecycle.md](./pr-lifecycle.md)
- [skills-structure.md](./skills-structure.md)
- [tdd.md](../../.shirokuma/rules/flow/tdd.md)
`;
    const result = checkArtifactCrossRef(content, '.claude/rules/rules-overview.md', {
      ...DEFAULTS,
      indexTypeRules: ['.claude/rules/rules-overview.md'],
    });
    expect(result.warnings).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('multiple violations on different lines all surface with correct line numbers', () => {
    const content = [
      'Line 1 no issue.',
      'See [a](../../rules/pr-lifecycle.md).',
      'Line 3 no issue.',
      'Then [b](../../../.shirokuma/contexts/claude-code-2/sub-agents.md).',
    ].join('\n');
    const result = checkArtifactCrossRef(content, '.claude/skills/pr-flow/SKILL.md', DEFAULTS);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0]?.line).toBe(2);
    expect(result.warnings[1]?.line).toBe(4);
  });

  it('anchor-only links are ignored (not cross-references)', () => {
    const content = '[self-ref](#section) is fine.';
    const result = checkArtifactCrossRef(content, '.claude/skills/pr-flow/SKILL.md', DEFAULTS);
    expect(result.warnings).toHaveLength(0);
  });

  it('absolute paths starting with forbidden pattern are detected', () => {
    const content = '[abs link](/.claude/rules/pr-lifecycle.md)';
    const result = checkArtifactCrossRef(content, '.claude/skills/pr-flow/SKILL.md', DEFAULTS);
    expect(result.warnings).toHaveLength(1);
  });
});
