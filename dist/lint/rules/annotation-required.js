/**
 * annotation-required rule
 *
 * Requires specific annotations for file patterns:
 * - page.tsx: @screen required
 * - "use server" files: @serverAction required
 * - components/*.tsx: @component recommended
 *
 * @module lint/rules/annotation-required
 */
/**
 * ファイルタイプを判定
 */
function detectFileType(filePath, content) {
    // テストファイルは除外
    if (filePath.includes("__tests__") ||
        filePath.includes(".test.") ||
        filePath.includes(".spec.")) {
        return "other";
    }
    // page.tsx ファイル
    if (filePath.endsWith("page.tsx") || filePath.endsWith("page.ts")) {
        return "page";
    }
    // layout.tsx, loading.tsx などは除外
    if (filePath.endsWith("layout.tsx") ||
        filePath.endsWith("layout.ts") ||
        filePath.endsWith("loading.tsx") ||
        filePath.endsWith("loading.ts") ||
        filePath.endsWith("error.tsx") ||
        filePath.endsWith("error.ts") ||
        filePath.endsWith("not-found.tsx") ||
        filePath.endsWith("not-found.ts")) {
        return "other";
    }
    // "use server" ディレクティブがあるファイル
    if (content.includes('"use server"') || content.includes("'use server'")) {
        return "server-action";
    }
    // components ディレクトリ内の .tsx ファイル
    if (filePath.includes("/components/") &&
        filePath.endsWith(".tsx") &&
        !filePath.includes("/components/ui/") // shadcn/ui は除外
    ) {
        return "component";
    }
    return "other";
}
/**
 * JSDoc からタグを抽出
 */
function extractJSDocTags(content) {
    const tags = [];
    const jsDocPattern = /\/\*\*[\s\S]*?\*\//g;
    let match;
    while ((match = jsDocPattern.exec(content)) !== null) {
        const jsDoc = match[0];
        const tagMatches = jsDoc.matchAll(/@(\w+)/g);
        for (const tagMatch of tagMatches) {
            tags.push(`@${tagMatch[1]}`);
        }
    }
    return tags;
}
/**
 * 必須アノテーション検出ルール
 */
export const annotationRequiredRule = {
    id: "annotation-required",
    severity: "warning",
    description: "Specific file types require certain annotations: page.tsx needs @screen, server actions need @serverAction",
    check(content, filePath) {
        const issues = [];
        const fileType = detectFileType(filePath, content);
        // 対象外のファイルタイプ
        if (fileType === "other") {
            return issues;
        }
        const tags = extractJSDocTags(content);
        switch (fileType) {
            case "page":
                // page.tsx には @screen が必須
                if (!tags.includes("@screen")) {
                    issues.push({
                        type: "warning",
                        message: `page.tsx ファイルに @screen アノテーションがありません。画面識別のため追加を推奨します`,
                        file: filePath,
                        line: 1,
                        rule: "annotation-required",
                    });
                }
                break;
            case "server-action":
                // "use server" ファイルには @serverAction が必須
                if (!tags.includes("@serverAction")) {
                    issues.push({
                        type: "warning",
                        message: `Server Action ファイルに @serverAction アノテーションがありません。モジュールヘッダーまたは関数に追加を推奨します`,
                        file: filePath,
                        line: 1,
                        rule: "annotation-required",
                    });
                }
                break;
            case "component":
                // コンポーネントファイルには @component が推奨 (info レベル)
                if (!tags.includes("@component")) {
                    issues.push({
                        type: "info",
                        message: `コンポーネントファイルに @component アノテーションがありません。コンポーネント識別のため追加を推奨します`,
                        file: filePath,
                        line: 1,
                        rule: "annotation-required",
                    });
                }
                break;
        }
        return issues;
    },
};
//# sourceMappingURL=annotation-required.js.map