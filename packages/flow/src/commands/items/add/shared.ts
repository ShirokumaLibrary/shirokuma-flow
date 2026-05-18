/**
 * items add - 共用ユーティリティ (#1808)
 *
 * 3サブコマンド（comment / issue / discussion）共通で使用するファイル読み込み処理。
 */

import { parseFrontmatter } from "../../../validators/frontmatter.js";
import { readFile } from "../../../utils/file.js";
import { readBodyFile } from "../../../utils/github.js";
import type { Logger } from "../../../utils/logger.js";

// =============================================================================
// ファイル読み込みと frontmatter 解析
// =============================================================================

/** ファイル（または `-` で stdin）から本文と frontmatter メタデータを読み込む */
export function readFileWithFrontmatter(source: string, logger: Logger): {
  body: string;
  meta: Record<string, unknown>;
} | null {
  let raw: string | null;
  if (source === "-") {
    try {
      raw = readBodyFile(source);
    } catch (e) {
      logger.error(e instanceof Error ? e.message : String(e));
      return null;
    }
  } else {
    raw = readFile(source);
  }
  if (raw === null) return null;

  const parsed = parseFrontmatter(raw);
  if (parsed.hasFrontmatter && parsed.data) {
    // frontmatter がある場合は本文部分を body とする
    const meta = { ...parsed.data };
    // body フィールドを meta から取り出して Markdown 本文と区別
    delete meta["body"];
    return { body: parsed.content.trim(), meta };
  }

  // frontmatter なしの場合はファイル全体を本文として扱う
  return { body: raw.trim(), meta: {} };
}
