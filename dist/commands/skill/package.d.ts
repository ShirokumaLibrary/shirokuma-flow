/**
 * skill package コマンド
 *
 * スキルフォルダを .skill ファイル（zip）にパッケージ化する。
 * システムの zip コマンドを使用して zip アーカイブを作成する。
 *
 * Derived from: https://github.com/anthropics/skills/tree/main/skills/skill-creator
 * Original: scripts/package_skill.py
 * Original licensed under Apache License 2.0 (Copyright 2025 Anthropic, PBC).
 * Modified for shirokuma-docs: ported to TypeScript with CLI integration.
 *   - evals ディレクトリをルートレベルで除外
 *   - システムの zip コマンドを使用（archiver 非依存）
 */
interface PackageOptions {
    skillPath: string;
    output?: string;
    verbose?: boolean;
}
export declare function cmdSkillPackage(options: PackageOptions): number;
export {};
//# sourceMappingURL=package.d.ts.map