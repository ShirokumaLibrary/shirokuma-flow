/**
 * coreui-vue-5 プリセット
 *
 * CoreUI Vue 5 向け fetch プリセット。
 * coreui/coreui-vue リポジトリの packages/docs/ 配下に Markdown ドキュメントを配置している。
 * components/, forms/, getting-started/, layout/ 等の使い方ガイドと api/ のリファレンスを含む。
 */
import type { DocsSourceConfig } from "../../../utils/config.js";
import type { Logger } from "../../../utils/logger.js";
import type { DocsFetchOptions } from "../fetch.js";
import { type FetchStats } from "./shared.js";
import type { StrategyMeta } from "./shared.js";
/**
 * coreui-vue-5 プリセットのメタ情報。
 * `resolvePresetMeta("coreui-vue-5")` が動的 import でこれを取得する。
 */
export declare const meta: StrategyMeta;
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export declare function execute(src: DocsSourceConfig, outDir: string, options: DocsFetchOptions, stats: FetchStats, logger: Logger): Promise<FetchStats>;
//# sourceMappingURL=coreui-vue-5.d.ts.map