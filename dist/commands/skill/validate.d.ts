/**
 * skill validate コマンド
 *
 * SKILL.md のフロントマター構造を検証する。
 *
 * Derived from: https://github.com/anthropics/skills/tree/main/skills/skill-creator
 * Original: scripts/quick_validate.py
 * Original licensed under Apache License 2.0 (Copyright 2025 Anthropic, PBC).
 * Modified for shirokuma-docs: ported to TypeScript with CLI integration.
 */
import type { ValidationResult } from "./types.js";
/** スキルディレクトリの SKILL.md を検証する */
export declare function validateSkill(skillPath: string): ValidationResult;
interface ValidateOptions {
    skillPath: string;
    verbose?: boolean;
}
export declare function cmdSkillValidate(options: ValidateOptions): number;
export {};
//# sourceMappingURL=validate.d.ts.map