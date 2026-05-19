import type { Logger } from './logger.js';
export type FetchResult = 'downloaded' | 'skipped' | 'failed';
/**
 * Markdown ファイルを取得し、outFile に書き出す。
 * インクリメンタル戦略:
 *   - `force=false` かつ既存ファイル有り:
 *     1. HEAD リクエストで `Last-Modified` を取得
 *     2. 取得できた場合はローカル mtime と比較し、サーバ側が新しくなければ skipped
 *     3. `Last-Modified` が無い / HEAD に失敗した場合は skipped（= 変更検知できず
 *        安全側で再取得を抑制する）。CDN が `Last-Modified` を落とすソースでは
 *        `force=true` での明示再取得が必要になるのは既知のトレードオフ。
 *   - `force=true` または新規ファイル: GET で取得して書き込む
 *
 * ネットワーク / HTTP 失敗時は "failed" を返し、例外は呼び出し元に投げない。
 * `logger` を渡すと失敗理由を warn/debug で出力する（未指定なら silent）。
 */
export declare function fetchMarkdown(url: string, outFile: string, force: boolean, logger?: Logger): Promise<FetchResult>;
/**
 * 出力ディレクトリに `.last-fetched` タイムスタンプを書き込む。
 * `list` コマンド等で fetch 履歴を表示するために利用する。
 */
export declare function writeLastFetched(outDir: string): void;
/**
 * llms.txt を取得して `docsRoot/{sourceName}-llms.txt` に保存し、内容を返す。
 * `individual` / `full-split` の preset execute から共通で呼ぶ helper。
 *
 * 既存ファイルは常に上書き（llms.txt はインデックスなのでインクリメンタル判定は不要）。
 * `dryRun=true` の場合は書き込みをスキップするが取得は行う。
 *
 * 例外は throw する（呼び出し元は try/catch で preset 単位に失敗を閉じ込める想定）。
 */
export declare function fetchAndSaveLlmsTxt(sourceName: string, llmsUrl: string, docsRoot: string, dryRun: boolean): Promise<string>;
//# sourceMappingURL=fetch-markdown.d.ts.map