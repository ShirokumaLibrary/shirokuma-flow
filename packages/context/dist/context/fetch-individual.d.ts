import type { DocsFetchOptions, DocsSourceConfig } from './config-types.js';
import { type Logger } from './logger.js';
import type { FetchStats } from './stats.js';
import type { IndividualStrategyMeta } from './types.js';
/**
 * `individual` fetch strategy の実装。
 * llms.txt 内の Markdown リンクから **ソースと同一ドメイン** の URL のみを対象に
 * 並列ではなく逐次 fetch する（shirokuma-flow 原版の挙動を維持）。
 *
 * `linkFormat` による URL 変換:
 *   - `md`: リンク URL をそのまま使用（末尾が `.md` でない場合は skip）
 *   - `clean`: 末尾 `/` を除いて `.md` を付加
 *
 * `stripHeaderPattern` / `stripLinePattern` がメタに設定されている場合、
 * 取得したファイルから該当パターンを除去してから保存し直す。
 *
 * 画像処理 (`processImages`) は **呼び出さない** — caller が必要に応じて
 * 別途実行する設計（1 つの関数に責務を集約しない）。
 */
export declare function fetchIndividual(params: {
    src: DocsSourceConfig;
    outDir: string;
    options: DocsFetchOptions;
    stats: FetchStats;
    llmsContent: string;
    meta: IndividualStrategyMeta;
    logger?: Logger;
}): Promise<FetchStats>;
//# sourceMappingURL=fetch-individual.d.ts.map