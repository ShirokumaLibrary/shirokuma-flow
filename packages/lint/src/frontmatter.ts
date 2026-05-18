import { parse as parseYaml } from 'yaml';
import type { FrontmatterFieldRule } from './docs-types.js';

export interface ParsedFrontmatter {
  hasFrontmatter: boolean;
  data?: Record<string, unknown>;
  parseError?: string;
  content: string;
}

export interface FieldValidationResult {
  valid: boolean;
  error?: string;
}

export function parseFrontmatter(content: string): ParsedFrontmatter {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?|^---\r?\n---\r?\n?/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { hasFrontmatter: false, content };
  }

  const yamlContent = match[1] ?? '';
  const remaining = content.slice(match[0].length);

  if (!yamlContent.trim()) {
    return { hasFrontmatter: true, data: {}, content: remaining };
  }

  try {
    const data = (parseYaml(yamlContent) as Record<string, unknown> | null) ?? {};
    return { hasFrontmatter: true, data, content: remaining };
  } catch (err) {
    return {
      hasFrontmatter: true,
      parseError: err instanceof Error ? err.message : String(err),
      content: remaining,
    };
  }
}

export function validateFrontmatterField(
  data: Record<string, unknown>,
  field: FrontmatterFieldRule,
): FieldValidationResult {
  const value = data[field.name];

  if (value === undefined) {
    return { valid: false, error: `Missing required field: ${field.name}` };
  }

  if (field.values && field.values.length > 0) {
    const stringValue =
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : JSON.stringify(value);
    if (!field.values.includes(stringValue)) {
      return {
        valid: false,
        error: `Invalid value "${stringValue}" for field "${field.name}". Allowed values: ${field.values.join(', ')}`,
      };
    }
  }

  if (field.format && !validateDateFormat(value, field.format)) {
    return {
      valid: false,
      error: `Invalid date format for field "${field.name}". Expected format: ${field.format}`,
    };
  }

  return { valid: true };
}

export function validateDateFormat(value: unknown, format: string): boolean {
  const dateStr = value instanceof Date ? (value.toISOString().split('T')[0] ?? '') : String(value);

  if (format === 'YYYY-MM-DD') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    const [y, m, d] = dateStr.split('-').map(Number);
    if (y === undefined || m === undefined || d === undefined) return false;
    if (m < 1 || m > 12) return false;
    const daysInMonth = new Date(y, m, 0).getDate();
    if (d < 1 || d > daysInMonth) return false;
    return true;
  }

  return true;
}
