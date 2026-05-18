import type { DocsSourceConfig } from './config-types.js';
import {
  countMarkdownFiles,
  discoverFilesystemSources,
  readLastFetched,
  resolveOutputDir,
} from './fs-helpers.js';

export interface SourceStatus {
  name: string;
  url?: string;
  outputDir: string;
  /** `.last-fetched` に記録された ISO 文字列。未 fetch なら null。 */
  lastFetched: string | null;
  /** `.md` / `.adoc` ファイル数（再帰）。 */
  fileCount: number;
}

export interface ListSourcesParams {
  projectPath: string;
  docsRoot?: string;
  /** config で明示されたソース一覧。未指定時は filesystem から discover する。 */
  sources?: readonly DocsSourceConfig[];
}

/**
 * fetch 済みドキュメントソースの状態を列挙する（pure data）。
 * CLI 側で JSON / テーブル整形する（ADR-0012）。
 */
export function listSources(params: ListSourcesParams): SourceStatus[] {
  const sources = params.sources ?? discoverFilesystemSources(params.projectPath, params.docsRoot);

  return sources.map((src) => {
    const outputDir = resolveOutputDir({
      projectPath: params.projectPath,
      sourceName: src.name,
      sourceOutputDir: src.outputDir,
      docsRoot: params.docsRoot,
    });
    const last = readLastFetched(outputDir);
    return {
      name: src.name,
      ...(src.url !== undefined ? { url: src.url } : {}),
      outputDir,
      lastFetched: last?.iso ?? null,
      fileCount: countMarkdownFiles(outputDir),
    };
  });
}
