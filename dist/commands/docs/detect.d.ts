/**
 * docs detect subcommand - package.json の依存関係からドキュメントソースを自動検出
 *
 * package.json の dependencies + devDependencies を読み取り、
 * 全プリセットの packageNames マッピングで依存名 → プリセット名を逆引きする。
 * .last-fetched の存在で status を判定する。
 */
import type { Logger } from "../../utils/logger.js";
export interface DocsDetectOptions {
    project?: string;
    format?: "table-json" | "json";
    verbose?: boolean;
}
/**
 * 検出結果の各エントリのステータス。
 * - ready: fetch 済み（ローカルに .last-fetched が存在する）
 * - not-fetched: 未 fetch（ローカルディレクトリなし、または .last-fetched なし）
 */
export type DetectStatus = "ready" | "not-fetched";
export interface DetectResult {
    /** プリセット名（ソース名） */
    source: string;
    /** マッチしたパッケージ名の配列 */
    packages: string[];
    /** 現在のステータス */
    status: DetectStatus;
}
/**
 * package.json の依存関係からプリセットを検出し、ステータスを付与した DetectResult[] を返す。
 * - package.json が存在しない場合は空配列を返す（エラーなし）
 * - fetch.ts / cmdDetect / cmdFetch --auto-detect から共通利用される
 */
export declare function discoverPresetsFromPackageJson(projectPath: string): Promise<DetectResult[]>;
export declare function cmdDetect(options: DocsDetectOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=detect.d.ts.map