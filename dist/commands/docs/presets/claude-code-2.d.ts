/**
 * claude-code プリセット
 *
 * Claude Code ドキュメント向け individual fetch プリセット。
 * code.claude.com/docs/llms.txt から各ページを個別に取得する。
 * ページ先頭の引用ブロック（> で始まる行）を除去する。
 */
import type { DocsSourceConfig } from "../../../utils/config.js";
import type { Logger } from "../../../utils/logger.js";
import type { DocsFetchOptions } from "../fetch.js";
import { type FetchStats, type IndividualStrategyMeta } from "./shared.js";
/**
 * claude-code プリセットのメタ情報。
 * `resolvePresetMeta("claude-code-2")` が動的 import でこれを取得する。
 */
export declare const meta: IndividualStrategyMeta;
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export declare function execute(src: DocsSourceConfig, outDir: string, options: DocsFetchOptions, stats: FetchStats, logger: Logger): Promise<FetchStats>;
//# sourceMappingURL=claude-code-2.d.ts.map