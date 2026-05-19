/**
 * generate command - Commander.js nested subcommand factory
 *
 * Creates the top-level `generate` Command with all doc-generation subcommands registered.
 * Each subcommand imports its handler dynamically in the action handler.
 *
 * Usage in index.ts:
 *   import { createGenerateCommand } from "./commands/generate/index.js";
 *   program.addCommand(createGenerateCommand());
 */
// Commander.js mergeOpts returns a merged options object typed via as-cast at the boundary.
// Dynamic imports mean each sub-option type is not statically known here.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { Command } from "commander";
import { setExitCode } from "../../utils/cli-helpers.js";
import { validateProjectPath } from "../../utils/sanitize.js";
// =============================================================================
// Helpers
// =============================================================================
/**
 * Merge parent options with local options for subcommand action handlers.
 * Parent provides: -p/--project, -c/--config, -o/--output, -v/--verbose
 *
 * Returns an intersection of GenerateCommonOptions and caller-specific options.
 * The cast is safe because Commander.js registers only typed options at runtime.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mergeOpts(command, localOpts) {
    return { ...(command.parent?.opts() ?? {}), ...localOpts };
}
// =============================================================================
// Factory Function
// =============================================================================
export function createGenerateCommand() {
    const generate = new Command("generate")
        .description("ドキュメント生成 (all, typedoc, schema, deps, test-cases, portal, coverage, search-index, link-docs, feature-map, overview, screenshots, details, impact, api-tools, i18n, packages, github-data)");
    // Common parent options (available to all subcommands via command.parent?.opts())
    generate
        .option("-p, --project <path>", "プロジェクトパス", process.cwd())
        .option("-c, --config <file>", "設定ファイルパス", "shirokuma-docs.config.yaml")
        .option("-o, --output <dir>", "出力ディレクトリ")
        .option("-v, --verbose", "詳細ログ出力");
    // パストラバーサル対策: 全サブコマンドの実行前にプロジェクトパスを検証
    generate.hook("preAction", (thisCommand) => {
        const opts = thisCommand.opts();
        if (opts.project) {
            opts.project = validateProjectPath(opts.project);
        }
    });
    // ---------------------------------------------------------------------------
    // all (default: runs when `generate` is called without subcommand)
    // ---------------------------------------------------------------------------
    generate
        .command("all", { isDefault: true })
        .description("全てのドキュメントを生成")
        .option("--with-github", "GitHub Issues/Discussions データを含める")
        .action(async (localOpts, command) => {
        const options = mergeOpts(command, localOpts);
        const { cmdGenerateAll } = await import("./all.js");
        setExitCode(await cmdGenerateAll(options));
    });
    // ---------------------------------------------------------------------------
    // typedoc
    // ---------------------------------------------------------------------------
    generate
        .command("typedoc")
        .description("TypeDoc API ドキュメントを生成")
        .action(async (localOpts, command) => {
        const options = mergeOpts(command, localOpts);
        const { typedocCommand } = await import("./typedoc.js");
        setExitCode(await typedocCommand(options));
    });
    // ---------------------------------------------------------------------------
    // schema
    // ---------------------------------------------------------------------------
    generate
        .command("schema")
        .description("データベーススキーマドキュメント (DBML, SVG) を生成")
        .action(async (localOpts, command) => {
        const options = mergeOpts(command, localOpts);
        const { schemaCommand } = await import("./schema.js");
        setExitCode(await schemaCommand(options));
    });
    // ---------------------------------------------------------------------------
    // deps
    // ---------------------------------------------------------------------------
    generate
        .command("deps")
        .description("依存関係グラフを生成")
        .action(async (localOpts, command) => {
        const options = mergeOpts(command, localOpts);
        const { depsCommand } = await import("./deps.js");
        setExitCode(await depsCommand(options));
    });
    // ---------------------------------------------------------------------------
    // test-cases
    // ---------------------------------------------------------------------------
    generate
        .command("test-cases")
        .description("テストケース一覧を生成")
        .action(async (localOpts, command) => {
        const options = mergeOpts(command, localOpts);
        const { testCasesCommand } = await import("./test-cases.js");
        setExitCode(await testCasesCommand(options));
    });
    // ---------------------------------------------------------------------------
    // portal
    // ---------------------------------------------------------------------------
    generate
        .command("portal")
        .description("ドキュメントポータル HTML を生成 (Next.js + shadcn/ui)")
        .option("-f, --format <format>", "出力形式 (card | document)", "card")
        .option("--with-github", "GitHub Issues/Discussions データを含める")
        .action(async (localOpts, command) => {
        const options = mergeOpts(command, localOpts);
        const { portalCommand } = await import("./portal.js");
        setExitCode(await portalCommand(options));
    });
    // ---------------------------------------------------------------------------
    // coverage
    // ---------------------------------------------------------------------------
    generate
        .command("coverage")
        .description("テストカバレッジレポートを生成")
        .option("-f, --format <format>", "出力フォーマット (html, json, summary)", "summary")
        .option("--fail-under <number>", "閾値未満で失敗 (%)", parseInt)
        .action(async (localOpts, command) => {
        const options = mergeOpts(command, localOpts);
        const { coverageCommand } = await import("./coverage.js");
        setExitCode(coverageCommand(options));
    });
    // ---------------------------------------------------------------------------
    // search-index
    // ---------------------------------------------------------------------------
    generate
        .command("search-index")
        .description("全文検索用インデックスを生成")
        .action(async (localOpts, command) => {
        const options = mergeOpts(command, localOpts);
        const { searchIndexCommand } = await import("./search-index.js");
        setExitCode(await searchIndexCommand(options));
    });
    // ---------------------------------------------------------------------------
    // link-docs
    // ---------------------------------------------------------------------------
    generate
        .command("link-docs")
        .description("API-テスト関連付けドキュメントを生成")
        .action(async (localOpts, command) => {
        const options = mergeOpts(command, localOpts);
        const { linkDocsCommand } = await import("./link-docs.js");
        setExitCode(await linkDocsCommand(options));
    });
    // ---------------------------------------------------------------------------
    // feature-map
    // ---------------------------------------------------------------------------
    generate
        .command("feature-map")
        .description("機能階層マップを生成 (Screen -> Component -> Action -> Table)")
        .action(async (localOpts, command) => {
        const options = mergeOpts(command, localOpts);
        const { featureMapCommand } = await import("./feature-map.js");
        setExitCode(featureMapCommand(options));
    });
    // ---------------------------------------------------------------------------
    // overview
    // ---------------------------------------------------------------------------
    generate
        .command("overview")
        .description("プロジェクト概要ページを生成")
        .action(async (localOpts, command) => {
        const options = mergeOpts(command, localOpts);
        const { overviewCommand } = await import("./overview.js");
        setExitCode(overviewCommand(options));
    });
    // ---------------------------------------------------------------------------
    // screenshots
    // ---------------------------------------------------------------------------
    generate
        .command("screenshots")
        .description("画面スクリーンショット撮影用 Playwright テストを生成")
        .option("-r, --run", "生成後にテストを実行")
        .action(async (localOpts, command) => {
        const options = mergeOpts(command, localOpts);
        const { screenshotsCommand } = await import("./screenshots.js");
        setExitCode(await screenshotsCommand(options));
    });
    // ---------------------------------------------------------------------------
    // details
    // ---------------------------------------------------------------------------
    generate
        .command("details")
        .description("各要素（Screen, Component, Action, Table）の詳細ページを生成")
        .action(async (localOpts, command) => {
        const options = mergeOpts(command, localOpts);
        const { detailsCommand } = await import("./details.js");
        setExitCode(detailsCommand(options));
    });
    // ---------------------------------------------------------------------------
    // impact
    // ---------------------------------------------------------------------------
    generate
        .command("impact")
        .description("変更影響分析 - 指定アイテムを変更した場合に影響を受ける箇所を表示")
        .option("-t, --target <name>", "分析対象のアイテム名またはファイルパス")
        .option("-d, --max-depth <n>", "最大探索深度", "5")
        .option("-f, --format <type>", "出力形式 (json|html|table)", "table")
        .action(async (localOpts, command) => {
        const options = mergeOpts(command, localOpts);
        const { impactCommand } = await import("./impact.js");
        setExitCode(impactCommand({
            output: options.output,
            target: options.target,
            maxDepth: parseInt(options.maxDepth, 10),
            format: options.format,
        }));
    });
    // ---------------------------------------------------------------------------
    // api-tools
    // ---------------------------------------------------------------------------
    generate
        .command("api-tools")
        .description("MCP (Model Context Protocol) ツールドキュメントを生成")
        .action(async (localOpts, command) => {
        const options = mergeOpts(command, localOpts);
        const { runApiTools } = await import("./api-tools.js");
        setExitCode(await runApiTools({
            projectPath: options.project,
            configPath: options.config,
            outputDir: options.output,
        }));
    });
    // ---------------------------------------------------------------------------
    // i18n
    // ---------------------------------------------------------------------------
    generate
        .command("i18n")
        .description("i18n 翻訳ファイルドキュメントを生成")
        .action(async (localOpts, command) => {
        const options = mergeOpts(command, localOpts);
        const { i18nCommand } = await import("./i18n.js");
        setExitCode(i18nCommand(options));
    });
    // ---------------------------------------------------------------------------
    // packages
    // ---------------------------------------------------------------------------
    generate
        .command("packages")
        .description("モノレポ共有パッケージのドキュメントを生成")
        .action(async (localOpts, command) => {
        const options = mergeOpts(command, localOpts);
        const { packagesCommand } = await import("./packages.js");
        setExitCode(packagesCommand(options));
    });
    // ---------------------------------------------------------------------------
    // github-data
    // ---------------------------------------------------------------------------
    generate
        .command("github-data")
        .description("GitHub Issues/Discussions データを JSON 形式で生成")
        .action(async (localOpts, command) => {
        const options = mergeOpts(command, localOpts);
        const { githubDataCommand } = await import("./github-data.js");
        try {
            await githubDataCommand(options);
        }
        catch {
            setExitCode(1);
        }
    });
    return generate;
}
//# sourceMappingURL=index.js.map