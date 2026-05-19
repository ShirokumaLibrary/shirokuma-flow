/**
 * docs detect subcommand - package.json の依存関係からドキュメントソースを自動検出
 *
 * package.json の dependencies + devDependencies を読み取り、
 * 全プリセットの packageNames マッピングで依存名 → プリセット名を逆引きする。
 * .last-fetched の存在で status を判定する。
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadConfig } from "../../utils/config.js";
import { resolvePresetMeta, listPresetNames } from "./fetch.js";
import { resolveOutputDir } from "./list.js";
// =============================================================================
// Core Detection Logic
// =============================================================================
/**
 * package.json の依存関係からプリセットを検出し、ステータスを付与した DetectResult[] を返す。
 * - package.json が存在しない場合は空配列を返す（エラーなし）
 * - fetch.ts / cmdDetect / cmdFetch --auto-detect から共通利用される
 */
export async function discoverPresetsFromPackageJson(projectPath) {
    // package.json を読み込む
    const packageJsonPath = resolve(projectPath, "package.json");
    if (!existsSync(packageJsonPath)) {
        return [];
    }
    let packageDeps;
    try {
        const raw = readFileSync(packageJsonPath, "utf-8");
        const pkg = JSON.parse(raw);
        packageDeps = new Set([
            ...Object.keys(pkg.dependencies ?? {}),
            ...Object.keys(pkg.devDependencies ?? {}),
        ]);
    }
    catch (err) {
        console.warn(`[discoverPresetsFromPackageJson] package.json のパースに失敗しました: ${String(err)}`);
        return [];
    }
    // config を読み込んで outputDir 設定を取得
    const config = loadConfig(projectPath, "shirokuma-docs.config.yaml");
    // 全プリセット名を取得し、packageNames を並列に解決して照合する
    const allPresetNames = listPresetNames();
    const allMetas = await Promise.all(allPresetNames.map(async (name) => ({ name, meta: await resolvePresetMeta(name) })));
    const results = [];
    for (const { name: presetName, meta } of allMetas) {
        if (!meta)
            continue;
        const packageNames = meta.packageNames ?? [];
        if (packageNames.length === 0)
            continue;
        // このプリセットの packageNames のうち、package.json に存在するものを収集
        const matchedPackages = packageNames.filter((pkg) => packageDeps.has(pkg));
        if (matchedPackages.length === 0)
            continue;
        // ステータスの判定: .last-fetched の存在で ready / not-fetched を判定
        const outDir = resolveOutputDir(projectPath, presetName, undefined, config.docs?.outputDir);
        const lastFetchedFile = join(outDir, ".last-fetched");
        const status = existsSync(lastFetchedFile) ? "ready" : "not-fetched";
        results.push({
            source: presetName,
            packages: matchedPackages,
            status,
        });
    }
    return results;
}
// =============================================================================
// Handler
// =============================================================================
export async function cmdDetect(options, logger) {
    const projectPath = options.project ?? process.cwd();
    // package.json を読み込む（存在チェックはここで行う）
    const packageJsonPath = resolve(projectPath, "package.json");
    if (!existsSync(packageJsonPath)) {
        logger.error(`package.json が見つかりません: ${packageJsonPath}\n` +
            "Node.js プロジェクトのルートディレクトリで実行してください。");
        return 1;
    }
    let results;
    try {
        results = await discoverPresetsFromPackageJson(projectPath);
    }
    catch (err) {
        logger.error(`package.json の読み込みに失敗しました: ${String(err)}`);
        return 1;
    }
    if (results.length === 0) {
        logger.info("ビルトインプリセットにマッチする依存関係が見つかりませんでした。\n" +
            "サポートされているプリセット一覧は `shirokuma-docs docs fetch --help` を参照してください。");
        return 0;
    }
    if (options.format === "json") {
        process.stdout.write(JSON.stringify(results, null, 2) + "\n");
        return 0;
    }
    // table-json 形式（デフォルト）
    const tableData = results.map((r) => ({
        Source: r.source,
        Packages: r.packages.join(", "),
        Status: r.status,
    }));
    process.stdout.write(JSON.stringify(tableData, null, 2) + "\n");
    return 0;
}
//# sourceMappingURL=detect.js.map