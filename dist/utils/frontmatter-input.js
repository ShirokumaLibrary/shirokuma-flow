/**
 * Frontmatter Input Utility
 *
 * --from-file オプション用のコアロジック。
 * フロントマター付き Markdown ファイルからメタデータと本文を抽出し、
 * CLI オプションにマージする。
 *
 * @see Issue #1337
 */
import { parseFrontmatter } from "../validators/frontmatter.js";
// =============================================================================
// フィールドマッピング
// =============================================================================
/**
 * frontmatter フィールド名 → CLI オプション名のマッピング。
 * show 出力のフィールド名と CLI オプション名の不一致を吸収する。
 */
const FIELD_TO_OPTION_MAP = {
    type: "issueType",
    // labels は配列のまま渡す
};
/**
 * コマンド種別ごとの安全フィールドホワイトリスト。
 * ここに含まれるフィールドのみ --from-file で取り込む。
 */
const SAFE_FIELDS = {
    "issue-create": new Set(["title", "type", "priority", "size", "labels"]),
    "issue-update": new Set(["title", "type", "priority", "size", "labels"]),
    "pr-create": new Set(["title", "base", "head"]),
    "discussion-create": new Set(["title", "category"]),
};
// =============================================================================
// Core Functions
// =============================================================================
/**
 * フロントマター付きコンテンツをパースし、安全なフィールドのみ抽出する。
 *
 * @param content - フロントマター付き Markdown コンテンツ
 * @param commandType - コマンド種別（安全フィールドの決定に使用）
 * @returns パースされたフィールドと本文
 * @throws フロントマターのパースに失敗した場合
 */
export function parseFrontmatterInput(content, commandType) {
    const parsed = parseFrontmatter(content);
    if (parsed.parseError) {
        throw new Error(`Frontmatter parse error: ${parsed.parseError}`);
    }
    const safeFieldSet = SAFE_FIELDS[commandType];
    const fields = {};
    if (parsed.hasFrontmatter && parsed.data) {
        for (const [key, value] of Object.entries(parsed.data)) {
            if (!safeFieldSet.has(key))
                continue;
            if (value === null || value === undefined)
                continue;
            // フィールド名をオプション名にマップ
            const optionKey = FIELD_TO_OPTION_MAP[key] ?? key;
            fields[optionKey] = value;
        }
    }
    // 本文: frontmatter 後のコンテンツ（空でなければ）
    const body = parsed.content.trim() || undefined;
    return { fields, body };
}
/**
 * frontmatter から抽出した値を CLI オプションにマージする。
 * CLI フラグが既に設定されている場合はフラグを優先する（上書きしない）。
 *
 * @param frontmatterData - parseFrontmatterInput() の結果
 * @param options - 既存の CLI オプション（変更される）
 */
export function mergeFrontmatterOptions(frontmatterData, options) {
    // フィールドのマージ（CLI フラグが未設定の場合のみ）
    for (const [key, value] of Object.entries(frontmatterData.fields)) {
        if (options[key] === undefined) {
            options[key] = value;
        }
    }
    // 本文のマージ（body/bodyFile いずれも未設定の場合のみ）
    // bodyFile ではなく body に設定し、resolveBodyFileOption による
    // ファイルパスとしての二重解決を防止する (#1354)
    if (frontmatterData.body && options["body"] === undefined && options["bodyFile"] === undefined) {
        options["body"] = frontmatterData.body;
    }
}
//# sourceMappingURL=frontmatter-input.js.map