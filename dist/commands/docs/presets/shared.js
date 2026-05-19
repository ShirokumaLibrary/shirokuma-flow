/**
 * docs fetch プリセットの共通ユーティリティ
 *
 * 各プリセットファイルが共有するファイル取得・画像処理・GitHub API アクセスを提供する。
 */
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, } from "node:fs";
import { join, basename, extname } from "node:path";
import { execFileSync } from "node:child_process";
export function createEmptyStats() {
    return {
        downloaded: 0,
        skipped: 0,
        failed: 0,
        imagesDownloaded: 0,
        imagesSkipped: 0,
        imagesFailed: 0,
        svgConverted: 0,
        svgKept: 0,
    };
}
// =============================================================================
// ファイル取得
// =============================================================================
/**
 * Markdown ファイルを取得する。
 * インクリメンタル: 既存ファイルより古ければスキップ。
 * 戻り値: "downloaded" | "skipped" | "failed"
 */
export async function fetchMarkdown(url, outFile, force) {
    if (!force && existsSync(outFile)) {
        const localMtime = statSync(outFile).mtime;
        try {
            const headRes = await fetch(url, { method: "HEAD" });
            const lastModified = headRes.headers.get("last-modified");
            if (lastModified) {
                const remoteMtime = new Date(lastModified);
                if (remoteMtime <= localMtime) {
                    return "skipped";
                }
            }
            else {
                return "skipped";
            }
        }
        catch {
            return "skipped";
        }
    }
    try {
        const res = await fetch(url);
        if (!res.ok) {
            return "failed";
        }
        const text = await res.text();
        writeFileSync(outFile, text, "utf-8");
        return "downloaded";
    }
    catch {
        return "failed";
    }
}
/**
 * .last-fetched タイムスタンプを記録する。
 */
export function writeLastFetched(outDir) {
    writeFileSync(join(outDir, ".last-fetched"), new Date().toISOString(), "utf-8");
}
// =============================================================================
// 画像処理
// =============================================================================
/**
 * Markdown ファイル内の画像 URL を抽出する。
 */
export function extractImageUrls(content) {
    const urls = [];
    const seen = new Set();
    const imgRegex = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g;
    let match;
    while ((match = imgRegex.exec(content)) !== null) {
        const url = match[1].split("?")[0];
        if (!seen.has(url) && hasExtension(url)) {
            seen.add(url);
            urls.push(match[1]);
        }
    }
    const srcRegex = /<img\s[^>]*src=["']([^"']+)["']/gi;
    while ((match = srcRegex.exec(content)) !== null) {
        const rawUrl = match[1];
        if (!rawUrl.startsWith("http"))
            continue;
        const url = rawUrl.split("?")[0];
        if (!seen.has(rawUrl) && hasExtension(url)) {
            seen.add(rawUrl);
            urls.push(rawUrl);
        }
    }
    return urls;
}
function hasExtension(url) {
    const name = basename(url.split("?")[0]);
    return name.includes(".");
}
/**
 * Markdown ファイル内の画像 URL を相対パスに書き換える。
 */
export function rewriteImagePaths(content, rewrites) {
    let result = content;
    for (const [originalUrl, localName] of rewrites) {
        result = result.split(originalUrl).join(`./${localName}`);
    }
    return result;
}
/**
 * SVG ファイルを claude CLI で Mermaid に変換する。
 */
export function convertSvgToMermaid(svgFile) {
    try {
        execFileSync("which", ["claude"], { stdio: "ignore" });
    }
    catch {
        return false;
    }
    const mermaidFile = svgFile.replace(/\.svg$/, ".mermaid.md");
    try {
        const svgContent = readFileSync(svgFile, "utf-8");
        const result = execFileSync("claude", [
            "-p",
            "Convert the following SVG (provided via stdin) to Mermaid notation. Output ONLY the Mermaid code block (with ```mermaid ... ```). If you cannot convert it, output exactly: CANNOT_CONVERT",
        ], { input: svgContent, encoding: "utf-8", timeout: 60000 });
        if (!result || result.includes("CANNOT_CONVERT"))
            return false;
        writeFileSync(mermaidFile, result, "utf-8");
        return true;
    }
    catch {
        return false;
    }
}
/**
 * 出力ディレクトリ内の Markdown ファイルに含まれる画像を DL・パス書き換えする。
 */
export async function processImages(outDir, force, stats, logger, sourceName) {
    const mdFiles = existsSync(outDir)
        ? readdirSync(outDir).filter((f) => f.endsWith(".md"))
        : [];
    for (const mdFilename of mdFiles) {
        const mdFile = join(outDir, mdFilename);
        let content;
        try {
            content = readFileSync(mdFile, "utf-8");
        }
        catch {
            continue;
        }
        const imageUrls = extractImageUrls(content);
        if (imageUrls.length === 0)
            continue;
        const rewrites = new Map();
        for (const imgUrl of imageUrls) {
            const rawName = basename(imgUrl.split("?")[0]);
            if (!rawName.includes("."))
                continue;
            const imgOutFile = join(outDir, rawName);
            if (!force && existsSync(imgOutFile)) {
                stats.imagesSkipped++;
                continue;
            }
            try {
                const res = await fetch(imgUrl);
                if (!res.ok)
                    throw new Error(`HTTP ${res.status}`);
                const buf = Buffer.from(await res.arrayBuffer());
                writeFileSync(imgOutFile, buf);
                stats.imagesDownloaded++;
                rewrites.set(imgUrl, rawName);
                if (extname(rawName).toLowerCase() === ".svg") {
                    const MAX_SVG_CONVERSIONS = 20;
                    if (stats.svgConverted + stats.svgKept >= MAX_SVG_CONVERSIONS) {
                        logger.info(`[${sourceName}] SVG 変換の上限 (${MAX_SVG_CONVERSIONS}) に達しました。残りの SVG はそのまま保持します。`);
                        stats.svgKept++;
                    }
                    else if (convertSvgToMermaid(imgOutFile)) {
                        stats.svgConverted++;
                    }
                    else {
                        stats.svgKept++;
                    }
                }
            }
            catch {
                logger.debug?.(`[${sourceName}] FAILED (image): ${rawName}`);
                stats.imagesFailed++;
            }
        }
        if (rewrites.size > 0) {
            const newContent = rewriteImagePaths(content, rewrites);
            writeFileSync(mdFile, newContent, "utf-8");
        }
    }
}
/**
 * GitHub リポジトリ URL から owner/repo を解析する。
 * `https://github.com/{owner}/{repo}` 形式のみ受け付ける。
 */
export function parseGithubRepoUrl(url) {
    const match = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
    if (!match)
        return null;
    return { owner: match[1], repo: match[2] };
}
/**
 * GitHub プリセットの共通エントリーガード。
 * URL を解析し、失敗時はエラーログを出して null を返す。
 */
export function resolveGithubRepo(src, strategyName, logger) {
    if (!src.url) {
        logger.error(`[${src.name}] ${strategyName} プリセットには url が必要ですが、設定されていません。`);
        return null;
    }
    const repoInfo = parseGithubRepoUrl(src.url);
    if (!repoInfo) {
        logger.error(`[${src.name}] ${strategyName} プリセットには url を "https://github.com/{owner}/{repo}" 形式で指定してください。`);
    }
    return repoInfo;
}
/**
 * GitHub Git Tree API でリポジトリのファイル一覧を取得する。
 * gh CLI の認証を利用する。
 */
export function fetchGithubTreeEntries(owner, repo, branch) {
    const json = execFileSync("gh", ["api", `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`], { encoding: "utf-8", timeout: 30000 });
    const data = JSON.parse(json);
    return data.tree;
}
/** SHA (40文字hex) のバリデーションパターン */
const SHA_PATTERN = /^[a-f0-9]{40}$/;
/** ブランチ名 / タグ名のバリデーションパターン（SHA も許可） */
const TREE_REF_PATTERN = /^[a-zA-Z0-9._\/-]+$/;
/** treeRef（ブランチ名 or SHA）のバリデーション */
function validateTreeRef(treeRef) {
    if (!TREE_REF_PATTERN.test(treeRef) || treeRef.includes("..")) {
        throw new Error(`Invalid tree ref: "${treeRef}"`);
    }
}
/** SHA のバリデーション */
function validateSha(sha) {
    if (!SHA_PATTERN.test(sha)) {
        throw new Error(`Invalid SHA: "${sha}"`);
    }
}
/**
 * GitHub Git Tree API で SHA を指定してサブツリーのファイル一覧を取得する。
 * ルートから `recursive=1` すると ENOBUFS になるような大規模リポジトリ向けに、
 * SHA で絞り込んだサブツリーに対して再帰取得を行う。
 * gh CLI の認証を利用する。
 */
export function fetchGithubSubtreeBySha(owner, repo, sha) {
    validateSha(sha);
    const json = execFileSync("gh", ["api", `/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`], { encoding: "utf-8", timeout: 30000 });
    const data = JSON.parse(json);
    return data.tree;
}
/**
 * GitHub Git Tree API でディレクトリの SHA を解決する。
 * 指定パスのエントリを shallow tree から検索して SHA を返す。
 * 見つからない場合は null を返す。
 */
export function resolveGithubTreeSha(owner, repo, treeRef, targetPath) {
    validateTreeRef(treeRef);
    const json = execFileSync("gh", ["api", `/repos/${owner}/${repo}/git/trees/${treeRef}`], { encoding: "utf-8", timeout: 30000 });
    const data = JSON.parse(json);
    const entry = data.tree.find((e) => e.path === targetPath);
    return entry?.sha ?? null;
}
/**
 * raw.githubusercontent.com の URL を構築する。
 */
export function buildGithubRawUrl(owner, repo, branch, filePath) {
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
}
//# sourceMappingURL=shared.js.map