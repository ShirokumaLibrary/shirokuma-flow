/**
 * workflow-skill-md-size ルール
 *
 * プラグイン配下の SKILL.md の行数上限チェック:
 *   - skill-md-size: 警告閾値（warnLines）超過で warning、エラー閾値（errorLines）超過で error
 *
 * 閾値デフォルト: warnLines=250, errorLines=400
 *
 * @see Issue #2498 (feat: SKILL.md 行数ガイドライン)
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { WorkflowIssue } from "../workflow-types.js";

/** warn 閾値のデフォルト値 */
export const DEFAULT_WARN_LINES = 250;

/** デフォルトのスキャン対象プラグインディレクトリ */
export const DEFAULT_PLUGIN_DIRS = [
  "plugin/shirokuma-skills-ja",
  "plugin/shirokuma-skills-en",
];

/** error 閾値のデフォルト値 */
export const DEFAULT_ERROR_LINES = 400;

/**
 * SKILL.md の行数を検証する純粋関数。
 *
 * - lineCount <= warnLines: issue なし
 * - warnLines < lineCount <= errorLines: warning
 * - lineCount > errorLines: error
 */
export function validateSkillMdSize(
  content: string,
  filePath: string,
  warnLines: number = DEFAULT_WARN_LINES,
  errorLines: number = DEFAULT_ERROR_LINES
): WorkflowIssue[] {
  const lineCount = content.split("\n").length;

  if (lineCount <= warnLines) {
    return [];
  }

  if (lineCount > errorLines) {
    return [
      {
        type: "error",
        message: `SKILL.md exceeds error line limit: ${lineCount} lines (threshold: ${errorLines})`,
        rule: "skill-md-size",
        context: `${filePath} (${lineCount}/${errorLines} lines)`,
      },
    ];
  }

  return [
    {
      type: "warning",
      message: `SKILL.md exceeds warn line limit: ${lineCount} lines (threshold: ${warnLines})`,
      rule: "skill-md-size",
      context: `${filePath} (${lineCount}/${warnLines} lines)`,
    },
  ];
}

/**
 * 指定プラグインディレクトリ配下の全 SKILL.md を再帰スキャンして行数を検証する。
 *
 * `skills/` サブディレクトリ直下の SKILL.md のみを対象とする
 * （`reference/`, `criteria/` 等は対象外）。
 */
export function checkSkillMdSize(
  projectPath: string,
  pluginDirs: string[] = DEFAULT_PLUGIN_DIRS,
  warnLines: number = DEFAULT_WARN_LINES,
  errorLines: number = DEFAULT_ERROR_LINES
): WorkflowIssue[] {
  const issues: WorkflowIssue[] = [];

  for (const pluginDir of pluginDirs) {
    const skillsDir = join(projectPath, pluginDir, "skills");
    if (!existsSync(skillsDir)) continue;

    let skillEntries: string[];
    try {
      skillEntries = readdirSync(skillsDir);
    } catch {
      continue;
    }

    for (const skillName of skillEntries) {
      const skillPath = join(skillsDir, skillName);
      try {
        if (!statSync(skillPath).isDirectory()) continue;
      } catch {
        continue;
      }

      const skillMdPath = join(skillPath, "SKILL.md");
      let content: string;
      try {
        content = readFileSync(skillMdPath, "utf-8");
      } catch {
        continue;
      }

      // プロジェクトルートからの相対パスで報告
      const relPath = `${pluginDir}/skills/${skillName}/SKILL.md`;
      const found = validateSkillMdSize(content, relPath, warnLines, errorLines);
      issues.push(...found);
    }
  }

  return issues;
}
