import { existsSync, readFileSync } from 'node:fs';
import type { DocsSourceConfig } from './config-types.js';
import { collectMarkdownFiles, discoverFilesystemSources, resolveOutputDir } from './fs-helpers.js';

export interface SearchMatch {
  source: string;
  file: string;
  /** 1-based 行番号。 */
  line: number;
  text: string;
  /** `context` 指定時に前後を含めた `line: text` フォーマット行の配列。 */
  context?: string[];
  /** `section: true` 指定時、マッチ行を含む見出しセクションの全文。 */
  sectionContent?: string;
}

export interface SearchParams {
  projectPath: string;
  query: string;
  docsRoot?: string;
  /** 検索対象を特定ソースに絞る（未指定時は filesystem 全探索）。 */
  source?: string;
  /** 正規表現モード（未指定時は substring 検索、大文字小文字区別なし）。 */
  regex?: boolean;
  /** 前後何行を返すか（0 なら context なし）。 */
  context?: number;
  /** 合計マッチ件数の上限。 */
  limit?: number;
  /** マッチ行を含む `^#` 見出しセクションの全文を `sectionContent` に載せる。 */
  section?: boolean;
  /**
   * config で明示されたソース一覧。未指定時は filesystem から discover する。
   * `source` 絞り込みより前に適用される。
   */
  sources?: readonly DocsSourceConfig[];
}

export interface SearchResult {
  matches: SearchMatch[];
  /** 指定 `source` が discover 結果に含まれなかった場合に true。 */
  sourceNotFound?: boolean;
}

/**
 * ローカル fetch 済みドキュメント横断検索（pure data）。
 * `query` を正規表現 / substring 検索でマッチさせ、`SearchMatch[]` を返す。
 *
 * CLI 側は `logger.error` や非 0 exit の判定をここから自由に行える。
 */
export function search(params: SearchParams): SearchResult {
  const allSources =
    params.sources ?? discoverFilesystemSources(params.projectPath, params.docsRoot);
  if (allSources.length === 0) {
    return { matches: [] };
  }

  let targets = allSources;
  if (params.source) {
    targets = allSources.filter((s) => s.name === params.source);
    if (targets.length === 0) {
      return { matches: [], sourceNotFound: true };
    }
  }

  const pattern = buildPattern(params.query, params.regex ?? false);
  const contextLines = params.context ?? 0;
  const limit = params.limit;
  const sectionMode = params.section ?? false;

  const matches: SearchMatch[] = [];
  const seenSectionKeys = new Set<string>();

  outer: for (const src of targets) {
    const outDir = resolveOutputDir({
      projectPath: params.projectPath,
      sourceName: src.name,
      sourceOutputDir: src.outputDir,
      docsRoot: params.docsRoot,
    });
    if (!existsSync(outDir)) continue;

    for (const filePath of collectMarkdownFiles(outDir)) {
      let fileContent: string | undefined;
      for (const m of searchFile(filePath, pattern, contextLines)) {
        const entry: SearchMatch = {
          source: src.name,
          file: filePath,
          line: m.line,
          text: m.text,
          context: m.context,
        };

        if (sectionMode) {
          if (fileContent === undefined) {
            try {
              fileContent = readFileSync(filePath, 'utf-8');
            } catch {
              fileContent = '';
            }
          }
          const section = extractSection(fileContent, m.line);
          const sectionKey = `${filePath}::${section.startLine}`;
          if (seenSectionKeys.has(sectionKey)) continue;
          seenSectionKeys.add(sectionKey);
          entry.sectionContent = section.content;
        }

        matches.push(entry);
        if (limit !== undefined && matches.length >= limit) break outer;
      }
    }
  }

  return { matches };
}

/**
 * 1 ファイル内を検索して行ごとのマッチを返す。`context` > 0 で前後行を付ける。
 * 読み込み失敗時は空配列（caller には読めなかった事実だけ伝わる）。
 */
export function searchFile(
  filePath: string,
  pattern: RegExp,
  contextLines: number,
): Array<{ line: number; text: string; context: string[] }> {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }
  const lines = content.split('\n');
  const results: Array<{ line: number; text: string; context: string[] }> = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!pattern.test(line)) continue;
    const ctx: string[] = [];
    if (contextLines > 0) {
      const start = Math.max(0, i - contextLines);
      const end = Math.min(lines.length - 1, i + contextLines);
      for (let j = start; j <= end; j++) {
        ctx.push(`${j + 1}: ${lines[j] ?? ''}`);
      }
    }
    results.push({ line: i + 1, text: line, context: ctx });
  }
  return results;
}

/**
 * `lineNumber`（1-based）を含む `^#` 見出しセクションの全文を抽出する。
 * 見出しが無ければファイル全体、最初の見出しより前ならファイル先頭〜最初の見出しまで。
 */
export function extractSection(
  content: string,
  lineNumber: number,
): { content: string; startLine: number } {
  const lines = content.split('\n');
  const targetIndex = lineNumber - 1;

  const headingIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^#/.test(lines[i] ?? '')) headingIndices.push(i);
  }

  if (headingIndices.length === 0) return { content, startLine: 1 };

  const firstHeading = headingIndices[0] as number;
  if (targetIndex < firstHeading) {
    return { content: lines.slice(0, firstHeading).join('\n'), startLine: 1 };
  }

  for (let i = 0; i < headingIndices.length; i++) {
    const headingIdx = headingIndices[i] as number;
    const nextHeadingIdx = headingIndices[i + 1] ?? lines.length;
    if (targetIndex < nextHeadingIdx) {
      return {
        content: lines.slice(headingIdx, nextHeadingIdx).join('\n'),
        startLine: headingIdx + 1,
      };
    }
  }
  // unreachable: headingIndices[length-1] <= targetIndex < lines.length は上で必ず return される
  /* c8 ignore next */
  return { content, startLine: 1 };
}

function buildPattern(query: string, regex: boolean): RegExp {
  if (regex) return new RegExp(query, 'i');
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped, 'i');
}
