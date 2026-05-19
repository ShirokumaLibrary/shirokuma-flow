/**
 * typescript-5 プリセット
 *
 * TypeScript 向け fetch プリセット。
 * microsoft/TypeScript-Website モノレポの複数パッケージに分散した
 * 英語ドキュメントを統合取得する。
 *
 * 対象パッケージ:
 * - packages/documentation/copy/en/  (handbook, reference, tutorials 等)
 * - packages/tsconfig-reference/copy/en/  (tsconfig オプションリファレンス)
 * - packages/glossary/copy/en/  (用語集)
 *
 * 注意:
 * - デフォルトブランチは v2（main ではない）
 * - ファイル名にスペースを含む（URL エンコードが必要）
 */
import type { DocsSourceConfig } from "../../../utils/config.js";
import type { Logger } from "../../../utils/logger.js";
import type { DocsFetchOptions } from "../fetch.js";
import { type FetchStats } from "./shared.js";
import type { StrategyMeta } from "./shared.js";
/**
 * typescript-5 プリセットのメタ情報。
 * `resolvePresetMeta("typescript-5")` が動的 import でこれを取得する。
 */
export declare const meta: StrategyMeta;
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export declare function execute(src: DocsSourceConfig, outDir: string, options: DocsFetchOptions, stats: FetchStats, logger: Logger): Promise<FetchStats>;
//# sourceMappingURL=typescript-5.d.ts.map