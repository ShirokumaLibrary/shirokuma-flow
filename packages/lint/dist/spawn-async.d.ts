/**
 * 非同期プロセス実行ユーティリティ
 *
 * spawnSync / execFileSync を async 版に置換するためのヘルパー。
 */
import { type SpawnOptions, type ExecFileOptions } from "node:child_process";
/**
 * execFile の非同期ラッパー
 *
 * stdout/stderr のキャプチャが必要な場合に使用する。
 *
 * @returns stdout, stderr, exitCode
 */
export declare function execFileAsync(command: string, args: string[], options?: ExecFileOptions): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number | null;
}>;
/**
 * spawn の非同期ラッパー
 *
 * コンソール出力パススルー、ファイル出力など終了コードのみ必要な場合に使用する。
 *
 * @returns exitCode
 */
export declare function spawnAsync(command: string, args: string[], options?: SpawnOptions): Promise<{
    exitCode: number | null;
    stderr: string;
}>;
//# sourceMappingURL=spawn-async.d.ts.map