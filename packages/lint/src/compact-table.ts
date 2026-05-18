import type { DocIssue, DocValidationResult } from './docs-types.js';

export const COMPACT_TABLE_RULES = {
  cell: 'compact-table',
  leadingIndent: 'compact-table-leading-indent',
} as const;

const TABLE_LINE_RE = /^\s*\|.*\|\s*$/;
const FENCE_RE = /^\s*(```|~~~)/;
const SEPARATOR_CELL_RE = /^\s*:?-+:?\s*$/;
const VALID_SEPARATOR_CELL_FORMS = new Set([' --- ', ' :-- ', ' --: ', ' :-: ']);
const LIST_ITEM_RE = /^(\s*)([-*+]|\d+\.)\s/;

function splitRowCells(inner: string): string[] {
  const cells: string[] = [];
  let current = '';
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '\\' && inner[i + 1] === '|') {
      current += '\\|';
      i += 1;
      continue;
    }
    if (inner[i] === '|') {
      cells.push(current);
      current = '';
      continue;
    }
    current += inner[i];
  }
  cells.push(current);
  return cells;
}

function isCompactContentCell(cell: string): boolean {
  if (cell === ' ') return true;
  if (cell.length < 3) return false;
  if (cell[0] !== ' ' || cell[cell.length - 1] !== ' ') return false;
  const content = cell.slice(1, -1);
  if (content.length === 0) return false;
  if (content.startsWith(' ') || content.endsWith(' ')) return false;
  return true;
}

function isCompactSeparatorCell(cell: string): boolean {
  return VALID_SEPARATOR_CELL_FORMS.has(cell);
}

function isSeparatorRow(cells: string[]): boolean {
  if (cells.length === 0) return false;
  return cells.every((c) => SEPARATOR_CELL_RE.test(c));
}

function leadingSpaceCount(line: string): number {
  const match = /^(\s*)/.exec(line);
  const captured = match?.[1];
  return captured?.length ?? 0;
}

function checkTableRow(line: string, filePath: string, lineNumber: number): DocIssue[] {
  const errors: DocIssue[] = [];
  const inner = line.replace(/\s+$/, '').slice(1, -1);
  const cells = splitRowCells(inner);
  const sep = isSeparatorRow(cells);
  const check = sep ? isCompactSeparatorCell : isCompactContentCell;
  for (const cell of cells) {
    if (check(cell)) continue;
    errors.push({
      type: 'error',
      message: sep
        ? `Non-compact separator cell: "${cell}" (expected " --- " / " :-- " / " --: " / " :-: ")`
        : `Non-compact content cell: "${cell}" (expected single-space padding; empty cell = " ")`,
      file: filePath,
      line: lineNumber,
      rule: COMPACT_TABLE_RULES.cell,
    });
    break;
  }
  return errors;
}

export function checkCompactTables(content: string, filePath: string): DocValidationResult {
  const result: DocValidationResult = { valid: true, errors: [], warnings: [], infos: [] };
  const lines = content.split('\n');
  let inCode = false;
  // Content indent of the nearest enclosing list item, or null if not in a list.
  // "Content indent" = marker column + marker width + 1 space.
  let listContentIndent: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (FENCE_RE.test(line)) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;

    if (!TABLE_LINE_RE.test(line)) {
      // Update list context based on the non-table line.
      const listMatch = LIST_ITEM_RE.exec(line);
      const indent = listMatch?.[1];
      const marker = listMatch?.[2];
      if (indent !== undefined && marker !== undefined) {
        listContentIndent = indent.length + marker.length + 1;
        continue;
      }
      if (/^\s*$/.test(line)) {
        // Blank — preserve current list context (list items may have blank-line gaps).
        continue;
      }
      // Non-blank, non-list: check if still a list continuation.
      if (listContentIndent !== null && leadingSpaceCount(line) < listContentIndent) {
        listContentIndent = null;
      }
      continue;
    }

    const leading = leadingSpaceCount(line);
    const listNested = leading > 0 && listContentIndent !== null && leading >= listContentIndent;

    if (leading > 0 && !listNested) {
      result.valid = false;
      result.errors.push({
        type: 'error',
        message: 'Table row must start at column 0 (no leading whitespace)',
        file: filePath,
        line: i + 1,
        rule: COMPACT_TABLE_RULES.leadingIndent,
      });
      continue;
    }

    const bodyLine = listNested ? line.slice(leading) : line;
    const cellErrors = checkTableRow(bodyLine, filePath, i + 1);
    if (cellErrors.length > 0) {
      result.valid = false;
      result.errors.push(...cellErrors);
    }
  }

  return result;
}
