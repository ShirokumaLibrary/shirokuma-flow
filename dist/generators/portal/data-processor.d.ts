/**
 * ポータルデータプロセッサー
 *
 * JSON ファイル + overview.md を読み込んで PortalData オブジェクトを返す。
 * portal/lib/data-loader.ts の Node.js 移植版。
 */
import type { PortalData } from "./types.js";
/**
 * 出力ディレクトリから全ポータルデータを読み込む
 *
 * @param outputDir - JSON ファイルが格納されているディレクトリ
 * @param projectName - プロジェクト名
 * @param projectPath - プロジェクトルートパス（overview.md の探索に使用）
 * @returns PortalData オブジェクト
 */
export declare function loadPortalData(outputDir: string, projectName: string, projectPath: string): PortalData;
//# sourceMappingURL=data-processor.d.ts.map