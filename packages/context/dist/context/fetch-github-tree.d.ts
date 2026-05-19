import type { DocsFetchOptions, DocsSourceConfig } from './config-types.js';
import { type Logger } from './logger.js';
import type { FetchStats } from './stats.js';
/**
 * GitHub Tree API でファイル一覧を取得し、各ファイルを raw URL から保存する shared helper。
 *
 * 各 preset ファイル（laravel-11 / coreui-* / remix-2 ...）から呼び出す薄い共通層で、
 * preset 側は filter（除外ファイル / 言語ディレクトリ）や post-processing を各自で担う。
 * 画像処理は行わない — preset 側が `processImages` を後段で呼ぶ。
 *
 * `useSubtreeSha=true` は ENOBUFS 回避のため `repoPath` を段階的に Tree API で辿って
 * subtree SHA に解決してから recursive 取得する（巨大リポジトリ用）。
 */
export declare function fetchGithubTree(params: {
    src: DocsSourceConfig;
    outDir: string;
    options: DocsFetchOptions;
    stats: FetchStats;
    /** shallow listing から絞り込む拡張子。省略時は `['.md']`。 */
    fileExtensions?: readonly string[];
    /** basename ベースで除外するファイル名一覧。 */
    excludeFiles?: readonly string[];
    /** path 全体に対してマッチさせる除外 pattern（preset 固有の言語フィルタ等）。 */
    excludePathPattern?: RegExp;
    /** 巨大リポジトリ向けに `repoPath` を段階的 SHA 解決する。 */
    useSubtreeSha?: boolean;
    /** preset 側が meta から補う default branch（src.branch 未指定時）。 */
    defaultBranch: string;
    /** preset 側が meta から補う default repoPath（src.repoPath 未指定時）。 */
    defaultRepoPath?: string | readonly string[];
    presetName: string;
    logger?: Logger;
}): Promise<FetchStats>;
//# sourceMappingURL=fetch-github-tree.d.ts.map