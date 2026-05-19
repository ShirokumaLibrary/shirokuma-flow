/**
 * cloudflare-workers プリセット
 *
 * Cloudflare Workers 向けカスタム fetch プリセット。
 * developers.cloudflare.com/workers/llms-full.txt を
 * フロントマターブロック（`---\ntitle:...\n---`）単位で分割して保存する。
 *
 * llms.txt の各リンクが `index.md` 形式のネストされたパスになっており、
 * individual 戦略の basename 保存ではファイル名が衝突するため、
 * llms-full.txt の全コンテンツをフロントマターで区切り分割する。
 *
 * 各ページのフロントマター title フィールドをファイル名に使用する。
 * ナビゲーション残滓（"Was this helpful?", "YesNo" 等）は除去する。
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { writeLastFetched, } from "./shared.js";
import { fetchAndSaveLlmsTxt } from "../fetch.js";
/**
 * cloudflare-workers プリセットのメタ情報。
 * `resolvePresetMeta("cloudflare-workers")` が動的 import でこれを取得する。
 */
export const meta = {
    url: "https://developers.cloudflare.com/workers/llms.txt",
    fullUrl: "https://developers.cloudflare.com/workers/llms-full.txt",
    fetchStrategy: "full-split",
    linkFormat: "clean",
    splitPattern: "^---$",
    sectionFormatter: "passthrough",
    packageNames: ["wrangler", "@cloudflare/workers-types"],
};
/** ノイズ行パターン（ナビゲーション残滓） */
const NOISE_PATTERNS = [
    /^Was this helpful\?$/,
    /^YesNo$/,
    /^\[ Edit page \]/,
    /^\[ Report issue \]/,
    /^Copy page$/,
    /^\[Skip to content\]/,
    /^\{"@context":"https:\/\/schema\.org"/,
    /^Filter resources\.\.\./,
    /^\[Skip to content\]\(#/,
];
/**
 * テキストをスラッグ化する（ファイル名用）。
 */
function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
/**
 * フロントマターの title フィールドを抽出する。
 */
function extractFrontmatterTitle(frontmatter) {
    const match = frontmatter.match(/^title:\s*(.+)$/m);
    if (!match)
        return null;
    return match[1].trim().replace(/^["']|["']$/g, "");
}
/**
 * H1 タイトルを抽出する。
 */
function extractH1(content) {
    const match = content.match(/^# (.+)$/m);
    if (!match)
        return null;
    return match[1].trim();
}
/**
 * ノイズ行を除去する。
 */
function stripNoise(content) {
    return content
        .split("\n")
        .filter((line) => !NOISE_PATTERNS.some((p) => p.test(line.trim())))
        .join("\n");
}
/**
 * 行 i が title: を含むフロントマターブロックの開始 `---` かを判定する。
 * 該当する場合は閉じ `---` の行番号を返す。該当しなければ -1。
 */
function detectFrontmatterEnd(lines, i) {
    for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
        if (lines[j].trim() === "---") {
            for (let k = i + 1; k < j; k++) {
                if (lines[k].startsWith("title:"))
                    return j;
            }
            return -1;
        }
    }
    return -1;
}
/**
 * llms-full.txt をフロントマターブロック単位に分割する。
 * 2パス: まず全フロントマター境界位置を収集し、次に区間ごとに切り出す。
 */
function splitByFrontmatter(fullContent) {
    const lines = fullContent.split("\n");
    // Pass 1: フロントマター境界 { start, fmEnd } を収集
    const boundaries = [];
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() !== "---")
            continue;
        const fmEnd = detectFrontmatterEnd(lines, i);
        if (fmEnd !== -1) {
            boundaries.push({ start: i, fmEnd });
            i = fmEnd; // 閉じ `---` の次からスキャン再開
        }
    }
    // Pass 2: 各境界間を frontmatter + body に切り出す
    return boundaries.map(({ start, fmEnd }, idx) => {
        const bodyEnd = idx + 1 < boundaries.length ? boundaries[idx + 1].start : lines.length;
        return {
            frontmatter: lines.slice(start, fmEnd + 1).join("\n"),
            body: lines.slice(fmEnd + 1, bodyEnd).join("\n"),
        };
    });
}
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export async function execute(src, outDir, options, stats, logger) {
    const resolvedUrl = src.url ?? meta.url;
    const fullUrl = src.fullUrl ?? meta.fullUrl;
    const docsRoot = resolve(outDir, "..");
    logger.info(`[${src.name}] llms.txt を取得中: ${resolvedUrl}`);
    // llms.txt を保存（内容は使用しないが、他プリセットと同様にルートに保存する）
    try {
        await fetchAndSaveLlmsTxt(src.name, resolvedUrl, docsRoot, options.dryRun ?? false);
    }
    catch (err) {
        logger.error(`[${src.name}] llms.txt の取得に失敗: ${String(err)}`);
        return stats;
    }
    // llms-full.txt を取得（fetchAndSaveLlmsTxt 経由で共通エラーハンドリングを使用）
    logger.info(`[${src.name}] llms-full.txt を取得中: ${fullUrl}`);
    let fullContent;
    try {
        fullContent = await fetchAndSaveLlmsTxt(`${src.name}-full`, fullUrl, docsRoot, options.dryRun ?? false);
    }
    catch (err) {
        logger.error(`[${src.name}] llms-full.txt の取得に失敗: ${String(err)}`);
        return stats;
    }
    const pages = splitByFrontmatter(fullContent);
    logger.info(`[${src.name}] ${pages.length} ページに分割しました。`);
    if (options.dryRun) {
        logger.info(`[${src.name}] Dry-run: ${pages.length} ページを保存予定`);
        return stats;
    }
    mkdirSync(outDir, { recursive: true });
    const usedNames = new Set();
    for (const { frontmatter, body } of pages) {
        const fmTitle = extractFrontmatterTitle(frontmatter);
        const h1Title = extractH1(body);
        const titleForName = fmTitle ?? h1Title ?? "page";
        let base = slugify(titleForName) || "page";
        let filename = base;
        let counter = 2;
        while (usedNames.has(filename)) {
            filename = `${base}-${counter}`;
            counter++;
        }
        usedNames.add(filename);
        const outFile = join(outDir, `${filename}.md`);
        if (!options.force && existsSync(outFile)) {
            stats.skipped++;
            continue;
        }
        let cleanBody = stripNoise(body).trim();
        if (fmTitle && !extractH1(cleanBody)) {
            cleanBody = `# ${fmTitle}\n\n${cleanBody}`;
        }
        const content = `${frontmatter}\n\n${cleanBody}\n`;
        writeFileSync(outFile, content, "utf-8");
        stats.downloaded++;
    }
    writeLastFetched(outDir);
    return stats;
}
//# sourceMappingURL=cloudflare-workers.js.map