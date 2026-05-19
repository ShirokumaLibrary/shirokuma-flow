/**
 * docs fetch subcommand - llms.txt からドキュメントを取得
 *
 * scripts/fetch-claude-code-docs.sh の fetch ロジックを Node.js に移植。
 * - llms.txt パース・インクリメンタル DL
 * - 画像処理・SVG→Mermaid 変換（--no-images でスキップ）
 * - linkFormat 自動検出と config への永続化
 *
 * サイト固有のプリセットは presets/ ディレクトリに分離。
 * individual / full-split も各プリセットファイルから呼び出し可能なヘルパーとして export する。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, } from "node:fs";
import { join, resolve, basename } from "node:path";
import { loadConfig } from "../../utils/config.js";
import { resolveOutputDir, discoverFilesystemSources } from "./list.js";
// shared から re-export（既存テストの import パスを維持）
export { extractImageUrls, rewriteImagePaths, convertSvgToMermaid, parseGithubRepoUrl, resolveGithubRepo, fetchGithubTreeEntries, buildGithubRawUrl, } from "./presets/shared.js";
import { createEmptyStats, fetchMarkdown, processImages, writeLastFetched, } from "./presets/shared.js";
import { writeManifest } from "./manifest.js";
/** ソース単位の fetch 統計をログ出力する */
function logFetchStats(sourceName, stats, showImages, logger) {
    logger.info(`[${sourceName}] 完了:`);
    logger.info(`  Downloaded: ${stats.downloaded}`);
    logger.info(`  Skipped:    ${stats.skipped}`);
    logger.info(`  Failed:     ${stats.failed}`);
    if (showImages) {
        logger.info(`  Images DL:  ${stats.imagesDownloaded}`);
        logger.info(`  Images Skip:${stats.imagesSkipped}`);
        logger.info(`  SVG→Mermaid:${stats.svgConverted}`);
    }
}
// =============================================================================
// Preset 解決
// =============================================================================
/**
 * 全プリセット名の一覧。
 * プリセット名 = プリセットファイル名の規約により、マッピングは不要。
 */
const PRESET_NAMES = [
    "astro-6", "aws-cdk-2", "aws-cli-2", "better-auth-1", "bun-1", "cakephp-5",
    "claude-code-2", "cloudflare-workers", "commander-14", "coreui-bootstrap-5",
    "coreui-vue-5", "cytoscape-3", "deno-2", "drizzle-0",
    "handlebars-4", "hono-4", "jquery-4",
    "kysely-0", "laravel-11", "laravel-12", "mermaid-11",
    "nextjs-16", "octokit-rest-22", "payload-3", "playwright-1",
    "prisma-6", "react-19", "remix-2", "shadcn-ui-4",
    "supabase-2", "svelte-5", "tailwindcss-4", "ts-morph-27",
    "turborepo-2", "typescript-5", "vitest-4", "vue-3", "zod-4",
];
/**
 * プリセット名からメタ情報を非同期に解決する。
 * プリセット名 = プリセットファイル名の規約で `presets/{name}.js` を動的 import する。
 * 見つからない場合は `null` を返す。
 */
export async function resolvePresetMeta(name) {
    try {
        const mod = await import(`./presets/${name}.js`);
        if (mod.meta) {
            // GitHub 系（fetchStrategy なし）はプリセット名を fetchStrategy として付与
            // individual/full-split 系は meta に fetchStrategy が含まれているのでそのまま返す
            const metaWithStrategy = mod.meta;
            if (!metaWithStrategy.fetchStrategy) {
                return { ...mod.meta, fetchStrategy: name };
            }
            return metaWithStrategy;
        }
    }
    catch {
        // プリセットファイルが見つからない場合は null を返す
    }
    return null;
}
/** プリセット meta からパッケージ名を解決する（writeManifest のコールバック用） */
async function resolvePresetPackageName(name) {
    const meta = await resolvePresetMeta(name);
    return meta?.packageNames?.[0] ?? null;
}
/**
 * 全プリセット名の一覧を返す（add コマンドのエラーメッセージ用）。
 */
export function listPresetNames() {
    return PRESET_NAMES;
}
// =============================================================================
// 組み込み fetch 方式（動的 import 対象外）
// =============================================================================
const BUILTIN_STRATEGIES = new Set(["individual", "full-split"]);
// =============================================================================
// llms.txt パース
// =============================================================================
/**
 * llms.txt の内容からリンク URL を抽出する。
 * Markdown リンク形式 [text](url) および裸の URL 行に対応。
 */
export function parseLlmsTxt(content, baseUrl) {
    return parseLlmsTxtWithTitles(content, baseUrl).map((e) => e.url);
}
/**
 * llms.txt の内容から URL とタイトルのペアを抽出する。
 * full-split 時にセクションへ H1 タイトルを付与するために使用。
 * baseUrl が指定された場合、相対パスリンクを絶対 URL に解決する。
 */
export function parseLlmsTxtWithTitles(content, baseUrl) {
    const entries = [];
    const seen = new Set();
    // ベース URL のオリジン（相対パス解決用）
    let origin = "";
    if (baseUrl) {
        try {
            const parsed = new URL(baseUrl);
            origin = parsed.origin;
        }
        catch {
            // ignore
        }
    }
    // Markdown リンク形式: [text](url) — 絶対 URL
    const mdLinkAbsRegex = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
    let match;
    while ((match = mdLinkAbsRegex.exec(content)) !== null) {
        const title = match[1];
        const url = match[2];
        if (!seen.has(url)) {
            seen.add(url);
            entries.push({ url, title });
        }
    }
    // Markdown リンク形式: [text](/path) — 相対パス（origin で解決）
    if (origin) {
        const mdLinkRelRegex = /\[([^\]]*)\]\((\/[^)\s]+)\)/g;
        while ((match = mdLinkRelRegex.exec(content)) !== null) {
            const title = match[1];
            const url = origin + match[2];
            if (!seen.has(url)) {
                seen.add(url);
                entries.push({ url, title });
            }
        }
    }
    // 裸の URL 行（タイトルなし）
    for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            const url = trimmed.split(/\s/)[0];
            if (!seen.has(url)) {
                seen.add(url);
                entries.push({ url, title: "" });
            }
        }
    }
    return entries;
}
// =============================================================================
// fetch 処理（llms.txt 用）
// =============================================================================
/**
 * llms.txt を fetch して内容を返す。
 */
async function fetchLlmsTxt(url) {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`llms.txt の取得に失敗しました: ${url} (${res.status})`);
    }
    return res.text();
}
/**
 * llms.txt を取得してルートディレクトリに保存し、内容を返す。
 * individual / full-split プリセットファイルの execute() から使用する共通ヘルパー。
 *
 * @param sourceName - ソース識別名（ファイル名に使用）
 * @param llmsUrl - llms.txt の URL
 * @param docsRoot - .shirokuma/docs/ などのルートディレクトリ（保存先）
 * @param dryRun - true の場合はファイル保存をスキップ
 * @returns llms.txt の内容
 */
export async function fetchAndSaveLlmsTxt(sourceName, llmsUrl, docsRoot, dryRun) {
    const content = await fetchLlmsTxt(llmsUrl);
    if (!dryRun) {
        mkdirSync(docsRoot, { recursive: true });
        writeFileSync(join(docsRoot, `${sourceName}-llms.txt`), content, "utf-8");
    }
    return content;
}
// =============================================================================
// full-split プリセットヘルパー
// =============================================================================
/**
 * llms.txt のリンクから URL→タイトルのマップを構築する。
 */
function buildTitleMap(llmsContent) {
    const entries = parseLlmsTxtWithTitles(llmsContent);
    const map = new Map();
    for (const { url, title } of entries) {
        if (title) {
            map.set(url, title);
        }
    }
    return map;
}
/**
 * メタデータ行（Source:/URL:）付きセクションを frontmatter 形式に変換する。
 * 対象プリセット: drizzle, deno（full-split 時）
 */
function formatSectionWithMetadata(section, titleMap) {
    const urlMatch = section.match(/^(?:Source|URL):\s*(https?:\/\/\S+)/m);
    if (!urlMatch) {
        return section;
    }
    const sourceUrl = urlMatch[1];
    const title = titleMap.get(sourceUrl);
    const lines = section.split("\n");
    const bodyLines = [];
    let foundH1 = false;
    for (const line of lines) {
        const trimmed = line.trim();
        if (/^(?:Source|URL):\s*https?:\/\//.test(trimmed))
            continue;
        if (/^import\s+.+\s+from\s+['"]/.test(trimmed))
            continue;
        if (!foundH1 && title && /^# .+$/.test(trimmed)) {
            const h1Text = trimmed.slice(2).trim();
            if (h1Text === title) {
                foundH1 = true;
                continue;
            }
        }
        bodyLines.push(line);
    }
    while (bodyLines.length > 0 && bodyLines[0].trim() === "") {
        bodyLines.shift();
    }
    const fm = ["---"];
    if (title) {
        fm.push(`title: "${title}"`);
    }
    fm.push(`source: ${sourceUrl}`);
    fm.push("---");
    fm.push("");
    if (title && (bodyLines.length === 0 || !bodyLines[0].startsWith("# "))) {
        fm.push(`# ${title}`);
        fm.push("");
    }
    return fm.join("\n") + bodyLines.join("\n");
}
/**
 * セクションをそのまま返す（整形不要）。
 */
function formatSectionPassthrough(_section, _titleMap) {
    return _section;
}
/** フォーマッタ名から関数を解決する */
function resolveSectionFormatter(name) {
    switch (name) {
        case "metadata-to-frontmatter":
            return formatSectionWithMetadata;
        case "passthrough":
        default:
            return formatSectionPassthrough;
    }
}
/**
 * セクション内容からファイル名を導出する。
 */
function deriveSectionFilename(section, index, usedNames) {
    let base;
    const titleMatch = section.match(/^title:\s*"?([^"\n]+)"?$/m);
    if (titleMatch) {
        base = slugify(titleMatch[1]) || `section-${index + 1}`;
    }
    else {
        const h1Match = section.match(/^# (.+)$/m);
        if (h1Match) {
            base = slugify(h1Match[1]) || `section-${index + 1}`;
        }
        else {
            const firstLine = section.split("\n")[0].trim();
            base = slugify(firstLine) || `section-${index + 1}`;
        }
    }
    let name = base;
    let counter = 2;
    while (usedNames.has(name)) {
        name = `${base}-${counter}`;
        counter++;
    }
    usedNames.add(name);
    return name;
}
function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
// =============================================================================
// 汎用プリセットヘルパー（プリセットファイルから呼び出し可能）
// =============================================================================
/**
 * individual プリセットの実行。
 * 各プリセットファイルの execute() から呼び出す共通ロジック。
 */
export async function fetchIndividual(src, outDir, options, stats, logger, llmsContent, meta) {
    if (!src.url) {
        logger.error(`[${src.name}] individual プリセットには url が必要ですが、設定されていません。`);
        return stats;
    }
    const resolvedUrl = src.url;
    const linkFormat = src.linkFormat ?? meta.linkFormat ?? "md";
    // individual: 各 URL を個別に取得
    // ソースと同じドメインのリンクのみ対象（別ドメインの GitHub 等を除外）
    const rawUrls = parseLlmsTxt(llmsContent, resolvedUrl);
    const sourceHost = new URL(resolvedUrl).host;
    const resolvedUrls = rawUrls
        .filter((url) => {
        try {
            return new URL(url).host === sourceHost;
        }
        catch {
            return false;
        }
    })
        .map((url) => {
        if (linkFormat === "clean" && !url.endsWith(".md")) {
            // clean URL → 末尾 / を除去して .md を付与
            const cleaned = url.endsWith("/") ? url.slice(0, -1) : url;
            return { url: cleaned + ".md", original: url };
        }
        return { url, original: url };
    })
        .filter(({ url }) => url.endsWith(".md") && !url.endsWith(".txt.md"));
    logger.info(`[${src.name}] ${resolvedUrls.length} 件の Markdown を取得します。`);
    if (options.dryRun) {
        logger.info(`[${src.name}] Dry-run: 以下の URL を取得予定:`);
        for (const { url } of resolvedUrls) {
            logger.info(`  ${url}`);
        }
        return stats;
    }
    mkdirSync(outDir, { recursive: true });
    // 除去パターンを meta から取得
    const stripHeader = meta.stripHeaderPattern ? new RegExp(meta.stripHeaderPattern) : null;
    const stripLine = meta.stripLinePattern ? new RegExp(meta.stripLinePattern) : null;
    for (const { url } of resolvedUrls) {
        const filename = basename(url);
        const outFile = join(outDir, filename);
        const result = await fetchMarkdown(url, outFile, options.force ?? false);
        if (result === "downloaded") {
            stats.downloaded++;
            // パターン除去（プリセット定義がある場合）
            if (stripHeader || stripLine) {
                try {
                    let content = readFileSync(outFile, "utf-8");
                    if (stripHeader) {
                        content = content.replace(stripHeader, "");
                    }
                    if (stripLine) {
                        content = content
                            .split("\n")
                            .filter((line) => !stripLine.test(line))
                            .join("\n");
                    }
                    writeFileSync(outFile, content, "utf-8");
                }
                catch (err) {
                    logger.debug?.(`[${src.name}] パターン除去でエラー: ${filename} — ${String(err)}`);
                }
            }
        }
        else if (result === "skipped")
            stats.skipped++;
        else {
            logger.debug?.(`[${src.name}] FAILED: ${filename}`);
            stats.failed++;
        }
    }
    // 画像処理
    if (options.images !== false) {
        await processImages(outDir, options.force ?? false, stats, logger, src.name);
    }
    // タイムスタンプ記録
    writeLastFetched(outDir);
    return stats;
}
/**
 * full-split プリセットの実行。
 * 各プリセットファイルの execute() から呼び出す共通ロジック。
 */
export async function fetchFullSplit(src, outDir, options, stats, logger, llmsContent, meta) {
    const fullUrl = src.fullUrl ?? meta.fullUrl;
    if (!fullUrl) {
        logger.error(`[${src.name}] fetchStrategy: full-split には fullUrl が必要です。`);
        return stats;
    }
    logger.info(`[${src.name}] llms-full.txt を取得中: ${fullUrl}`);
    let fullContent;
    try {
        fullContent = await fetchLlmsTxt(fullUrl);
    }
    catch (err) {
        logger.error(`[${src.name}] llms-full.txt の取得に失敗: ${String(err)}`);
        return stats;
    }
    if (options.dryRun) {
        logger.info(`[${src.name}] Dry-run: llms-full.txt を分割して保存予定`);
        return stats;
    }
    mkdirSync(outDir, { recursive: true });
    const splitPatternStr = src.splitPattern ?? meta.splitPattern;
    let splitPattern;
    try {
        splitPattern = new RegExp(splitPatternStr, "gm");
    }
    catch (err) {
        logger.error(`[${src.name}] 無効な splitPattern です: "${splitPatternStr}" — ${String(err)}`);
        return stats;
    }
    const matches = [...fullContent.matchAll(splitPattern)];
    const sections = [];
    if (matches.length === 0) {
        if (fullContent.trim()) {
            sections.push(fullContent);
        }
    }
    else {
        const before = fullContent.slice(0, matches[0].index);
        if (before.trim()) {
            sections.push(before);
        }
        for (let i = 0; i < matches.length; i++) {
            const start = matches[i].index;
            const end = i + 1 < matches.length ? matches[i + 1].index : fullContent.length;
            const section = fullContent.slice(start, end);
            if (section.trim()) {
                sections.push(section);
            }
        }
    }
    const titleMap = buildTitleMap(llmsContent);
    const usedNames = new Set();
    const formatter = resolveSectionFormatter(meta.sectionFormatter);
    const stripLine = meta.stripLinePattern ? new RegExp(meta.stripLinePattern) : null;
    for (let i = 0; i < sections.length; i++) {
        let section = formatter(sections[i], titleMap);
        if (stripLine) {
            section = section
                .split("\n")
                .filter((line) => !stripLine.test(line))
                .join("\n");
        }
        const filename = deriveSectionFilename(section, i, usedNames);
        const outFile = join(outDir, `${filename}.md`);
        if (!options.force && existsSync(outFile)) {
            stats.skipped++;
            continue;
        }
        writeFileSync(outFile, section, "utf-8");
        stats.downloaded++;
    }
    writeLastFetched(outDir);
    return stats;
}
// =============================================================================
// 単一ソース処理
// =============================================================================
async function fetchSource(src, projectPath, docsOutputDir, options, logger) {
    const stats = createEmptyStats();
    const outDir = resolveOutputDir(projectPath, src.name, src.outputDir, docsOutputDir);
    // プリセット meta を解決して src の不足フィールドを補完する
    const presetMeta = await resolvePresetMeta(src.name);
    // url が未設定の場合はプリセット meta から補完する
    const resolvedUrl = src.url ?? presetMeta?.url;
    if (!resolvedUrl) {
        logger.error(`[${src.name}] URL が指定されておらず、プリセット "${src.name}" も見つかりません。` +
            " shirokuma-docs docs fetch <name> で取得してください。");
        return stats;
    }
    // 補完済みの src を作成（元の src を変更しない）
    const resolvedSrc = { ...src, url: resolvedUrl };
    // プリセットファイルの解決: プリセット名 = ファイル名の規約、またはカスタムプリセット名
    const strategyFile = presetMeta ? src.name : (resolvedSrc.fetchStrategy && !BUILTIN_STRATEGIES.has(resolvedSrc.fetchStrategy)
        ? resolvedSrc.fetchStrategy
        : null);
    if (strategyFile) {
        try {
            const mod = await import(`./presets/${strategyFile}.js`);
            return mod.execute(resolvedSrc, outDir, options, stats, logger);
        }
        catch (err) {
            logger.error(`[${src.name}] プリセット "${strategyFile}" の読み込みに失敗しました。` +
                ` presets/${strategyFile}.ts が存在するか確認してください。: ${String(err)}`);
            return stats;
        }
    }
    // --- フォールバック: STRATEGY_FILE_MAP にないカスタム individual/full-split ---
    // config で fetchStrategy: "individual" / "full-split" を直接指定したカスタムソース用
    const fetchStrategy = resolvedSrc.fetchStrategy ?? presetMeta?.fetchStrategy ?? "individual";
    logger.info(`[${src.name}] llms.txt を取得中: ${resolvedUrl}`);
    let llmsContent;
    try {
        llmsContent = await fetchLlmsTxt(resolvedUrl);
    }
    catch (err) {
        logger.error(`[${src.name}] llms.txt の取得に失敗: ${String(err)}`);
        return stats;
    }
    // llms.txt をルートに保存
    if (!options.dryRun) {
        const docsRoot = resolve(projectPath, docsOutputDir ?? ".shirokuma/docs");
        mkdirSync(docsRoot, { recursive: true });
        writeFileSync(join(docsRoot, `${src.name}-llms.txt`), llmsContent, "utf-8");
    }
    const rawUrls = parseLlmsTxt(llmsContent, resolvedUrl);
    logger.info(`[${src.name}] ${rawUrls.length} 件のリンクを検出しました。`);
    if (fetchStrategy === "full-split") {
        const splitPatternStr = resolvedSrc.splitPattern ?? "^# ";
        const fallbackMeta = {
            url: resolvedUrl,
            fetchStrategy: "full-split",
            fullUrl: resolvedSrc.fullUrl ?? "",
            splitPattern: splitPatternStr,
        };
        return await fetchFullSplit(resolvedSrc, outDir, options, stats, logger, llmsContent, fallbackMeta);
    }
    // individual フォールバック
    const fallbackMeta = {
        url: resolvedUrl,
        fetchStrategy: "individual",
        linkFormat: resolvedSrc.linkFormat ?? "md",
    };
    return await fetchIndividual(resolvedSrc, outDir, options, stats, logger, llmsContent, fallbackMeta);
}
// =============================================================================
// auto-detect ヘルパー
// =============================================================================
/**
 * --auto-detect 用: package.json からプリセットを検出し、未 fetch のソースを fetch する。
 * - not-fetched: fetch する
 * - ready:       --force がある場合のみ対象
 */
async function runAutoDetect(projectPath, options, logger) {
    // 動的 import: detect.ts は fetch.ts の resolvePresetMeta / listPresetNames を
    // 静的 import しているため、fetch.ts → detect.ts の静的 import は循環依存になる。
    // detect.ts → fetch.ts (static) → detect.ts のサイクルを回避するため動的 import を使用。
    const { discoverPresetsFromPackageJson } = await import("./detect.js");
    const packageJsonPath = resolve(projectPath, "package.json");
    if (!existsSync(packageJsonPath)) {
        logger.error(`package.json が見つかりません: ${packageJsonPath}\n` +
            "Node.js プロジェクトのルートディレクトリで実行してください。");
        return 1;
    }
    const detected = await discoverPresetsFromPackageJson(projectPath);
    // fetch 対象を絞り込む
    // - not-fetched: 対象
    // - ready: --force がある場合のみ対象
    const targets = detected.filter((r) => {
        if (r.status === "ready")
            return options.force === true;
        return true; // not-fetched
    });
    if (targets.length === 0) {
        const total = detected.length;
        if (total === 0) {
            logger.info("[auto-detect] ビルトインプリセットにマッチする依存関係が見つかりませんでした。");
        }
        else {
            logger.info(`[auto-detect] ${total} 件検出済み（全て fetch 済み）。--force を使うと再取得できます。スキップ: ${total} 件`);
        }
        return 0;
    }
    logger.info(`[auto-detect] ${targets.length} 件のソースを処理します。`);
    const config = loadConfig(projectPath, "shirokuma-docs.config.yaml");
    let totalFailed = 0;
    for (const r of targets) {
        const src = { name: r.source };
        if (options.dryRun) {
            logger.info(`[auto-detect][dry-run] "${r.source}" を fetch 予定`);
            continue;
        }
        const stats = await fetchSource(src, projectPath, config.docs?.outputDir, options, logger);
        totalFailed += stats.failed;
        logFetchStats(src.name, stats, options.images !== false, logger);
    }
    // manifest 更新（dry-run 時はスキップ、失敗しても fetch 結果には影響させない）
    if (!options.dryRun) {
        try {
            // manifest 用ソースリスト: fetch 済みディレクトリをスキャン
            const manifestSources = discoverFilesystemSources(projectPath, config.docs?.outputDir);
            await writeManifest(projectPath, manifestSources, config.docs?.outputDir, resolvePresetPackageName);
        }
        catch (err) {
            logger.warn(`MANIFEST.md の更新に失敗しました: ${err instanceof Error ? err.message : err}`);
        }
    }
    return totalFailed > 0 ? 1 : 0;
}
// =============================================================================
// Handler
// =============================================================================
export async function cmdFetch(options, logger) {
    const projectPath = options.project ?? process.cwd();
    // --auto-detect と [source] 引数は排他
    if (options.autoDetect && options.source) {
        logger.error("--auto-detect と [source] 引数は同時に指定できません。\n" +
            "特定のソースを取得するには: shirokuma-docs docs fetch <source>\n" +
            "自動検出で取得するには:     shirokuma-docs docs fetch --auto-detect");
        return 1;
    }
    // --auto-detect モードは専用パスで処理
    if (options.autoDetect) {
        return runAutoDetect(projectPath, options, logger);
    }
    const config = loadConfig(projectPath, "shirokuma-docs.config.yaml");
    // --- プリセット名直接指定パス ---
    // options.source が PRESET_NAMES に含まれる場合は config 登録なしでも fetch する。
    // このパスは後続のカスタムソースチェックより前に一括分岐する。
    if (options.source && PRESET_NAMES.includes(options.source)) {
        const presetSrc = { name: options.source };
        const stats = await fetchSource(presetSrc, projectPath, config.docs?.outputDir, options, logger);
        // dry-run 時は統計表示・manifest 更新をスキップ
        if (!options.dryRun) {
            logFetchStats(presetSrc.name, stats, options.images !== false, logger);
            // manifest 更新: fetch 済みディレクトリをスキャンして最新状態を反映
            try {
                const manifestSources = discoverFilesystemSources(projectPath, config.docs?.outputDir);
                await writeManifest(projectPath, manifestSources, config.docs?.outputDir, resolvePresetPackageName);
            }
            catch (err) {
                logger.warn(`MANIFEST.md の更新に失敗しました: ${err instanceof Error ? err.message : err}`);
            }
        }
        return stats.failed > 0 ? 1 : 0;
    }
    // カスタムソース（PRESET_NAMES 以外）: ファイルシステムスキャンで検索
    const allSources = discoverFilesystemSources(projectPath, config.docs?.outputDir);
    if (allSources.length === 0) {
        logger.error("取得済みのドキュメントがありません。\n" +
            "取得するには: shirokuma-docs docs fetch <name>");
        return 1;
    }
    // 対象ソースを絞り込む
    let targets = allSources;
    if (options.source) {
        targets = allSources.filter((s) => s.name === options.source);
        if (targets.length === 0) {
            logger.error(`ソース "${options.source}" が見つかりません。\n` +
                `取得済み: ${allSources.map((s) => s.name).join(", ")}`);
            return 1;
        }
    }
    let totalDownloaded = 0;
    let totalFailed = 0;
    for (const src of targets) {
        const stats = await fetchSource(src, projectPath, config.docs?.outputDir, options, logger);
        totalDownloaded += stats.downloaded;
        totalFailed += stats.failed;
        if (options.dryRun)
            continue;
        logFetchStats(src.name, stats, options.images !== false, logger);
    }
    // manifest 更新（dry-run 時はスキップ、失敗しても fetch 結果には影響させない）
    if (!options.dryRun) {
        try {
            // fetch 後のディレクトリをスキャンして最新状態を反映
            const manifestSources = discoverFilesystemSources(projectPath, config.docs?.outputDir);
            await writeManifest(projectPath, manifestSources, config.docs?.outputDir, resolvePresetPackageName);
        }
        catch (err) {
            logger.warn(`MANIFEST.md の更新に失敗しました: ${err instanceof Error ? err.message : err}`);
        }
    }
    return totalFailed > 0 ? 1 : 0;
}
//# sourceMappingURL=fetch.js.map