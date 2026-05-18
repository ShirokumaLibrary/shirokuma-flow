/**
 * Frontmatter Validator
 *
 * YAML front matter の解析と検証
 */

import { parse as parseYaml } from "yaml";
import type { FrontmatterFieldRule } from "../lint/docs-types.js";

/**
 * 解析されたフロントマター
 */
export interface ParsedFrontmatter {
  /** フロントマターが存在するか */
  hasFrontmatter: boolean;
  /** 解析されたデータ */
  data?: Record<string, unknown>;
  /** 解析エラー */
  parseError?: string;
  /** フロントマター後のコンテンツ */
  content: string;
}

/**
 * フィールド検証結果
 */
export interface FieldValidationResult {
  /** 有効か */
  valid: boolean;
  /** エラーメッセージ */
  error?: string;
}

/**
 * フロントマターを解析する
 */
export function parseFrontmatter(content: string): ParsedFrontmatter {
  // フロントマターパターン: 先頭の --- から次の --- まで
  // 空のフロントマターもサポート
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?|^---\r?\n---\r?\n?/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return {
      hasFrontmatter: false,
      content: content,
    };
  }

  const yamlContent = match[1] || "";
  const remainingContent = content.slice(match[0].length);

  // 空のフロントマターの場合
  if (!yamlContent.trim()) {
    return {
      hasFrontmatter: true,
      data: {},
      content: remainingContent,
    };
  }

  try {
    const data = (parseYaml(yamlContent) as Record<string, unknown> | null) ?? {};
    return {
      hasFrontmatter: true,
      data,
      content: remainingContent,
    };
  } catch (error) {
    return {
      hasFrontmatter: true,
      parseError: error instanceof Error ? error.message : String(error),
      content: remainingContent,
    };
  }
}

/**
 * フロントマターフィールドを検証する
 */
export function validateFrontmatterField(
  data: Record<string, unknown>,
  field: FrontmatterFieldRule
): FieldValidationResult {
  const value = data[field.name];

  // フィールドが存在するかチェック
  if (value === undefined) {
    return {
      valid: false,
      error: `Missing required field: ${field.name}`,
    };
  }

  // 許容値リストがある場合はチェック
  if (field.values && field.values.length > 0) {
    const stringValue = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : JSON.stringify(value);
    if (!field.values.includes(stringValue)) {
      return {
        valid: false,
        error: `Invalid value "${stringValue}" for field "${field.name}". Allowed values: ${field.values.join(", ")}`,
      };
    }
  }

  // 日付フォーマットがある場合はチェック
  if (field.format) {
    if (!validateDateFormat(value, field.format)) {
      return {
        valid: false,
        error: `Invalid date format for field "${field.name}". Expected format: ${field.format}`,
      };
    }
  }

  return { valid: true };
}

/**
 * 日付フォーマットを検証する
 */
export function validateDateFormat(
  value: unknown,
  format: string | undefined
): boolean {
  if (!format) {
    return true;
  }

  // Date オブジェクトの場合は文字列に変換
  let dateStr: string;
  if (value instanceof Date) {
    dateStr = value.toISOString().split("T")[0];
  } else {
    dateStr = String(value);
  }

  if (format === "YYYY-MM-DD") {
    // YYYY-MM-DD 形式を検証
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) {
      return false;
    }

    // 実際の日付として有効かチェック
    const [year, month, day] = dateStr.split("-").map(Number);

    // 月の範囲チェック
    if (month < 1 || month > 12) {
      return false;
    }

    // 日の範囲チェック
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day < 1 || day > daysInMonth) {
      return false;
    }

    return true;
  }

  // その他のフォーマットは未対応のため true を返す
  return true;
}
