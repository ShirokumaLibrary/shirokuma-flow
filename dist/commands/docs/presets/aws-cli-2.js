/**
 * aws-cli-2 プリセット
 *
 * AWS CLI v2 ユーザーガイド向け fetch プリセット。
 * docs.aws.amazon.com/cli/latest/userguide/llms.txt からセクション構造を解析し、
 * 各 HTML ページを fetch → turndown で Markdown に変換してディレクトリ分割保存する。
 *
 * llms.txt 構造:
 * - `## [セクション名](url)` でセクションが始まる
 * - `- [タイトル](*.html)` でページエントリが続く
 * セクションごとにサブディレクトリを作成し、スラッグ化したタイトルでファイルを保存する。
 *
 * 並行度制御: 同時に CONCURRENCY 件の HTML fetch を実行し、サーバー負荷を抑える。
 * エラー処理: 個別ページの fetch 失敗はスキップして続行する。
 */
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import TurndownService from "turndown";
import { writeLastFetched } from "./shared.js";
// =============================================================================
// 定数
// =============================================================================
/** 同時 HTML fetch 数の上限 */
const CONCURRENCY = 5;
/** fetch 失敗の閾値：この数を超えたら全体を中断する */
const FAILURE_THRESHOLD = 50;
// =============================================================================
// メタ情報
// =============================================================================
/**
 * aws-cli-2 プリセットのメタ情報。
 * `resolvePresetMeta("aws-cli-2")` が動的 import でこれを取得する。
 * packageNames は未定義（AWS CLI は npm パッケージではなく detect 対象外）。
 */
export const meta = {
    url: "https://docs.aws.amazon.com/cli/latest/userguide/llms.txt",
};
/**
 * セクション名をディレクトリ名としてスラッグ化する。
 * 例: "About the AWS CLI" → "about"
 *     "Get started" → "get-started"
 *     "AWS CLI examples" → "examples"
 */
function slugifySection(name) {
    // "AWS CLI" / "AWS" といった冗長プレフィックスを除去
    const cleaned = name
        .replace(/^AWS CLI\s+/i, "")
        .replace(/^AWS\s+/i, "")
        .trim();
    return cleaned
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        || "section";
}
/**
 * ページタイトルをファイル名としてスラッグ化する。
 */
function slugifyTitle(title) {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        || "page";
}
/**
 * llms.txt の内容をセクション構造にパースする。
 * AWS CLI llms.txt のフォーマット:
 *   ## [セクション名](url)
 *   - [タイトル](url): 説明
 */
function parseLlmsTxtSections(content) {
    const sections = [];
    let current = null;
    for (const line of content.split("\n")) {
        const trimmed = line.trim();
        // セクション見出し: `## [name](url)` または `## name`
        const sectionMatch = trimmed.match(/^##\s+\[([^\]]+)\]\(([^)]+)\)/) ||
            trimmed.match(/^##\s+(.+)/);
        if (sectionMatch) {
            if (current) {
                sections.push(current);
            }
            current = {
                dir: slugifySection(sectionMatch[1]),
                pages: [],
            };
            continue;
        }
        // ページエントリ: `- [タイトル](url)` または `- [タイトル](url): 説明`
        if (current) {
            const pageMatch = trimmed.match(/^-\s+\[([^\]]+)\]\((https?:\/\/[^)]+\.html)\)/);
            if (pageMatch) {
                current.pages.push({ title: pageMatch[1], url: pageMatch[2] });
            }
        }
    }
    if (current) {
        sections.push(current);
    }
    return sections;
}
// =============================================================================
// HTML → Markdown 変換
// =============================================================================
/**
 * turndown サービスを生成する。
 * カスタムルールでコードフェンス変換（pre > code → ```）を有効化する。
 */
function createTurndownService() {
    const td = new TurndownService({
        headingStyle: "atx",
        codeBlockStyle: "fenced",
        fence: "```",
        bulletListMarker: "-",
    });
    // pre > code ブロックのコードフェンス変換
    // turndown の filter/replacement は実行時に DOM ノードを受け取るが、
    // tsconfig の lib に DOM が含まれないため unknown 経由でアクセスする
    td.addRule("fenced-code-block", {
        filter: (node) => {
            const child = node.firstChild;
            return (node.nodeName === "PRE" &&
                child !== null &&
                child?.nodeName === "CODE");
        },
        replacement: (_content, node) => {
            const code = node.firstChild;
            const classAttr = code?.getAttribute?.("class") ?? "";
            const langMatch = classAttr.match(/language-(\S+)/);
            const lang = langMatch ? langMatch[1] : "";
            const text = code?.textContent ?? "";
            return `\n\`\`\`${lang}\n${text}\n\`\`\`\n`;
        },
    });
    return td;
}
/**
 * AWS ドキュメント HTML からコンテンツ部分を抽出し Markdown に変換する。
 * ナビゲーション・ヘッダー・フッター・フィードバックセクションを除外する。
 */
function htmlToMarkdown(html, td) {
    // main コンテンツ領域を抽出する（AWS docs の構造に基づく）
    // <div id="main-content"> または <main> タグを優先
    let content = html;
    // コンテンツ部分の抽出パターン（優先順）
    const mainPatterns = [
        // AWS ドキュメントの main コンテンツ div
        // eslint-disable-next-line no-useless-escape
        /<div[^>]+id=["']main-content["'][^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]+id=["'](?:feedback|footer))/,
        // article タグ
        /<article[^>]*>([\s\S]*?)<\/article>/,
        // main タグ
        /<main[^>]*>([\s\S]*?)<\/main>/,
    ];
    for (const pattern of mainPatterns) {
        const match = html.match(pattern);
        if (match) {
            content = match[1];
            break;
        }
    }
    // ボイラープレート要素を除去（breadcrumb, nav, feedback, footer, scripts）
    content = content
        // ナビゲーション・パンくずリスト
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
        // フィードバックセクション
        .replace(/<div[^>]+(?:id|class)=["'][^"']*feedback[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, "")
        // フッター
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
        // スクリプト
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        // スタイル
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        // AWS "awsui" コンポーネント（ヘッダー/サイドバー）
        .replace(/<[^>]+awsui[^>]*>[\s\S]*?<\/[^>]+>/gi, "");
    return td.turndown(content).trim();
}
// =============================================================================
// インクリメンタルフェッチ
// =============================================================================
/**
 * HEAD リクエストで Last-Modified を確認し、既存ファイルより新しい場合のみ再取得が必要と判定する。
 * Last-Modified が返されない場合は常に再取得（true を返す）。
 */
async function needsUpdate(url, outFile) {
    let localMtime;
    try {
        localMtime = statSync(outFile).mtime;
    }
    catch {
        return true;
    }
    try {
        const headRes = await fetch(url, { method: "HEAD" });
        const lastModified = headRes.headers.get("last-modified");
        if (!lastModified)
            return true;
        return new Date(lastModified) > localMtime;
    }
    catch {
        return true;
    }
}
// =============================================================================
// 並行処理ユーティリティ
// =============================================================================
/**
 * タスク配列を concurrency 制限付きで並行実行する。
 * 各 worker は共有 index から次のタスクを取得する。JS はシングルスレッドなので
 * index++ の読み取りと加算の間に他の worker が割り込むことはなく、レース条件は発生しない。
 */
async function runWithConcurrency(tasks, concurrency) {
    const results = [];
    let index = 0;
    async function worker() {
        while (index < tasks.length) {
            const i = index++;
            results[i] = await tasks[i]();
        }
    }
    const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
    await Promise.all(workers);
    return results;
}
// =============================================================================
// プリセットエントリーポイント
// =============================================================================
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export async function execute(src, outDir, options, stats, logger) {
    const llmsUrl = src.url ?? meta.url;
    // llms.txt を取得
    logger.info(`[${src.name}] llms.txt を取得中: ${llmsUrl}`);
    let llmsContent;
    try {
        const res = await fetch(llmsUrl);
        if (!res.ok) {
            logger.error(`[${src.name}] llms.txt の取得に失敗しました: ${llmsUrl} (${res.status})`);
            return stats;
        }
        llmsContent = await res.text();
    }
    catch (err) {
        logger.error(`[${src.name}] llms.txt の取得に失敗: ${String(err)}`);
        return stats;
    }
    // llms.txt を出力ディレクトリに保存
    if (!options.dryRun) {
        mkdirSync(outDir, { recursive: true });
        writeFileSync(join(outDir, "llms.txt"), llmsContent, "utf-8");
    }
    // セクション構造をパース
    const sections = parseLlmsTxtSections(llmsContent);
    const totalPages = sections.reduce((sum, s) => sum + s.pages.length, 0);
    logger.info(`[${src.name}] ${sections.length} セクション、${totalPages} ページを検出しました。`);
    if (options.dryRun) {
        logger.info(`[${src.name}] Dry-run: 以下のページを取得予定:`);
        for (const section of sections) {
            for (const page of section.pages) {
                logger.info(`  [${section.dir}] ${page.title}: ${page.url}`);
            }
        }
        return stats;
    }
    // 出力ディレクトリを作成
    mkdirSync(outDir, { recursive: true });
    const td = createTurndownService();
    const pageTasks = [];
    for (const section of sections) {
        const sectionDir = join(outDir, section.dir);
        for (const page of section.pages) {
            const filename = slugifyTitle(page.title) + ".md";
            const outFile = join(sectionDir, filename);
            pageTasks.push({ section, page, outFile });
        }
    }
    // セクションディレクトリを事前に作成
    const sectionDirs = new Set(pageTasks.map((t) => join(outDir, t.section.dir)));
    for (const dir of sectionDirs) {
        mkdirSync(dir, { recursive: true });
    }
    // 並行 fetch タスクを生成
    const fetchTasks = pageTasks.map((task) => async () => {
        // 失敗閾値チェック
        if (stats.failed >= FAILURE_THRESHOLD) {
            return "failed";
        }
        // インクリメンタルチェック
        if (!options.force) {
            const update = await needsUpdate(task.page.url, task.outFile);
            if (!update) {
                return "skipped";
            }
        }
        try {
            const res = await fetch(task.page.url);
            if (!res.ok) {
                logger.debug?.(`[${src.name}] FAILED (${res.status}): ${task.page.url}`);
                return "failed";
            }
            const html = await res.text();
            const markdown = htmlToMarkdown(html, td);
            writeFileSync(task.outFile, markdown, "utf-8");
            return "downloaded";
        }
        catch (err) {
            logger.debug?.(`[${src.name}] FAILED: ${task.page.url} — ${String(err)}`);
            return "failed";
        }
    });
    // 並行実行
    const results = await runWithConcurrency(fetchTasks, CONCURRENCY);
    // 統計を集計
    for (const result of results) {
        if (result === "downloaded")
            stats.downloaded++;
        else if (result === "skipped")
            stats.skipped++;
        else
            stats.failed++;
    }
    // 失敗閾値チェック：超過時は警告ログ
    if (stats.failed >= FAILURE_THRESHOLD) {
        logger.error(`[${src.name}] fetch 失敗が閾値 (${FAILURE_THRESHOLD}) を超えました。` +
            " ネットワーク接続またはドキュメント URL を確認してください。");
    }
    writeLastFetched(outDir);
    return stats;
}
//# sourceMappingURL=aws-cli-2.js.map