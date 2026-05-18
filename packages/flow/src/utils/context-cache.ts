/**
 * Context cache utilities
 *
 * キャッシュのルートディレクトリ定義と、items context コマンドが書き込む
 * JSON キャッシュファイルの読み書きを提供するユーティリティ。
 *
 * キャッシュ構造:
 * .shirokuma/cache/
 * ├── issues/{number}.json          # ContextTarget（transition/update/link/comments が参照）
 * ├── issues/context-{number}.json  # ContextData 全体（items context の cache hit 用）
 * └── comments/issue-{number}.json  # コメント配列（items comments が参照）
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/** キャッシュのルートディレクトリ */
export const CONTEXT_CACHE_ROOT = ".shirokuma/cache";

/** キャッシュサブディレクトリの種別 */
export type CacheSubdir = "issues" | "comments";

/**
 * キャッシュファイルを読み込む。
 * ファイルが存在しない・JSON パースエラーの場合は null を返す。
 *
 * @param subdir - キャッシュサブディレクトリ
 * @param key - ファイルキー（拡張子なし、例: "42" または "issue-42"）
 * @returns パースされたオブジェクト、または null
 */
export function readContextCache<T>(subdir: CacheSubdir, key: string): T | null {
  const filePath = join(CONTEXT_CACHE_ROOT, subdir, `${key}.json`);
  if (!existsSync(filePath)) return null;
  try {
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * キャッシュファイルに書き込む。
 * 親ディレクトリが存在しない場合は再帰的に作成する。
 *
 * @param subdir - キャッシュサブディレクトリ
 * @param key - ファイルキー（拡張子なし、例: "42" または "issue-42"）
 * @param data - 書き込むデータ
 */
export function writeContextCache<T>(subdir: CacheSubdir, key: string, data: T): void {
  const filePath = join(CONTEXT_CACHE_ROOT, subdir, `${key}.json`);
  const dir = join(CONTEXT_CACHE_ROOT, subdir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}
