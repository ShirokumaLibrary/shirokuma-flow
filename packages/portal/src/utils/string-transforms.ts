/**
 * 文字列変換ユーティリティ
 *
 * @module utils/string-transforms
 */

/**
 * camelCase / PascalCase を snake_case に変換する。
 * 先頭が大文字の場合もアンダースコアを付与しない。
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (m, offset) => (offset > 0 ? "_" : "") + m.toLowerCase());
}
