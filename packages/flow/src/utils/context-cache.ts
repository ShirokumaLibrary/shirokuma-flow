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

/**
 * キャッシュファイルが存在するかどうかを返す。
 *
 * @param subdir - キャッシュサブディレクトリ
 * @param key - ファイルキー（拡張子なし）
 */
function contextCacheExists(subdir: CacheSubdir, key: string): boolean {
  return existsSync(join(CONTEXT_CACHE_ROOT, subdir, `${key}.json`));
}

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

// =============================================================================
// Status 同期ヘルパー
// =============================================================================

/** status フィールドを持つ最小構造（issues/{n}.json = ContextTarget） */
interface CachedStatusTarget {
  status?: string;
  [key: string]: unknown;
}

/** target.status を持つ最小構造（issues/context-{n}.json = ContextData） */
interface CachedContextData {
  target?: CachedStatusTarget;
  [key: string]: unknown;
}

/**
 * Issue の Status をキャッシュ両キーに同期する（#2694）。
 *
 * Status の書き込み経路（transition / approve / update-batch 等）からこのヘルパーを
 * 呼ぶことで、後続コマンドが stale な Status を読むのを防ぐ。更新対象は同一 Issue の
 * 2 つのキャッシュキー:
 *
 * - `issues/{number}.json`         … ContextTarget。トップレベル `status` を更新
 *   （resolveCurrentStatus が transition/begin/get/allowed の遷移元判定に使用）
 * - `issues/context-{number}.json` … ContextData。ネストした `target.status` を更新
 *   （`issue context` の cache hit が参照）
 *
 * 動作:
 * - **ファイルが存在する場合のみ更新**する（存在しなければ no-op。キャッシュ未生成の
 *   Issue に対して空ファイルを作らない）。
 * - status 以外のフィールド（title / body / labels / target 以外の構造等）は保持し、
 *   status のみを書き換える。
 * - 一方のキーだけ存在する場合は、存在する側だけを更新する。
 *
 * @param number - Issue 番号
 * @param status - 書き込む新しい Status 値
 */
export function updateCachedStatus(number: number, status: string): void {
  const key = String(number);

  // issues/{number}.json（ContextTarget）— トップレベル status
  if (contextCacheExists("issues", key)) {
    const target = readContextCache<CachedStatusTarget>("issues", key);
    if (target) {
      writeContextCache("issues", key, { ...target, status });
    }
  }

  // issues/context-{number}.json（ContextData）— ネストした target.status
  const contextKey = `context-${key}`;
  if (contextCacheExists("issues", contextKey)) {
    const data = readContextCache<CachedContextData>("issues", contextKey);
    if (data?.target) {
      writeContextCache("issues", contextKey, {
        ...data,
        target: { ...data.target, status },
      });
    }
  }
}
