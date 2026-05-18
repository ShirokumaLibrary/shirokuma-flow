/**
 * 非同期プロセス実行ユーティリティ
 *
 * spawnSync / execFileSync を async 版に置換するためのヘルパー。
 */

import { spawn, execFile, type SpawnOptions, type ExecFileOptions } from "node:child_process";

/**
 * execFile の非同期ラッパー
 *
 * stdout/stderr のキャプチャが必要な場合に使用する。
 *
 * @returns stdout, stderr, exitCode
 */
export function execFileAsync(
  command: string,
  args: string[],
  options?: ExecFileOptions
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve) => {
    execFile(command, args, { encoding: "utf-8", ...options }, (error, stdout, stderr) => {
      const exitCode = error && "code" in error ? (error as { code?: number }).code ?? null : 0;
      resolve({
        stdout: typeof stdout === "string" ? stdout : "",
        stderr: typeof stderr === "string" ? stderr : "",
        exitCode,
      });
    });
  });
}

/**
 * spawn の非同期ラッパー
 *
 * コンソール出力パススルー、ファイル出力など終了コードのみ必要な場合に使用する。
 *
 * @returns exitCode
 */
export function spawnAsync(
  command: string,
  args: string[],
  options?: SpawnOptions
): Promise<{ exitCode: number | null; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, options ?? {});

    let stderr = "";
    if (child.stderr) {
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
    }

    child.on("close", (code) => {
      resolve({ exitCode: code, stderr });
    });

    child.on("error", (err) => {
      resolve({ exitCode: null, stderr: err.message });
    });
  });
}
