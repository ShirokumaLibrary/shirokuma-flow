/**
 * feature-map 共有ユーティリティ
 *
 * feature-map-tags.ts と feature-map-type-extraction.ts の
 * 両方から使用される共有ユーティリティ関数。
 * 循環依存を回避するために独立ファイルとして分離。
 */
/**
 * JSDoc からタグを抽出
 */
export function extractTags(jsdocBlock) {
    const tags = {};
    // 各行を解析
    const lines = jsdocBlock.split("\n");
    for (const line of lines) {
        // @tag value パターンを検出
        const tagMatch = line.match(/@(\w+)(?:\s+(.+?))?(?:\s*\*\/|\s*$)/);
        if (tagMatch) {
            const [, tag, value] = tagMatch;
            // serverAction は値なしのマーカー
            if (tag === "serverAction") {
                tags[tag] = "";
            }
            else if (value) {
                tags[tag] = value.trim();
            }
        }
    }
    return tags;
}
/**
 * JSDoc から説明文を抽出 (タグ以外の行)
 */
export function extractDescription(jsdocBlock) {
    const lines = jsdocBlock.split("\n");
    const descLines = [];
    for (const line of lines) {
        // JSDoc 開始/終了とタグ行をスキップ
        const content = line.replace(/^\s*\*\s?/, ""); // JSDocマーカーのみ削除
        const trimmed = content.trim(); // 判定用
        if (trimmed.startsWith("/**") ||
            trimmed.startsWith("*/") ||
            trimmed === "/" || // "*/" → "/" となるケースをスキップ
            trimmed.startsWith("@") ||
            trimmed === "") {
            continue;
        }
        descLines.push(content); // インデントを保持した content を使用
    }
    return descLines.length > 0 ? descLines.join("\n") : undefined;
}
/**
 * カンマ区切りリストを解析
 */
export function parseCommaSeparatedList(value) {
    if (!value)
        return [];
    return value
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}
/**
 * ファイルパスからモジュール名を抽出
 *
 * @description ファイルパスから意味のあるモジュール名を抽出する。
 * 例:
 *   - "apps/web/lib/actions/members.ts" → "members"
 *   - "apps/web/components/ui/button.tsx" → "ui"
 *   - "apps/web/app/[locale]/(dashboard)/page.tsx" → "dashboard"
 *   - "packages/database/src/schema/users.ts" → "schema"
 *
 * @param filePath - ファイルパス
 * @returns モジュール名
 */
export function extractModuleName(filePath) {
    // パスをセグメントに分割
    const segments = filePath.replace(/\\/g, "/").split("/");
    // ファイル名（拡張子なし）
    const fileName = segments[segments.length - 1].replace(/\.(ts|tsx|js|jsx)$/, "");
    // 特殊ディレクトリ名を除外してモジュール名を探す
    const excludeDirs = ["app", "lib", "src", "components", "actions", "schema", "apps", "packages", "web", "admin", "public"];
    // 後ろから2番目のディレクトリを優先（意味のあるモジュール名の可能性が高い）
    for (let i = segments.length - 2; i >= 0; i--) {
        const dir = segments[i];
        // 特殊ディレクトリは名前を整形
        if (dir.startsWith("(") && dir.endsWith(")")) {
            return dir.slice(1, -1); // "(dashboard)" → "dashboard"
        }
        if (dir.startsWith("[") && dir.endsWith("]")) {
            continue; // "[locale]" はスキップ
        }
        // 除外リストにないディレクトリを使用
        if (!excludeDirs.includes(dir.toLowerCase()) && dir.length > 0) {
            return dir;
        }
    }
    // フォールバック: ファイル名を使用
    return fileName;
}
//# sourceMappingURL=feature-map-utils.js.map