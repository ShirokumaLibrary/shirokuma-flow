/**
 * docs command - Commander.js nested subcommand factory
 *
 * llms.txt ベースのドキュメント管理コマンド。
 * Claude Code などの公式ドキュメントをローカルにフェッチ・検索できる。
 *
 * Usage in index.ts:
 *   import { createDocsCommand } from "./commands/docs/index.js";
 *   program.addCommand(createDocsCommand());
 */
// Commander.js action callbacks receive localOpts as any; parent opts cast via as at boundary.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Command } from "commander";
import { createActionLogger, setExitCode } from "../../utils/cli-helpers.js";
// =============================================================================
// Factory Function
// =============================================================================
export function createDocsCommand() {
    const docs = new Command("docs").description("ドキュメント管理 (fetch, search, list, remove, detect)");
    // Common parent options
    docs
        .option("-p, --project <path>", "プロジェクトパス")
        .option("-v, --verbose", "詳細ログ出力");
    // ---------------------------------------------------------------------------
    // fetch
    // ---------------------------------------------------------------------------
    docs
        .command("fetch [source]")
        .description("llms.txt からドキュメントを取得（ソース名省略時は全ソース）")
        .option("--force", "既存ファイルを強制再取得")
        .option("--dry-run", "ダウンロードせず取得予定 URL を表示")
        .option("--no-images", "画像 DL・SVG→Mermaid 変換をスキップ")
        .option("--auto-detect", "package.json の依存を解析し、プリセットにマッチする未 fetch ソースをまとめて取得")
        .action(async (source, localOpts, command) => {
        const parentOpts = command.parent?.opts() ?? {};
        const options = { ...parentOpts, ...localOpts, source };
        const { cmdFetch } = await import("./fetch.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdFetch(options, logger));
    });
    // ---------------------------------------------------------------------------
    // search
    // ---------------------------------------------------------------------------
    docs
        .command("search <query>")
        .description("ローカルに取得したドキュメントを横断検索")
        .option("--source <name>", "特定ソースのみ検索")
        .option("--regex", "正規表現モードで検索")
        .option("--format <format>", "出力形式: table-json, json (デフォルト: table-json)", "table-json")
        .option("--context <n>", "マッチ行の前後 n 行を表示", parseInt)
        .option("--limit <n>", "返す結果件数の上限", parseInt)
        .option("--section", "マッチ行を含む見出しセクション全体を返す")
        .action(async (query, localOpts, command) => {
        const parentOpts = command.parent?.opts() ?? {};
        const options = { ...parentOpts, ...localOpts, query };
        const { cmdSearch } = await import("./search.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdSearch(options, logger));
    });
    // ---------------------------------------------------------------------------
    // list
    // ---------------------------------------------------------------------------
    docs
        .command("list")
        .description("取得済みソースの一覧と最終取得日時を表示")
        .option("--format <format>", "出力形式: table-json, json (デフォルト: table-json)", "table-json")
        .action(async (localOpts, command) => {
        const parentOpts = command.parent?.opts() ?? {};
        const options = { ...parentOpts, ...localOpts };
        const { cmdList } = await import("./list.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdList(options, logger));
    });
    // ---------------------------------------------------------------------------
    // remove
    // ---------------------------------------------------------------------------
    docs
        .command("remove <name>")
        .description("ドキュメントのローカルファイルを削除")
        .option("--yes", "確認なしで削除")
        .action(async (name, localOpts, command) => {
        const parentOpts = command.parent?.opts() ?? {};
        const options = { ...parentOpts, ...localOpts, name };
        const { cmdRemove } = await import("./remove.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdRemove(options, logger));
    });
    // ---------------------------------------------------------------------------
    // detect
    // ---------------------------------------------------------------------------
    docs
        .command("detect")
        .description("package.json の依存関係からドキュメントソースを自動検出（プリセット逆引き）")
        .option("--format <format>", "出力形式: table-json, json (デフォルト: table-json)", "table-json")
        .action(async (localOpts, command) => {
        const parentOpts = command.parent?.opts() ?? {};
        const options = { ...parentOpts, ...localOpts };
        const { cmdDetect } = await import("./detect.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdDetect(options, logger));
    });
    return docs;
}
//# sourceMappingURL=index.js.map