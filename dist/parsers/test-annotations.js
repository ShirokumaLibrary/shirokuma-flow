/**
 * test-annotations - テストアノテーション解析
 *
 * テストファイルからテストケース、JSDocコメント、BDDアノテーションを抽出する。
 */
import { basename } from "node:path";
import { countBraces } from "../utils/brace-matching.js";
/**
 * テストファイルからテストケースを抽出
 *
 * ネストした describe ブロックを正しく追跡し、
 * 括弧のバランスで describe の終了を検出する
 */
export function extractTestCases(content, file, framework) {
    const cases = [];
    const lines = content.split("\n");
    // describe スタック (名前、括弧深さ、ドキュメントを追跡)
    const describeStack = [];
    // 全体の括弧深さ
    let braceDepth = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;
        // describe ブロック検出
        // describe("name", () => { または describe("name", function() {
        const describeMatch = line.match(/(?:describe|test\.describe)\s*\(\s*['"`](.+?)['"`]\s*,/);
        if (describeMatch) {
            // この行の開始時点の括弧深さを記録
            const currentDepth = braceDepth + countBraces(line.substring(0, line.indexOf(describeMatch[0])));
            // describe ブロック直前のJSDocコメントを抽出
            const describeDoc = extractTestDocComment(lines, i);
            describeStack.push({
                name: describeMatch[1],
                braceDepth: currentDepth,
                testdoc: describeDoc?.testdoc,
                purpose: describeDoc?.purpose,
            });
        }
        // it/test ブロック検出 (it.skip / test.skip も対応)
        // it("name", ...) または test("name", ...) または it.skip("name", ...) など
        const itMatch = line.match(/(?:^|\s)(?:it|test)(?:\.skip)?\s*\(\s*['"`](.+?)['"`]/);
        if (itMatch) {
            // test.describe を除外
            if (!line.match(/test\.describe/)) {
                const describeName = describeStack.length > 0
                    ? describeStack.map((d) => d.name).join(" > ")
                    : basename(file, ".test.ts").replace(/\.spec$/, "");
                // スキップ検出 (it.skip / test.skip)
                const isSkipped = /(?:it|test)\.skip\s*\(/.test(line);
                // コメントを抽出
                const docComment = extractTestDocComment(lines, i);
                // describe ドキュメントを収集
                const describeDocs = describeStack
                    .filter((d) => d.testdoc || d.purpose)
                    .map((d, idx) => ({
                    name: describeStack.slice(0, idx + 1).map((s) => s.name).join(" > "),
                    testdoc: d.testdoc,
                    purpose: d.purpose,
                }));
                cases.push({
                    file,
                    describe: describeName,
                    it: itMatch[1],
                    line: lineNum,
                    framework,
                    // 拡張フィールド
                    description: docComment?.testdoc,
                    purpose: docComment?.purpose,
                    precondition: docComment?.precondition,
                    expected: docComment?.expected,
                    category: docComment?.category,
                    bdd: docComment?.bdd,
                    describeDocs: describeDocs.length > 0 ? describeDocs : undefined,
                    app: docComment?.app,
                    skipped: isSkipped || undefined,
                    skipReason: docComment?.skipReason,
                });
            }
        }
        // 括弧のバランスを更新
        braceDepth += countBraces(line);
        // describe の終了を検出
        // 現在の括弧深さが describe 開始時より小さくなったら終了
        while (describeStack.length > 0 &&
            braceDepth <= describeStack[describeStack.length - 1].braceDepth) {
            describeStack.pop();
        }
    }
    return cases;
}
/**
 * テストケース直前のJSDocコメントを抽出
 *
 * @param lines ファイルの全行
 * @param testLineIndex テストケースの行インデックス (0-indexed)
 * @returns コメント情報 または null
 */
export function extractTestDocComment(lines, testLineIndex) {
    // 直前の行からコメント終了を探す
    let commentEndIndex = -1;
    for (let i = testLineIndex - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line === "")
            continue;
        // 単一行コメント（eslint-disable等）はスキップ
        if (line.startsWith("//"))
            continue;
        if (line.endsWith("*/")) {
            commentEndIndex = i;
            break;
        }
        // コメント以外の行が見つかったら終了
        if (!line.startsWith("*") && !line.startsWith("/*")) {
            return null;
        }
    }
    if (commentEndIndex === -1)
        return null;
    // コメント開始を探す
    let commentStartIndex = -1;
    for (let i = commentEndIndex; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.startsWith("/**")) {
            commentStartIndex = i;
            break;
        }
    }
    if (commentStartIndex === -1)
        return null;
    // コメント内容を解析
    const commentLines = lines.slice(commentStartIndex, commentEndIndex + 1);
    const result = {};
    const bdd = {};
    const andValues = [];
    const tagRegex = /@([\w-]+)\s+(.+)/;
    for (const line of commentLines) {
        const trimmed = line.replace(/^\s*\*\s*/, "").trim();
        const match = trimmed.match(tagRegex);
        if (match) {
            const [, tag, value] = match;
            switch (tag) {
                // 既存のタグ
                case "testdoc":
                    result.testdoc = value;
                    break;
                case "purpose":
                case "testPurpose":
                    result.purpose = value;
                    break;
                case "precondition":
                    result.precondition = value;
                    break;
                case "expected":
                case "testExpect":
                    result.expected = value;
                    break;
                // 新しいタグ
                case "testCategory":
                    result.category = parseTestCategory(value);
                    break;
                // BDD タグ
                case "given":
                    bdd.given = value;
                    break;
                case "when":
                    bdd.when = value;
                    break;
                case "then":
                    bdd.then = value;
                    break;
                case "and":
                    andValues.push(value);
                    break;
                // アプリケーション関連付けタグ
                case "app":
                    result.app = value.trim();
                    break;
                // スキップ理由タグ
                case "skip-reason":
                case "skipReason":
                    result.skipReason = value.trim();
                    break;
            }
        }
    }
    // BDD アノテーションがあれば追加
    if (bdd.given || bdd.when || bdd.then || andValues.length > 0) {
        if (andValues.length > 0) {
            bdd.and = andValues;
        }
        result.bdd = bdd;
    }
    return Object.keys(result).length > 0 ? result : null;
}
/**
 * テストカテゴリをパース
 */
export function parseTestCategory(value) {
    const normalized = value.toLowerCase().trim();
    switch (normalized) {
        case "success":
        case "normal":
        case "正常系":
        case "happy-path":
            return "happy-path";
        case "auth":
        case "authentication":
        case "authorization":
        case "認証":
        case "認可":
            return "auth";
        case "error":
        case "エラー":
        case "error-handling":
            return "error-handling";
        case "validation":
        case "バリデーション":
        case "検証":
            return "validation";
        case "edge":
        case "boundary":
        case "エッジケース":
        case "境界値":
        case "edge-case":
            return "edge-case";
        case "integration":
        case "統合":
            return "integration";
        default:
            return "other";
    }
}
/**
 * ファイルレベルのドキュメントコメントを抽出
 *
 * ファイル先頭の JSDoc コメントから @testFileDoc, @module, @coverage を抽出
 */
export function extractFileDocComment(content) {
    const lines = content.split("\n");
    // ファイル先頭のコメントを探す
    let commentStartIndex = -1;
    let commentEndIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // 空行はスキップ
        if (line === "")
            continue;
        // コメント開始を検出
        if (line.startsWith("/**")) {
            commentStartIndex = i;
            // 同じ行で終了する場合
            if (line.endsWith("*/")) {
                commentEndIndex = i;
                break;
            }
            // 終了を探す
            for (let j = i + 1; j < lines.length; j++) {
                if (lines[j].trim().endsWith("*/")) {
                    commentEndIndex = j;
                    break;
                }
            }
            break;
        }
        // コメント以外の行が見つかったらファイル先頭コメントなし
        if (!line.startsWith("*") && !line.startsWith("//")) {
            return null;
        }
    }
    if (commentStartIndex === -1 || commentEndIndex === -1)
        return null;
    // コメント内容を解析
    const commentLines = lines.slice(commentStartIndex, commentEndIndex + 1);
    const result = {};
    const tagRegex = /@([\w-]+)\s+(.+)/;
    for (const line of commentLines) {
        const trimmed = line.replace(/^\s*\*\s*/, "").trim();
        const match = trimmed.match(tagRegex);
        if (match) {
            const [, tag, value] = match;
            switch (tag) {
                case "testFileDoc":
                    result.description = value;
                    break;
                case "module":
                    result.module = value;
                    break;
                case "coverage":
                    result.coverage = value;
                    break;
                case "app":
                    result.app = value.trim();
                    break;
            }
        }
    }
    return Object.keys(result).length > 0 ? result : null;
}
/**
 * describe ブロックのドキュメントコメントを抽出 (@testGroupDoc 対応)
 */
export function extractDescribeDocComment(lines, describeLineIndex) {
    // 直前の行からコメント終了を探す
    let commentEndIndex = -1;
    for (let i = describeLineIndex - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line === "")
            continue;
        if (line.endsWith("*/")) {
            commentEndIndex = i;
            break;
        }
        // コメント以外の行が見つかったら終了
        if (!line.startsWith("*") && !line.startsWith("/*")) {
            return null;
        }
    }
    if (commentEndIndex === -1)
        return null;
    // コメント開始を探す
    let commentStartIndex = -1;
    for (let i = commentEndIndex; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.startsWith("/**")) {
            commentStartIndex = i;
            break;
        }
    }
    if (commentStartIndex === -1)
        return null;
    // コメント内容を解析
    const commentLines = lines.slice(commentStartIndex, commentEndIndex + 1);
    const result = {};
    const tagRegex = /@([\w-]+)\s+(.+)/;
    for (const line of commentLines) {
        const trimmed = line.replace(/^\s*\*\s*/, "").trim();
        const match = trimmed.match(tagRegex);
        if (match) {
            const [, tag, value] = match;
            switch (tag) {
                case "testGroupDoc":
                case "testdoc":
                    result.testdoc = value;
                    break;
                case "purpose":
                    result.purpose = value;
                    break;
                case "priority":
                    if (["high", "medium", "low"].includes(value.toLowerCase())) {
                        result.priority = value.toLowerCase();
                    }
                    break;
            }
        }
    }
    return Object.keys(result).length > 0 ? result : null;
}
// countBraces は共通ユーティリティから re-export
export { countBraces } from "../utils/brace-matching.js";
//# sourceMappingURL=test-annotations.js.map