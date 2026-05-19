import { type Logger } from "./logger.js";
import type { CommandType } from "./frontmatter-input.js";
/**
 * ハンドラの戻り値（exit code）を process.exitCode に反映する。
 * 0 以外の場合のみ設定する。
 */
export declare function setExitCode(code: number): void;
/**
 * ファイルパスまたは stdin オプションを解決し、内容に置換する。
 * `-` の場合は stdin から読み取る。
 * 失敗時は process.exitCode を設定して false を返す。
 */
export declare function resolveFileOption(options: Record<string, unknown>, key: string, flagName: string): boolean;
/** --body-file の解決（後方互換ラッパー） */
export declare function resolveBodyFileOption(options: Record<string, unknown>): boolean;
/**
 * --from-file オプションを解決し、frontmatter からフィールドと本文を抽出して options にマージする。
 * --body-file との排他チェックも行う。
 *
 * frontmatter-input モジュール（yaml パーサーを含む）は --from-file 使用時のみ動的にロードする。
 *
 * @param options - CLI オプション（fromFile プロパティを含む）
 * @param commandType - コマンド種別（安全フィールドの決定に使用）
 * @returns 成功時 true、エラー時 false（process.exitCode を設定）
 */
export declare function resolveFromFileOption(options: Record<string, unknown>, commandType: CommandType): Promise<boolean>;
/**
 * --to-file オプションの処理: データを frontmatter 形式でファイルに書き出す。
 * --to-file が指定されていない場合は null を返し、呼び出し元で通常出力を行う。
 * --to-file - の場合は stdout に出力する（--format frontmatter と等価）。
 *
 * formatters / file モジュールは --to-file 使用時のみ動的にロードする。
 *
 * @param data - 出力するデータオブジェクト
 * @param toFile - ファイルパスまたは "-"（stdout）
 * @returns 書き出しを行った場合は 0、toFile 未指定時は null
 */
export declare function writeToFile(data: Record<string, unknown>, toFile: string | undefined): Promise<number | null>;
/**
 * アクションハンドラ共通の初期化: Logger 作成 + cross-repo alias 検証。
 * alias が不正な場合は Error をスローする。
 */
export declare function createActionLogger(options: Record<string, unknown>): Logger;
//# sourceMappingURL=cli-helpers.d.ts.map