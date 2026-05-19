/**
 * SKILL.md フロントマターパーサーユーティリティ
 *
 * Derived from: https://github.com/anthropics/skills/tree/main/skills/skill-creator
 * Original: scripts/utils.py (parse_skill_md function)
 * Original licensed under Apache License 2.0 (Copyright 2025 Anthropic, PBC).
 * Modified for shirokuma-docs: ported to TypeScript.
 */
export interface SkillMdInfo {
    /** スキル名 */
    name: string;
    /** スキルの説明 */
    description: string;
    /** SKILL.md の全コンテンツ */
    content: string;
}
/**
 * SKILL.md ファイルをパースして name, description, 全コンテンツを返す。
 *
 * @param skillPath SKILL.md を含むスキルディレクトリのパス
 * @throws SKILL.md が存在しない場合、またはフロントマターが不正な場合
 */
export declare function parseSkillMd(skillPath: string): SkillMdInfo;
//# sourceMappingURL=skill-md-parser.d.ts.map