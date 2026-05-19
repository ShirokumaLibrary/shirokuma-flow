/**
 * supabase-2 プリセット
 *
 * Supabase 向け fetch プリセット。
 * supabase/supabase リポジトリの apps/docs/content/guides ディレクトリに
 * MDX ドキュメントが配置されている。
 *
 * ルートから recursive=1 すると ENOBUFS が発生するため、
 * GitHub Tree API を段階的に辿って guides サブツリーの SHA を解決し、
 * そのサブツリーに対して recursive=1 を適用してファイル一覧を取得する。
 */
import type { DocsSourceConfig } from "../../../utils/config.js";
import type { Logger } from "../../../utils/logger.js";
import type { DocsFetchOptions } from "../fetch.js";
import { type FetchStats } from "./shared.js";
import type { StrategyMeta } from "./shared.js";
/**
 * supabase-2 プリセットのメタ情報。
 * `resolvePresetMeta("supabase-2")` が動的 import でこれを取得する。
 */
export declare const meta: StrategyMeta;
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export declare function execute(src: DocsSourceConfig, outDir: string, options: DocsFetchOptions, stats: FetchStats, logger: Logger): Promise<FetchStats>;
//# sourceMappingURL=supabase-2.d.ts.map