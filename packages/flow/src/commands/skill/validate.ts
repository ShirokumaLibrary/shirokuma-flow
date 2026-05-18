/**
 * skill validate コマンド
 *
 * SKILL.md のフロントマター構造を検証する。
 *
 * Derived from: https://github.com/anthropics/skills/tree/main/skills/skill-creator
 * Original: scripts/quick_validate.py
 * Original licensed under Apache License 2.0 (Copyright 2025 Anthropic, PBC).
 * Modified for shirokuma-flow: ported to TypeScript with CLI integration.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ValidationResult } from "./types.js";

// SKILL.md フロントマターで許可されるプロパティ
const ALLOWED_PROPERTIES = new Set([
  "name",
  "description",
  "license",
  "allowed-tools",
  "metadata",
  "compatibility",
]);

/** 最大文字数制限 */
const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;
const MAX_COMPATIBILITY_LENGTH = 500;

/** スキルディレクトリの SKILL.md を検証する */
export function validateSkill(skillPath: string): ValidationResult {
  const resolved = resolve(skillPath);

  // SKILL.md の存在確認
  const skillMd = join(resolved, "SKILL.md");
  if (!existsSync(skillMd)) {
    return { valid: false, message: "SKILL.md not found" };
  }

  // フロントマターの存在確認
  const content = readFileSync(skillMd, "utf-8");
  if (!content.startsWith("---")) {
    return { valid: false, message: "No YAML frontmatter found" };
  }

  // フロントマターを抽出
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return { valid: false, message: "Invalid frontmatter format" };
  }

  const frontmatterText = match[1];

  // YAML を手動パース（yaml ライブラリ非依存）
  let frontmatter: Record<string, unknown>;
  try {
    frontmatter = parseSimpleYaml(frontmatterText);
  } catch (e) {
    return { valid: false, message: `Invalid YAML in frontmatter: ${e instanceof Error ? e.message : String(e)}` };
  }

  if (typeof frontmatter !== "object" || frontmatter === null) {
    return { valid: false, message: "Frontmatter must be a YAML dictionary" };
  }

  // 未知のプロパティチェック
  const unexpectedKeys = Object.keys(frontmatter).filter(k => !ALLOWED_PROPERTIES.has(k));
  if (unexpectedKeys.length > 0) {
    const allowed = [...ALLOWED_PROPERTIES].sort().join(", ");
    return {
      valid: false,
      message: `Unexpected key(s) in SKILL.md frontmatter: ${unexpectedKeys.sort().join(", ")}. Allowed properties are: ${allowed}`,
    };
  }

  // 必須フィールドチェック
  if (!("name" in frontmatter)) {
    return { valid: false, message: "Missing 'name' in frontmatter" };
  }
  if (!("description" in frontmatter)) {
    return { valid: false, message: "Missing 'description' in frontmatter" };
  }

  // name の検証
  const nameRaw = frontmatter["name"];
  if (typeof nameRaw !== "string") {
    return { valid: false, message: `Name must be a string, got ${typeof nameRaw}` };
  }
  const name = nameRaw.trim();
  if (name) {
    if (!/^[a-z0-9-]+$/.test(name)) {
      return {
        valid: false,
        message: `Name '${name}' should be kebab-case (lowercase letters, digits, and hyphens only)`,
      };
    }
    if (name.startsWith("-") || name.endsWith("-") || name.includes("--")) {
      return {
        valid: false,
        message: `Name '${name}' cannot start/end with hyphen or contain consecutive hyphens`,
      };
    }
    if (name.length > MAX_NAME_LENGTH) {
      return {
        valid: false,
        message: `Name is too long (${name.length} characters). Maximum is ${MAX_NAME_LENGTH} characters.`,
      };
    }
  }

  // description の検証
  const descRaw = frontmatter["description"];
  if (typeof descRaw !== "string") {
    return { valid: false, message: `Description must be a string, got ${typeof descRaw}` };
  }
  const description = descRaw.trim();
  if (description) {
    if (description.includes("<") || description.includes(">")) {
      return { valid: false, message: "Description cannot contain angle brackets (< or >)" };
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return {
        valid: false,
        message: `Description is too long (${description.length} characters). Maximum is ${MAX_DESCRIPTION_LENGTH} characters.`,
      };
    }
  }

  // compatibility の検証（オプション）
  const compatibility = frontmatter["compatibility"];
  if (compatibility !== undefined && compatibility !== null && compatibility !== "") {
    if (typeof compatibility !== "string") {
      return { valid: false, message: `Compatibility must be a string, got ${typeof compatibility}` };
    }
    if (compatibility.length > MAX_COMPATIBILITY_LENGTH) {
      return {
        valid: false,
        message: `Compatibility is too long (${compatibility.length} characters). Maximum is ${MAX_COMPATIBILITY_LENGTH} characters.`,
      };
    }
  }

  return { valid: true, message: "Skill is valid!" };
}

/**
 * シンプルな YAML パーサー（フラットなキーバリューのみ対応）
 * yaml ライブラリを使わずに最低限のフロントマターをパース。
 */
function parseSimpleYaml(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = text.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 空行やコメントをスキップ
    if (!line.trim() || line.trim().startsWith("#")) {
      i++;
      continue;
    }

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) {
      i++;
      continue;
    }

    const key = line.slice(0, colonIdx).trim();
    const rest = line.slice(colonIdx + 1).trim();

    // ブロックスカラー（| または >）
    if (rest === "|" || rest === ">" || rest === "|-" || rest === ">-") {
      const blockLines: string[] = [];
      i++;
      while (i < lines.length && (lines[i].startsWith("  ") || lines[i].startsWith("\t"))) {
        blockLines.push(lines[i].trim());
        i++;
      }
      result[key] = blockLines.join(rest.startsWith(">") ? " " : "\n");
      continue;
    }

    // インラインリスト: key: [a, b, c]
    if (rest.startsWith("[") && rest.endsWith("]")) {
      const items = rest.slice(1, -1).split(",").map(s => s.trim().replace(/^["']|["']$/g, ""));
      result[key] = items;
      i++;
      continue;
    }

    // ネストオブジェクト: metadata はそのまま {} として扱う
    if (rest === "" || rest === "{}") {
      // 次行がインデントされていれば子オブジェクト（今回は単純化して空オブジェクト扱い）
      if (i + 1 < lines.length && lines[i + 1].startsWith("  ")) {
        const child: Record<string, unknown> = {};
        i++;
        while (i < lines.length && lines[i].startsWith("  ")) {
          const childLine = lines[i].trim();
          const childColon = childLine.indexOf(":");
          if (childColon !== -1) {
            const ck = childLine.slice(0, childColon).trim();
            const cv = childLine.slice(childColon + 1).trim().replace(/^["']|["']$/g, "");
            child[ck] = cv;
          }
          i++;
        }
        result[key] = child;
        continue;
      }
      result[key] = {};
      i++;
      continue;
    }

    // クォート除去
    const value = rest.replace(/^["']|["']$/g, "");
    result[key] = value;
    i++;
  }

  return result;
}

// =============================================================================
// Command Handler
// =============================================================================

interface ValidateOptions {
  skillPath: string;
  verbose?: boolean;
}

export function cmdSkillValidate(options: ValidateOptions): number {
  const { skillPath, verbose } = options;

  if (verbose) {
    process.stderr.write(`Validating: ${skillPath}\n`);
  }

  const result = validateSkill(skillPath);
  process.stdout.write(result.message + "\n");

  return result.valid ? 0 : 1;
}
