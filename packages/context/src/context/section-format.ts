export type SectionFormatter = (section: string, titleMap: Map<string, string>) => string;

export type SectionFormatterName = 'metadata-to-frontmatter' | 'passthrough';

/**
 * 名前から SectionFormatter 関数を解決する。未知の名前や `undefined` は `passthrough`。
 */
export function resolveSectionFormatter(name: string | undefined): SectionFormatter {
  return name === 'metadata-to-frontmatter' ? formatSectionWithMetadata : formatSectionPassthrough;
}

/** セクションをそのまま返す（整形不要）。`passthrough` 名の実装。 */
function formatSectionPassthrough(section: string): string {
  return section;
}

/**
 * `Source:` / `URL:` メタデータ行を frontmatter に変換する。
 * 対象プリセット例: drizzle, deno（full-split 時）。
 *
 * 変換内容:
 *   - 冒頭付近の `Source: <url>` / `URL: <url>` を frontmatter の `source:` に
 *   - llms.txt の対応エントリにタイトルがあれば frontmatter `title:` に
 *   - 本文中の重複 H1（title と一致するもの）を除去
 *   - `import ... from '...'` 行を除去（MDX 残留のノイズ）
 *   - タイトルがあり body に `# Title` が無ければ補完
 */
function formatSectionWithMetadata(section: string, titleMap: Map<string, string>): string {
  const urlMatch = section.match(/^(?:Source|URL):\s*(https?:\/\/\S+)/m);
  if (!urlMatch) return section;

  const sourceUrl = urlMatch[1];
  if (!sourceUrl) return section;
  const title = titleMap.get(sourceUrl);

  const bodyLines: string[] = [];
  let foundH1 = false;

  for (const line of section.split('\n')) {
    const trimmed = line.trim();
    if (/^(?:Source|URL):\s*https?:\/\//.test(trimmed)) continue;
    if (/^import\s+.+\s+from\s+['"]/.test(trimmed)) continue;

    if (!foundH1 && title && /^# .+$/.test(trimmed)) {
      const h1Text = trimmed.slice(2).trim();
      if (h1Text === title) {
        foundH1 = true;
        continue;
      }
    }

    bodyLines.push(line);
  }

  while (bodyLines.length > 0 && bodyLines[0]?.trim() === '') {
    bodyLines.shift();
  }

  const fm: string[] = ['---'];
  if (title) fm.push(`title: ${yamlDoubleQuote(title)}`);
  fm.push(`source: ${sourceUrl}`);
  fm.push('---');
  fm.push('');

  if (title && (bodyLines.length === 0 || !bodyLines[0]?.startsWith('# '))) {
    fm.push(`# ${title}`);
    fm.push('');
  }

  return fm.join('\n') + bodyLines.join('\n');
}

/**
 * YAML double-quoted scalar に変換する。`"` と `\` を backslash escape し、
 * タイトルに `He said "hi"` のような引用符が含まれても frontmatter が壊れないようにする。
 */
function yamlDoubleQuote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * セクション内容からファイル名の候補を導出し、`usedNames` と衝突しないよう
 * 必要に応じて `-N` サフィックスを付ける。
 *
 * 候補の優先順:
 *   1. frontmatter の `title:` 行
 *   2. 本文中の `# H1`
 *   3. 先頭行
 *   4. `section-{index+1}` フォールバック
 */
export function deriveSectionFilename(
  section: string,
  index: number,
  usedNames: Set<string>,
): string {
  const fallback = `section-${index + 1}`;
  const base = pickBase(section) ?? fallback;

  let name = base;
  let counter = 2;
  while (usedNames.has(name)) {
    name = `${base}-${counter}`;
    counter++;
  }
  usedNames.add(name);
  return name;
}

function pickBase(section: string): string | null {
  const titleMatch = section.match(/^title:\s*"?([^"\n]+)"?$/m);
  if (titleMatch?.[1]) return slugify(titleMatch[1]) || null;

  const h1Match = section.match(/^# (.+)$/m);
  if (h1Match?.[1]) return slugify(h1Match[1]) || null;

  const firstLine = section.split('\n')[0]?.trim();
  if (firstLine) return slugify(firstLine) || null;

  return null;
}

/** `/[^a-z0-9]+/` → `-`、先頭末尾の `-` を除去した snake-case 化。 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
