/**
 * skill package コマンド
 *
 * スキルフォルダを .skill ファイル（zip）にパッケージ化する。
 * システムの zip コマンドを使用して zip アーカイブを作成する。
 *
 * Derived from: https://github.com/anthropics/skills/tree/main/skills/skill-creator
 * Original: scripts/package_skill.py
 * Original licensed under Apache License 2.0 (Copyright 2025 Anthropic, PBC).
 * Modified for shirokuma-flow: ported to TypeScript with CLI integration.
 *   - evals ディレクトリをルートレベルで除外
 *   - システムの zip コマンドを使用（archiver 非依存）
 */

import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { validateSkill } from "./validate.js";

// パッケージ時に除外するディレクトリ（再帰的）
const EXCLUDE_DIRS = new Set(["__pycache__", "node_modules"]);
// パッケージ時に除外するファイル名
const EXCLUDE_FILES = new Set([".DS_Store"]);
// 除外するファイル拡張子
const EXCLUDE_EXTS = new Set([".pyc"]);
// スキルルートのみで除外するディレクトリ
const ROOT_EXCLUDE_DIRS = new Set(["evals"]);

interface PackageOptions {
  skillPath: string;
  output?: string;
  verbose?: boolean;
}

/**
 * ファイルパスが除外対象かを判定する。
 *
 * @param fullPath ファイルのフルパス
 * @param skillPath スキルディレクトリのフルパス
 * @returns 除外する場合 true
 */
function shouldExclude(fullPath: string, skillPath: string): boolean {
  const rel = relative(skillPath, fullPath);
  const parts = rel.split("/");

  // 再帰的除外ディレクトリ
  for (const part of parts) {
    if (EXCLUDE_DIRS.has(part)) return true;
  }

  // ルートレベルのみの除外ディレクトリ（parts[0] がルート直下）
  if (parts.length >= 1 && ROOT_EXCLUDE_DIRS.has(parts[0])) return true;

  // ファイル名とパス
  const fileName = basename(fullPath);
  if (EXCLUDE_FILES.has(fileName)) return true;

  // 拡張子
  const dotIdx = fileName.lastIndexOf(".");
  if (dotIdx !== -1 && EXCLUDE_EXTS.has(fileName.slice(dotIdx))) return true;

  return false;
}

/**
 * ディレクトリを再帰的に走査してファイルリストを返す。
 */
function collectFiles(dirPath: string, skillPath: string): string[] {
  const files: string[] = [];

  const entries = readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (shouldExclude(fullPath, skillPath)) continue;

    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, skillPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

export function cmdSkillPackage(options: PackageOptions): number {
  const { output, verbose } = options;
  const skillPath = resolve(options.skillPath);

  // スキルディレクトリの存在確認
  if (!existsSync(skillPath)) {
    process.stderr.write(`Error: Skill folder not found: ${skillPath}\n`);
    return 1;
  }

  const stat = statSync(skillPath);
  if (!stat.isDirectory()) {
    process.stderr.write(`Error: Path is not a directory: ${skillPath}\n`);
    return 1;
  }

  // SKILL.md の存在確認
  const skillMd = join(skillPath, "SKILL.md");
  if (!existsSync(skillMd)) {
    process.stderr.write(`Error: SKILL.md not found in ${skillPath}\n`);
    return 1;
  }

  // バリデーション実行
  process.stdout.write("Validating skill...\n");
  const validation = validateSkill(skillPath);
  if (!validation.valid) {
    process.stderr.write(`Validation failed: ${validation.message}\n`);
    process.stderr.write("Please fix the validation errors before packaging.\n");
    return 1;
  }
  process.stdout.write(`${validation.message}\n\n`);

  // 出力ディレクトリの決定
  const skillName = basename(skillPath);
  const outputDir = output ? resolve(output) : process.cwd();
  mkdirSync(outputDir, { recursive: true });
  const outputFile = join(outputDir, `${skillName}.skill`);

  // パッケージ対象ファイルを収集
  const files = collectFiles(skillPath, skillPath);

  if (verbose) {
    for (const f of files) {
      const rel = relative(skillPath, f);
      process.stdout.write(`  Adding: ${skillName}/${rel}\n`);
    }
  }

  // zip コマンドで圧縮（skillPath の親ディレクトリを基準に実行）
  const parentDir = join(skillPath, "..");
  const relativePaths = files.map(f => join(skillName, relative(skillPath, f)));

  // zip コマンドが利用可能かチェック
  const zipCheck = spawnSync("which", ["zip"], { encoding: "utf-8" });
  if (zipCheck.status !== 0) {
    process.stderr.write("Error: 'zip' コマンドが見つかりません。システムに zip をインストールしてください。\n");
    return 1;
  }

  const result = spawnSync(
    "zip",
    ["-r", outputFile, ...relativePaths],
    {
      cwd: parentDir,
      encoding: "utf-8",
      maxBuffer: 100 * 1024 * 1024,
    }
  );

  if (result.status !== 0) {
    process.stderr.write(`Error creating .skill file: ${result.stderr || result.error?.message}\n`);
    return 1;
  }

  process.stdout.write(`\nSuccessfully packaged skill to: ${outputFile}\n`);
  return 0;
}
