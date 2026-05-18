/**
 * SKILL.md フロントマターパーサーユーティリティ
 *
 * Derived from: https://github.com/anthropics/skills/tree/main/skills/skill-creator
 * Original: scripts/utils.py (parse_skill_md function)
 * Original licensed under Apache License 2.0 (Copyright 2025 Anthropic, PBC).
 * Modified for shirokuma-flow: ported to TypeScript.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

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
export function parseSkillMd(skillPath: string): SkillMdInfo {
  const skillMdPath = join(skillPath, "SKILL.md");
  const content = readFileSync(skillMdPath, "utf-8");
  const lines = content.split("\n");

  if (lines[0].trim() !== "---") {
    throw new Error("SKILL.md missing frontmatter (no opening ---)");
  }

  // 閉じ --- を探す
  let endIdx: number | null = null;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      endIdx = i;
      break;
    }
  }

  if (endIdx === null) {
    throw new Error("SKILL.md missing frontmatter (no closing ---)");
  }

  let name = "";
  let description = "";
  const frontmatterLines = lines.slice(1, endIdx);
  let i = 0;

  while (i < frontmatterLines.length) {
    const line = frontmatterLines[i];

    if (line.startsWith("name:")) {
      name = line.slice("name:".length).trim().replace(/^["']|["']$/g, "");
    } else if (line.startsWith("description:")) {
      const value = line.slice("description:".length).trim();
      // YAML ブロックスカラー対応（>, |, >-, |-）
      if (value === ">" || value === "|" || value === ">-" || value === "|-") {
        const continuationLines: string[] = [];
        i++;
        while (
          i < frontmatterLines.length &&
          (frontmatterLines[i].startsWith("  ") || frontmatterLines[i].startsWith("\t"))
        ) {
          continuationLines.push(frontmatterLines[i].trim());
          i++;
        }
        description = continuationLines.join(value.startsWith(">") ? " " : "\n");
        continue;
      } else {
        description = value.replace(/^["']|["']$/g, "");
      }
    }

    i++;
  }

  return { name, description, content };
}
