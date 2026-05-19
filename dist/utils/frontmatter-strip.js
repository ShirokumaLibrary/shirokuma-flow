/**
 * frontmatter 除去ユーティリティ (#2112)
 *
 * ファイルコンテンツの冒頭 YAML frontmatter を除去し、本文のみを返す。
 * items update コマンドで --body にファイルを渡す際に frontmatter が
 * GitHub に投稿されることを防ぐために使用する。
 *
 * 適用範囲:
 * - 対象: `items update --body` 経路（`updateIssue` / `updateComment` / `updateDiscussion`）
 * - 対象外: `items add comment --file` / `items add issue --file` 等の add 系コマンド
 *   （`readFileWithFrontmatter()` で既に frontmatter を分離しているため、本文のみが渡される）
 */
import { parseFrontmatter } from "../validators/frontmatter.js";
/**
 * 文字列先頭の YAML frontmatter を除去して本文のみを返す。
 *
 * - frontmatter が存在する場合は `---` ブロックを除去し、本文を返す
 * - frontmatter が存在しない場合は入力をそのまま返す
 * - frontmatter 解析は `parseFrontmatter()` に委譲する（先頭の 1 ブロックのみ処理）
 */
export function stripFrontmatter(content) {
    const parsed = parseFrontmatter(content);
    if (parsed.hasFrontmatter) {
        return parsed.content;
    }
    return content;
}
//# sourceMappingURL=frontmatter-strip.js.map