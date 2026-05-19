/**
 * CLI ヘルパーユーティリティ（portal 用軽量版）
 *
 * flow/src/utils/cli-helpers.ts から generate 系に必要な関数のみを抽出。
 * github.ts / repo-pairs.ts など flow 固有の依存を持たない。
 */
/**
 * ハンドラの戻り値（exit code）を process.exitCode に反映する。
 * 0 以外の場合のみ設定する。
 */
export declare function setExitCode(code: number): void;
//# sourceMappingURL=cli-helpers.d.ts.map