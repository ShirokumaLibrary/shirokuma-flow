/**
 * GitHub データのローカルキャッシュユーティリティ (#1768, #1874)
 *
 * GitHub データ（Issue、PR、Discussion およびそのコメント）を
 * `.shirokuma/github/` にローカルファイルとして保存する。
 *
 * ファイル構造:
 * ```
 * .shirokuma/github/{org}/{repo}/
 * ├── issues/{number}/body.md            # Issue 本体
 * ├── issues/{number}/{databaseId}.md    # Issue コメント
 * ├── pulls/{number}/body.md             # PR 本体
 * ├── pulls/{number}/{databaseId}.md     # PR コメント
 * ├── discussions/{number}/body.md       # Discussion 本体
 * ├── discussions/{number}/{databaseId}.md  # Discussion コメント
 * └── open-issues.md                     # オープン Issue/PR のインデックス
 * ```
 *
 * Discussion のスレッド返信は、トップレベルコメントと同じ `{databaseId}.md` 形式で保存され、
 * frontmatter の `reply_to` フィールドに返信先コメントの `databaseId` を保持する。
 *
 * frontmatter + Markdown body 形式。
 * frontmatter にメタデータ（number, type, updated_at, cached_at）を保持。
 */
import { join } from "node:path";
import { writeFile, readFile, ensureDir, listFiles } from "./file.js";
import { formatFrontmatter } from "./formatters.js";
import { parseFrontmatter } from "../validators/frontmatter.js";
// =============================================================================
// 定数
// =============================================================================
/** キャッシュディレクトリのデフォルトパス */
export const GITHUB_CACHE_DIR = ".shirokuma/github";
/** type → ディレクトリ名マッピング */
export const TYPE_DIR_MAP = {
    issue: "issues",
    pull_request: "pulls",
    discussion: "discussions",
};
// =============================================================================
// パス解決
// =============================================================================
/**
 * type から ディレクトリ名に変換する。
 */
function typeToDir(type) {
    return TYPE_DIR_MAP[type];
}
/**
 * アイテム本体のキャッシュファイルパスを返す。
 * 新構造: `{baseDir}/{org}/{repo}/{typeDir}/{number}/body.md`
 *
 * @param number - Issue / PR / Discussion 番号
 * @param type - アイテム種別
 * @param org - GitHub 組織名
 * @param repo - リポジトリ名
 * @param baseDir - キャッシュのベースディレクトリ（デフォルト: `.shirokuma/github`）
 * @returns ファイルパス
 */
export function getCachePath(number, type, org, repo, baseDir = GITHUB_CACHE_DIR) {
    return join(baseDir, org, repo, typeToDir(type), `${number}`, "body.md");
}
/**
 * コメントのキャッシュファイルパスを返す。
 * 新構造: `{baseDir}/{org}/{repo}/{typeDir}/{number}/{databaseId}.md`
 *
 * @param number - 親アイテム番号
 * @param databaseId - コメントの databaseId
 * @param type - 親アイテム種別
 * @param org - GitHub 組織名
 * @param repo - リポジトリ名
 * @param baseDir - キャッシュのベースディレクトリ（デフォルト: `.shirokuma/github`）
 * @returns ファイルパス
 */
export function getCommentCachePath(number, databaseId, type, org, repo, baseDir = GITHUB_CACHE_DIR) {
    return join(baseDir, org, repo, typeToDir(type), `${number}`, `${databaseId}.md`);
}
/**
 * open-issues.md インデックスファイルのパスを返す。
 *
 * @param org - GitHub 組織名
 * @param repo - リポジトリ名
 * @param baseDir - キャッシュのベースディレクトリ
 */
export function getOpenIssuesIndexPath(org, repo, baseDir = GITHUB_CACHE_DIR) {
    return join(baseDir, org, repo, "open-issues.md");
}
// =============================================================================
// Frontmatter シリアライズ / デシリアライズ
//
// 既存ユーティリティを再利用:
// - formatFrontmatter (src/utils/formatters.ts): YAML シリアライズ + body 分離
// - parseFrontmatter (src/validators/frontmatter.ts): yaml ライブラリによるパース
// =============================================================================
/**
 * メタデータ + body を frontmatter 付き Markdown テキストに変換する。
 * `formatFrontmatter` に委任し、body を `data.body` として渡す。
 */
function serializeCache(metadata, body) {
    return formatFrontmatter({ ...metadata, body });
}
/**
 * frontmatter 付き Markdown テキストをパースする。
 * `parseFrontmatter` に委任する。
 */
function deserializeCache(raw) {
    const parsed = parseFrontmatter(raw);
    if (!parsed.hasFrontmatter || parsed.parseError || !parsed.data)
        return null;
    return { metadata: parsed.data, body: parsed.content.trim() };
}
// =============================================================================
// アイテム本体のキャッシュ read/write
// =============================================================================
/**
 * アイテム本体のキャッシュを書き込む。
 *
 * frontmatter に `cached_at`（現在時刻）を含む。
 *
 * @param number - Issue / PR / Discussion 番号
 * @param metadata - 書き込むメタデータ（`cached_at` は自動設定）
 * @param body - Markdown 本文（省略可）
 * @param org - GitHub 組織名
 * @param repo - リポジトリ名
 * @param baseDir - キャッシュのベースディレクトリ
 */
export function writeCache(number, metadata, body = "", org, repo, baseDir = GITHUB_CACHE_DIR) {
    const fullMetadata = {
        ...metadata,
        cached_at: new Date().toISOString(),
    };
    const content = serializeCache({ ...fullMetadata }, body);
    const filePath = getCachePath(number, metadata.type, org, repo, baseDir);
    ensureDir(join(baseDir, org, repo, typeToDir(metadata.type), `${number}`));
    writeFile(filePath, content);
}
/**
 * アイテム本体のキャッシュを読み込む。
 *
 * @param number - Issue / PR / Discussion 番号
 * @param type - アイテム種別
 * @param org - GitHub 組織名
 * @param repo - リポジトリ名
 * @param baseDir - キャッシュのベースディレクトリ
 * @returns キャッシュエントリ、または存在しない場合は `null`
 */
export function readCache(number, type, org, repo, baseDir = GITHUB_CACHE_DIR) {
    const filePath = getCachePath(number, type, org, repo, baseDir);
    const raw = readFile(filePath);
    if (raw === null)
        return null;
    const parsed = deserializeCache(raw);
    if (!parsed)
        return null;
    // 型チェック: 必須フィールドが揃っているか確認
    const meta = parsed.metadata;
    if (typeof meta.number !== "number" || typeof meta.type !== "string")
        return null;
    return {
        metadata: meta,
        body: parsed.body,
        raw,
    };
}
// =============================================================================
// コメントのキャッシュ read/write
// =============================================================================
/**
 * コメントのキャッシュを書き込む。
 *
 * @param number - 親アイテム番号
 * @param databaseId - コメントの databaseId
 * @param metadata - 書き込むメタデータ（`cached_at` は自動設定）
 * @param body - Markdown 本文（省略可）
 * @param type - 親アイテム種別
 * @param org - GitHub 組織名
 * @param repo - リポジトリ名
 * @param baseDir - キャッシュのベースディレクトリ
 */
export function writeCommentCache(number, databaseId, metadata, body = "", type, org, repo, baseDir = GITHUB_CACHE_DIR) {
    const fullMetadata = {
        ...metadata,
        cached_at: new Date().toISOString(),
    };
    const content = serializeCache({ ...fullMetadata }, body);
    const filePath = getCommentCachePath(number, databaseId, type, org, repo, baseDir);
    ensureDir(join(baseDir, org, repo, typeToDir(type), `${number}`));
    writeFile(filePath, content);
}
/**
 * コメントのキャッシュを読み込む。
 *
 * @param number - 親アイテム番号
 * @param databaseId - コメントの databaseId
 * @param type - 親アイテム種別
 * @param org - GitHub 組織名
 * @param repo - リポジトリ名
 * @param baseDir - キャッシュのベースディレクトリ
 * @returns コメントキャッシュエントリ、または存在しない場合は `null`
 */
export function readCommentCache(number, databaseId, type, org, repo, baseDir = GITHUB_CACHE_DIR) {
    const filePath = getCommentCachePath(number, databaseId, type, org, repo, baseDir);
    const raw = readFile(filePath);
    if (raw === null)
        return null;
    const parsed = deserializeCache(raw);
    if (!parsed)
        return null;
    // 型チェック: 必須フィールドが揃っているか確認
    const meta = parsed.metadata;
    if (typeof meta.number !== "number" || typeof meta.database_id !== "number")
        return null;
    return {
        metadata: meta,
        body: parsed.body,
        raw,
    };
}
// =============================================================================
// type プローブ（type 不明時のキャッシュ検索）
// =============================================================================
/** type が不明な場合に issue → pull_request → discussion の順でキャッシュを検索する */
export function probeReadCache(number, org, repo, baseDir = GITHUB_CACHE_DIR) {
    for (const t of ["issue", "pull_request", "discussion"]) {
        const cached = readCache(number, t, org, repo, baseDir);
        if (cached)
            return cached;
    }
    return null;
}
// =============================================================================
// open-issues.md インデックス read/write
// =============================================================================
/**
 * open-issues.md インデックスを書き込む。
 * `items pull` / `items close` / `items reopen` の後に呼び出す。
 *
 * @param entries - オープンな Issue / PR のエントリ一覧
 * @param org - GitHub 組織名
 * @param repo - リポジトリ名
 * @param baseDir - キャッシュのベースディレクトリ
 */
export function writeOpenIssuesIndex(entries, org, repo, baseDir = GITHUB_CACHE_DIR) {
    const lines = [
        "| # | Type | Title | Status | Priority | Size |",
        "|---|------|-------|--------|----------|------|",
    ];
    for (const entry of entries) {
        const type = entry.type === "pull_request" ? "PR" : "issue";
        const status = entry.status ?? "";
        const priority = entry.priority ?? "";
        const size = entry.size ?? "";
        lines.push(`| ${entry.number} | ${type} | ${entry.title} | ${status} | ${priority} | ${size} |`);
    }
    const content = lines.join("\n") + "\n";
    const filePath = getOpenIssuesIndexPath(org, repo, baseDir);
    ensureDir(join(baseDir, org, repo));
    writeFile(filePath, content);
}
/**
 * open-issues.md インデックスを読み込む。
 *
 * @param org - GitHub 組織名
 * @param repo - リポジトリ名
 * @param baseDir - キャッシュのベースディレクトリ
 * @returns エントリ一覧、またはファイルが存在しない場合は空配列
 */
export function readOpenIssuesIndex(org, repo, baseDir = GITHUB_CACHE_DIR) {
    const filePath = getOpenIssuesIndexPath(org, repo, baseDir);
    const raw = readFile(filePath);
    if (raw === null)
        return [];
    const entries = [];
    const lines = raw.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // 先頭2行（ヘッダー + セパレーター）をスキップ
        if (i < 2)
            continue;
        if (!line.startsWith("|"))
            continue;
        const cols = line.split("|").map((s) => s.trim()).filter((_, ci) => ci > 0 && ci <= 6);
        if (cols.length < 6)
            continue;
        const number = parseInt(cols[0] ?? "", 10);
        if (isNaN(number))
            continue;
        const typeStr = cols[1] ?? "";
        const type = typeStr === "PR" ? "pull_request" : "issue";
        const title = cols[2] ?? "";
        const status = cols[3] || undefined;
        const priority = cols[4] || undefined;
        const size = cols[5] || undefined;
        entries.push({ number, type, title, status, priority, size });
    }
    return entries;
}
/**
 * 単一エントリを open-issues.md インデックスに追加または更新する（インクリメンタル）。
 * 既存インデックスを読み込み、該当エントリだけを差し替えて書き戻す。
 */
export function upsertOpenIssuesEntry(entry, org, repo, baseDir = GITHUB_CACHE_DIR) {
    const entries = readOpenIssuesIndex(org, repo, baseDir);
    const idx = entries.findIndex((e) => e.number === entry.number);
    if (idx >= 0) {
        entries[idx] = entry;
    }
    else {
        entries.push(entry);
        entries.sort((a, b) => a.number - b.number);
    }
    writeOpenIssuesIndex(entries, org, repo, baseDir);
}
/**
 * 指定番号のエントリを open-issues.md インデックスから削除する（インクリメンタル）。
 */
export function removeOpenIssuesEntry(number, org, repo, baseDir = GITHUB_CACHE_DIR) {
    const entries = readOpenIssuesIndex(org, repo, baseDir).filter((e) => e.number !== number);
    writeOpenIssuesIndex(entries, org, repo, baseDir);
}
/**
 * open-issues.md インデックスをフルリビルドする。
 * マイグレーション等で使用。通常のコマンドでは upsertOpenIssuesEntry / removeOpenIssuesEntry を使う。
 *
 * @param org - GitHub 組織名
 * @param repo - リポジトリ名
 * @param baseDir - キャッシュのベースディレクトリ
 */
export function rebuildOpenIssuesIndex(org, repo, baseDir = GITHUB_CACHE_DIR) {
    const issuesDir = join(baseDir, org, repo, "issues");
    const pullsDir = join(baseDir, org, repo, "pulls");
    const entries = [];
    // issues/ を走査
    for (const dir of [issuesDir, pullsDir]) {
        const type = dir === issuesDir ? "issue" : "pull_request";
        let files = [];
        try {
            files = listFiles(dir, { extensions: [".md"], recursive: true });
        }
        catch {
            // ディレクトリが存在しない場合はスキップ
            continue;
        }
        for (const filePath of files) {
            // body.md のみを対象（コメントファイルは除外）
            if (!filePath.endsWith("body.md"))
                continue;
            const raw = readFile(filePath);
            if (!raw)
                continue;
            const parsed = deserializeCache(raw);
            if (!parsed)
                continue;
            const meta = parsed.metadata;
            if (typeof meta.number !== "number")
                continue;
            // open 状態のもののみ（state が CLOSED でないもの）
            const state = typeof meta.state === "string" ? meta.state.toUpperCase() : "OPEN";
            if (state === "CLOSED")
                continue;
            entries.push({
                number: meta.number,
                type,
                title: typeof meta.title === "string" ? meta.title : "",
                status: typeof meta.status === "string" ? meta.status : undefined,
                priority: typeof meta.priority === "string" ? meta.priority : undefined,
                size: typeof meta.size === "string" ? meta.size : undefined,
            });
        }
    }
    // 番号でソート
    entries.sort((a, b) => a.number - b.number);
    writeOpenIssuesIndex(entries, org, repo, baseDir);
}
//# sourceMappingURL=github-cache.js.map