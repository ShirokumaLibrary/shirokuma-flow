import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export interface AdrEntry {
  number: string;
  title: string;
  status: string | null;
  date: string | null;
  path: string;
}

const FILE_RE = /^(\d{4})-[^/]+\.md$/;
const H1_RE = /^#\s+(?:ADR-\d+:\s*)?(.+?)\s*$/m;

/**
 * `- **Key**: value` または `- Key: value` の bullet 行から最初のマッチを返す。
 * ADR は全 body を parse すると metadata 外の bullet（例: Context §リスト）が
 * 誤マッチしやすいので、H1 と最初の `##` の間の region に絞ってから抽出する。
 */
function extractBulletField(region: string, key: string): string | null {
  const pattern = new RegExp(`^-\\s+(?:\\*\\*)?${key}(?:\\*\\*)?:\\s*(.+?)\\s*$`, 'm');
  const m = pattern.exec(region);
  return m && m[1] ? m[1].trim() : null;
}

function metadataRegion(content: string): string {
  const afterH1 = content.replace(/^[\s\S]*?^#\s+.+?$/m, '');
  const stopAt = afterH1.search(/^##\s/m);
  return stopAt === -1 ? afterH1 : afterH1.slice(0, stopAt);
}

function isEnoent(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'ENOENT';
}

export function extractAdrIndex(dir: string): AdrEntry[] {
  let files: string[];
  try {
    files = readdirSync(dir);
  } catch (err) {
    if (isEnoent(err)) return [];
    throw err;
  }

  const entries: AdrEntry[] = [];
  for (const file of files) {
    const m = FILE_RE.exec(file);
    if (!m || m[1] === undefined) continue;
    const number = m[1];

    let content: string;
    try {
      content = readFileSync(join(dir, file), 'utf8');
    } catch (err) {
      if (isEnoent(err)) continue;
      throw err;
    }

    const titleMatch = H1_RE.exec(content);
    const title = titleMatch && titleMatch[1] ? titleMatch[1].trim() : file;
    const region = metadataRegion(content);
    const status = extractBulletField(region, 'Status');
    const date = extractBulletField(region, 'Date');

    entries.push({ number, title, status, date, path: file });
  }

  entries.sort((a, b) => a.number.localeCompare(b.number));
  return entries;
}
