/**
 * search-index コマンド - 検索インデックス生成
 *
 * ドキュメントポータル用の全文検索インデックスを生成する。
 * FlexSearch で利用可能な JSON ファイルを出力する。
 */
import { resolve, relative, basename, extname } from "node:path";
import { loadConfig, getOutputPath, resolvePath } from "../../utils/config.js";
import { ensureDir, writeFile, findFiles, fileExists, readFile } from "../../utils/file.js";
import { createLogger } from "../../utils/logger.js";
import { t } from "../../utils/i18n.js";
import { countBraces } from "../../utils/brace-matching.js";
/**
 * テキストを正規化
 * - 小文字変換
 * - 余分な空白を削除
 */
export function normalizeText(text) {
    return text
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}
/**
 * テキストをトークン化
 * - 英語: 単語分割
 * - 日本語: N-gram (bigram)
 */
export function tokenize(text) {
    const normalized = normalizeText(text);
    const tokens = [];
    // 英語単語を抽出
    const englishWords = normalized.match(/[a-z]+/g) || [];
    tokens.push(...englishWords);
    // 日本語文字を抽出してbigramトークン化
    const japaneseChars = normalized.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g) || [];
    for (const chars of japaneseChars) {
        // Unigram
        for (let i = 0; i < chars.length; i++) {
            tokens.push(chars[i]);
        }
        // Bigram
        for (let i = 0; i < chars.length - 1; i++) {
            tokens.push(chars.slice(i, i + 2));
        }
    }
    return [...new Set(tokens)]; // 重複除去
}
/**
 * テストケースコンテンツからSearchDocumentを抽出
 */
export function extractTestCaseDocuments(content, file, baseUrl) {
    const documents = [];
    const lines = content.split("\n");
    // describe と it/test を抽出
    const describeStack = [];
    let braceDepth = 0;
    const describeDepths = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;
        // describe 検出
        const describeMatch = line.match(/(?:describe|test\.describe)\s*\(\s*['"`](.+?)['"`]/);
        if (describeMatch) {
            const currentDepth = braceDepth + countBraces(line.substring(0, line.indexOf(describeMatch[0])));
            describeStack.push(describeMatch[1]);
            describeDepths.push(currentDepth);
        }
        // it/test 検出
        const itMatch = line.match(/(?:^|\s)(?:it|test)\s*\(\s*['"`](.+?)['"`]/);
        if (itMatch && !line.match(/test\.describe/)) {
            const testName = itMatch[1];
            // 直前のJSDocコメントから@testdocを抽出
            let testdoc;
            for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
                const commentLine = lines[j].trim();
                if (commentLine === "")
                    continue;
                if (commentLine.includes("*/")) {
                    // コメントブロックを探す
                    for (let k = j; k >= Math.max(0, j - 10); k--) {
                        const match = lines[k].match(/@testdoc\s+(.+)/);
                        if (match) {
                            testdoc = match[1];
                            break;
                        }
                        if (lines[k].includes("/**"))
                            break;
                    }
                    break;
                }
                if (!commentLine.startsWith("*") && !commentLine.startsWith("/*")) {
                    break;
                }
            }
            const describePath = describeStack.join(" > ");
            const id = `tc-${file.replace(/[^a-zA-Z0-9]/g, "-")}-L${lineNum}`;
            documents.push({
                id,
                title: testdoc || testName,
                content: [
                    describePath,
                    testName,
                    testdoc || "",
                ].filter(Boolean).join(" "),
                url: `${baseUrl}#${id}`,
                type: "testcase",
                category: describePath || basename(file, extname(file)),
            });
        }
        // 括弧深さを更新
        braceDepth += countBraces(line);
        // describe 終了を検出
        while (describeStack.length > 0 &&
            braceDepth <= describeDepths[describeDepths.length - 1]) {
            describeStack.pop();
            describeDepths.pop();
        }
    }
    return documents;
}
/**
 * Markdownコンテンツから SearchDocument を抽出
 */
export function extractMarkdownDocuments(content, file, url) {
    // Frontmatter を解析
    let title = "";
    let description = "";
    let mainContent = content;
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        mainContent = frontmatterMatch[2];
        const titleMatch = frontmatter.match(/^title:\s*(.+)$/m);
        if (titleMatch) {
            title = titleMatch[1].replace(/^["']|["']$/g, "");
        }
        const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
        if (descMatch) {
            description = descMatch[1].replace(/^["']|["']$/g, "");
        }
    }
    // タイトルがなければ最初の見出しから取得
    if (!title) {
        const h1Match = mainContent.match(/^#\s+(.+)$/m);
        if (h1Match) {
            title = h1Match[1];
        }
        else {
            title = basename(file, extname(file));
        }
    }
    // Markdown 記法を除去してプレーンテキスト化
    const plainContent = mainContent
        .replace(/```[\s\S]*?```/g, "") // コードブロック除去
        .replace(/`[^`]+`/g, "") // インラインコード除去
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // リンクテキスト抽出
        .replace(/[#*_~`]/g, "") // Markdown記法除去
        .replace(/\n+/g, " ") // 改行を空白に
        .trim();
    const id = `md-${file.replace(/[^a-zA-Z0-9]/g, "-")}`;
    return [
        {
            id,
            title,
            content: [title, description, plainContent.slice(0, 2000)].filter(Boolean).join(" "),
            url,
            type: "markdown",
            category: getMarkdownCategory(file),
        },
    ];
}
/**
 * API ドキュメントから SearchDocument を抽出
 */
export function extractApiDocuments(content, file, url) {
    const documents = [];
    // TypeDoc生成のMarkdownから関数/クラス定義を抽出
    const functionMatches = content.matchAll(/^##\s+(.+)$/gm);
    for (const match of functionMatches) {
        const funcName = match[1].replace(/[`()]/g, "").trim();
        if (!funcName)
            continue;
        // 説明部分を抽出
        const startIdx = (match.index || 0) + match[0].length;
        const nextHeadingIdx = content.indexOf("\n## ", startIdx);
        const section = nextHeadingIdx > 0
            ? content.slice(startIdx, nextHeadingIdx)
            : content.slice(startIdx, startIdx + 500);
        const plainSection = section
            .replace(/```[\s\S]*?```/g, "")
            .replace(/[#*_~`]/g, "")
            .replace(/\n+/g, " ")
            .trim()
            .slice(0, 500);
        const id = `api-${funcName.replace(/[^a-zA-Z0-9]/g, "-")}`;
        documents.push({
            id,
            title: funcName,
            content: [funcName, plainSection].join(" "),
            url: `${url}#${funcName.toLowerCase().replace(/\s+/g, "-")}`,
            type: "api",
            category: basename(file, extname(file)),
        });
    }
    return documents;
}
/**
 * Markdownファイルのカテゴリを推測
 */
function getMarkdownCategory(file) {
    const lower = file.toLowerCase();
    if (lower.includes("readme"))
        return "readme";
    if (lower.includes("claude"))
        return "claude";
    if (lower.includes("adr"))
        return "adr";
    if (lower.includes("api"))
        return "api";
    if (lower.includes("doc"))
        return "documentation";
    return "other";
}
// countBraces は共通ユーティリティから import（上部参照）
/**
 * 検索インデックスを構築
 */
export function buildSearchIndex(documents) {
    return {
        version: "1.0",
        generatedAt: new Date().toISOString(),
        documents,
    };
}
/**
 * 設定に基づいてドキュメントを抽出
 */
export async function extractSearchDocuments(projectPath, config, logger) {
    const documents = [];
    const searchConfig = config.search;
    const portalDir = getOutputPath(config, projectPath, "portal");
    const generatedDir = getOutputPath(config, projectPath, "generated");
    // 1. テストケースから抽出
    const testCasesPath = resolve(portalDir, "test-cases.html");
    if (fileExists(testCasesPath)) {
        logger.debug("テストケースを検索対象に追加");
        // テストファイルを収集
        const testPatterns = config.testCases?.jest?.testMatch || [
            "**/__tests__/**/*.test.{ts,tsx}",
            "**/*.test.{ts,tsx}",
        ];
        for (const pattern of testPatterns) {
            const testFiles = await findFiles(projectPath, pattern, {
                ignore: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
            });
            for (const testFile of testFiles) {
                const content = readFile(testFile);
                if (!content)
                    continue;
                const relativePath = relative(projectPath, testFile);
                const docs = extractTestCaseDocuments(content, relativePath, "/test-cases.html");
                documents.push(...docs);
            }
        }
        // Playwright テスト
        const playwrightDir = config.testCases?.playwright?.testDir || "./tests/e2e";
        const playwrightPath = resolvePath(projectPath, playwrightDir);
        if (fileExists(playwrightPath)) {
            const e2eFiles = await findFiles(playwrightPath, "**/*.{test,spec}.ts", {
                ignore: ["**/node_modules/**"],
            });
            for (const e2eFile of e2eFiles) {
                const content = readFile(e2eFile);
                if (!content)
                    continue;
                const relativePath = relative(projectPath, e2eFile);
                const docs = extractTestCaseDocuments(content, relativePath, "/test-cases.html");
                documents.push(...docs);
            }
        }
    }
    // 2. API ドキュメントから抽出
    const apiReadme = resolve(generatedDir, "api", "README.md");
    if (fileExists(apiReadme)) {
        logger.debug("APIドキュメントを検索対象に追加");
        const apiFiles = await findFiles(resolve(generatedDir, "api"), "**/*.md", {
            ignore: [],
        });
        for (const apiFile of apiFiles) {
            const content = readFile(apiFile);
            if (!content)
                continue;
            const relativePath = relative(generatedDir, apiFile);
            const docs = extractApiDocuments(content, relativePath, `/viewer.html?file=/generated/${relativePath}`);
            documents.push(...docs);
        }
    }
    // 3. インクルードパターンからMarkdownを抽出
    const includePatterns = searchConfig?.include || [
        "docs/**/*.md",
        "README.md",
        "CLAUDE.md",
    ];
    const excludePatterns = searchConfig?.exclude || ["**/node_modules/**"];
    for (const pattern of includePatterns) {
        const mdFiles = await findFiles(projectPath, pattern, {
            ignore: excludePatterns,
        });
        for (const mdFile of mdFiles) {
            const content = readFile(mdFile);
            if (!content)
                continue;
            const relativePath = relative(projectPath, mdFile);
            // すでにAPIとして処理済みかチェック
            if (relativePath.startsWith("docs/generated/api"))
                continue;
            const docs = extractMarkdownDocuments(content, relativePath, `/viewer.html?file=/markdown/${relativePath}`);
            documents.push(...docs);
        }
    }
    return documents;
}
/**
 * search-index コマンドハンドラ
 */
export async function searchIndexCommand(options) {
    const logger = createLogger(options.verbose);
    const projectPath = resolve(options.project);
    logger.info(t("commands.searchIndex.generating"));
    // 設定読み込み
    const config = loadConfig(projectPath, options.config);
    const searchConfig = config.search;
    // 検索機能が無効化されている場合
    if (searchConfig?.enabled === false) {
        logger.warn(t("commands.searchIndex.disabled"));
        return 0;
    }
    // 出力パス
    const outputDir = options.output
        || searchConfig?.indexOutput
        || getOutputPath(config, projectPath, "portal");
    ensureDir(outputDir);
    const indexPath = resolve(outputDir, "search-index.json");
    // ドキュメントを抽出
    const documents = await extractSearchDocuments(projectPath, config, logger);
    logger.debug(`抽出されたドキュメント数: ${documents.length}`);
    logger.debug(`  - testcase: ${documents.filter((d) => d.type === "testcase").length}`);
    logger.debug(`  - api: ${documents.filter((d) => d.type === "api").length}`);
    logger.debug(`  - markdown: ${documents.filter((d) => d.type === "markdown").length}`);
    // インデックスを構築
    const searchIndex = buildSearchIndex(documents);
    // JSON ファイルに出力
    writeFile(indexPath, JSON.stringify(searchIndex, null, 2));
    logger.success(`検索インデックス: ${indexPath}`);
    logger.success(t("commands.searchIndex.done"));
    return 0;
}
//# sourceMappingURL=search-index.js.map