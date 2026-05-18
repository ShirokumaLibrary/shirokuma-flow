/**
 * aws-cli-2 プリセット。サイト固有の微調整が必要になればここに追記する。
 *
 * docs.aws.amazon.com/cli/latest/userguide/llms.txt のセクション構造を自力パースし、
 * 各 HTML ページを fetch → `turndown` で Markdown 変換してセクション別サブディレクトリに
 * 保存する。AWS docs は llms.txt がリンク先を `.html` で提供するため、他 preset の
 * linkFormat/fetchIndividual の枠組みに乗らない。
 */

import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import TurndownService from 'turndown';
import { writeLastFetched } from '../fetch-markdown.js';
import { PRESETS } from '../presets.js';
import type { FetchStats } from '../stats.js';
import type { PresetExecuteParams } from './types.js';

const meta = PRESETS['aws-cli-2'];

/** 同時 HTML fetch 数の上限。AWS docs サーバー負荷を抑える。 */
const CONCURRENCY = 5;

/** fetch 失敗の閾値：超過したら後続タスクを早期 failed 扱いにする。 */
const FAILURE_THRESHOLD = 50;

interface SectionEntry {
  dir: string;
  pages: Array<{ title: string; url: string }>;
}

export async function execute(params: PresetExecuteParams): Promise<FetchStats> {
  const { src, outDir, options, stats, logger } = params;
  const llmsUrl = src.url ?? meta.url;

  logger.info(`[${src.name}] llms.txt を取得中: ${llmsUrl}`);
  let llmsContent: string;
  try {
    const res = await fetch(llmsUrl);
    if (!res.ok) {
      logger.error(`[${src.name}] llms.txt の取得に失敗しました: ${llmsUrl} (${res.status})`);
      return stats;
    }
    llmsContent = await res.text();
  } catch (err) {
    logger.error(`[${src.name}] llms.txt の取得に失敗: ${String(err)}`);
    return stats;
  }

  if (!options.dryRun) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'llms.txt'), llmsContent, 'utf-8');
  }

  const sections = parseLlmsTxtSections(llmsContent);
  const totalPages = sections.reduce((sum, s) => sum + s.pages.length, 0);
  logger.info(`[${src.name}] ${sections.length} セクション、${totalPages} ページを検出しました。`);

  if (options.dryRun) {
    logger.info(`[${src.name}] Dry-run: 以下のページを取得予定:`);
    for (const section of sections) {
      for (const page of section.pages) {
        logger.info(`  [${section.dir}] ${page.title}: ${page.url}`);
      }
    }
    return stats;
  }

  mkdirSync(outDir, { recursive: true });
  const td = createTurndownService();

  type PageTask = {
    section: SectionEntry;
    page: { title: string; url: string };
    outFile: string;
  };

  const pageTasks: PageTask[] = [];
  for (const section of sections) {
    for (const page of section.pages) {
      const outFile = join(outDir, section.dir, `${slugifyTitle(page.title)}.md`);
      pageTasks.push({ section, page, outFile });
    }
  }

  for (const dir of new Set(pageTasks.map((t) => join(outDir, t.section.dir)))) {
    mkdirSync(dir, { recursive: true });
  }

  // 並行実行中は `stats.failed` を参照しても post-loop tally 前なので 0 のまま。
  // FAILURE_THRESHOLD の早期打ち切りを機能させるため、並行実行内で共有する
  // `liveFailures` カウンタをタスク側で直接更新する。
  let liveFailures = 0;

  const fetchTasks = pageTasks.map(
    (task) => async (): Promise<'downloaded' | 'skipped' | 'failed'> => {
      if (liveFailures >= FAILURE_THRESHOLD) return 'failed';

      if (!options.force && !(await remoteIsNewerThanLocal(task.page.url, task.outFile))) {
        return 'skipped';
      }

      try {
        const res = await fetch(task.page.url);
        if (!res.ok) {
          logger.debug?.(`[${src.name}] FAILED (${res.status}): ${task.page.url}`);
          liveFailures++;
          return 'failed';
        }
        const html = await res.text();
        writeFileSync(task.outFile, htmlToMarkdown(html, td), 'utf-8');
        return 'downloaded';
      } catch (err) {
        logger.debug?.(`[${src.name}] FAILED: ${task.page.url} — ${String(err)}`);
        liveFailures++;
        return 'failed';
      }
    },
  );

  const results = await runWithConcurrency(fetchTasks, CONCURRENCY);

  for (const result of results) {
    if (result === 'downloaded') stats.downloaded++;
    else if (result === 'skipped') stats.skipped++;
    else stats.failed++;
  }

  if (stats.failed >= FAILURE_THRESHOLD) {
    logger.error(
      `[${src.name}] fetch 失敗が閾値 (${FAILURE_THRESHOLD}) を超えました。` +
        ' ネットワーク接続またはドキュメント URL を確認してください。',
    );
  }

  writeLastFetched(outDir);
  return stats;
}

/**
 * llms.txt の AWS CLI 方言をパースする。
 *   `## [section](url)` または `## section` でセクション開始
 *   `- [title](*.html)` でページエントリ
 */
export function parseLlmsTxtSections(content: string): SectionEntry[] {
  const sections: SectionEntry[] = [];
  let current: SectionEntry | null = null;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    const sectionMatch =
      trimmed.match(/^##\s+\[([^\]]+)\]\(([^)]+)\)/) ?? trimmed.match(/^##\s+(.+)/);
    if (sectionMatch?.[1]) {
      if (current) sections.push(current);
      current = { dir: slugifySection(sectionMatch[1]), pages: [] };
      continue;
    }

    if (!current) continue;
    const pageMatch = trimmed.match(/^-\s+\[([^\]]+)\]\((https?:\/\/[^)]+\.html)\)/);
    if (pageMatch?.[1] && pageMatch[2]) {
      current.pages.push({ title: pageMatch[1], url: pageMatch[2] });
    }
  }

  if (current) sections.push(current);
  return sections;
}

/** セクション名からディレクトリ名を作る。冗長な "AWS CLI " / "AWS " プレフィックスは除去。 */
function slugifySection(name: string): string {
  const cleaned = name
    .replace(/^AWS CLI\s+/i, '')
    .replace(/^AWS\s+/i, '')
    .trim();
  return (
    cleaned
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  );
}

function slugifyTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'page'
  );
}

function createTurndownService(): TurndownService {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    fence: '```',
    bulletListMarker: '-',
  });

  // pre > code をフェンス化。tsconfig に DOM lib が無いので unknown 経由でアクセス。
  td.addRule('fenced-code-block', {
    filter: (node) => {
      const child = node.firstChild as unknown as { nodeName?: string } | null;
      return node.nodeName === 'PRE' && child !== null && child?.nodeName === 'CODE';
    },
    replacement: (_content, node) => {
      const code = node.firstChild as unknown as {
        getAttribute?: (attr: string) => string | null;
        textContent?: string | null;
      };
      const classAttr = code?.getAttribute?.('class') ?? '';
      const langMatch = classAttr.match(/language-(\S+)/);
      const lang = langMatch?.[1] ?? '';
      const text = code?.textContent ?? '';
      return `\n\`\`\`${lang}\n${text}\n\`\`\`\n`;
    },
  });

  return td;
}

/**
 * AWS docs HTML から main コンテンツ領域を抽出し、ボイラープレートを剥がして Markdown 化する。
 */
export function htmlToMarkdown(html: string, td: TurndownService): string {
  let content = html;

  const mainPatterns = [
    /<div[^>]+id=["']main-content["'][^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]+id=["'](?:feedback|footer))/,
    /<article[^>]*>([\s\S]*?)<\/article>/,
    /<main[^>]*>([\s\S]*?)<\/main>/,
  ];

  for (const pattern of mainPatterns) {
    const match = html.match(pattern);
    if (match?.[1] !== undefined) {
      content = match[1];
      break;
    }
  }

  content = content
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<div[^>]+(?:id|class)=["'][^"']*feedback[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+awsui[^>]*>[\s\S]*?<\/[^>]+>/gi, '');

  return td.turndown(content).trim();
}

/**
 * HEAD で Last-Modified を確認し、リモートがローカル mtime より新しいかを返す。
 * Last-Modified が取れない / HEAD 失敗時は `true`（＝取得し直す）を返す（aws-cli-2 は
 * CDN が Last-Modified を返さない場合があり、保守的に再取得する）。
 */
async function remoteIsNewerThanLocal(url: string, outFile: string): Promise<boolean> {
  let localMtime: Date;
  try {
    localMtime = statSync(outFile).mtime;
  } catch {
    return true;
  }

  try {
    const headRes = await fetch(url, { method: 'HEAD' });
    const lastModified = headRes.headers.get('last-modified');
    if (!lastModified) return true;
    return new Date(lastModified) > localMtime;
  } catch {
    return true;
  }
}

/**
 * タスク配列を `concurrency` 上限で並行実行する。JS のシングルスレッド性により
 * `index++` はアトミックなので共有 counter に排他制御不要。
 */
async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < tasks.length) {
      const i = index++;
      const task = tasks[i];
      if (!task) break;
      results[i] = await task();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
