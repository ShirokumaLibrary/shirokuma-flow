import type { Logger } from './logger.js';
import type { FetchStats } from './stats.js';
/**
 * SVG → Mermaid 変換ハンドラ。
 * ADR-0013 準拠のため本パッケージは子プロセスを起動せず、呼び出し側が
 * `claude` CLI 等を用いた変換を注入する。戻り値 `true` で `{name}.mermaid.md`
 * への書き出しが成功した扱いとし `stats.svgConverted` を加算する。
 */
export type SvgConverter = (svgFilePath: string) => boolean | Promise<boolean>;
export interface ProcessImagesParams {
    outDir: string;
    force: boolean;
    stats: FetchStats;
    logger: Logger;
    sourceName: string;
    svgConverter?: SvgConverter;
    /** SVG 変換数の上限（既定 20）。超過分は `svgKept` として残す */
    maxSvgConversions?: number;
}
/**
 * `outDir` 内の `.md` ファイルに含まれる画像 URL を取得し、同ディレクトリに
 * 保存したうえで本文のリンクを `./{localName}` に書き換える。
 * SVG は `svgConverter` が与えられている場合のみ変換を試み、未提供または
 * 失敗時は `stats.svgKept` としてそのまま残す。ADR-0013 準拠。
 */
export declare function processImages(params: ProcessImagesParams): Promise<void>;
//# sourceMappingURL=process-images.d.ts.map