/**
 * mergeCommanderOpts behavior tests
 *
 * Issue #2519: lint structure -f json で Commander の親子オプション解決により
 * `-f json` がサイレント破棄される問題のリグレッションテスト。
 *
 * 親 (e.g. lint) と 子 (e.g. structure) の両方が `-f, --format` を宣言している場合、
 * Commander v12+ は `-f json` を親で parse し、子の localOpts は default ("yaml") のまま。
 * 素朴な `{ ...parentOpts, ...localOpts }` merge では子の default が親の CLI 値を上書きしてしまう。
 *
 * Issue #2521 / #2523: このヘルパーは `flow` の `lint`/`skill` だけでなく `portal` 等の
 * 他パッケージからも利用される共通ユーティリティとして `@shirokuma-library/lint/commander-opts` に配置。
 *
 * @testdoc Commander 親子オプション解決の共通ヘルパーテスト
 */

import { describe, expect, it } from "vitest";
import { Command } from "commander";
import { mergeCommanderOpts } from "../src/commander-opts.js";

/**
 * 親 / 子の両方に `-f, --format` を宣言した最小 Commander ツリーを構築し、
 * 与えられた argv をパースして、子の action ハンドラで mergeCommanderOpts 後の options を返す。
 */
function runWithFormatShadowing(argv: string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const root = new Command();
    const lint = new Command("lint").option(
      "-f, --format <format>",
      "parent format",
      "terminal"
    );
    const sub = new Command("structure")
      .option("-f, --format <format>", "child format", "yaml")
      .action((localOpts: Record<string, unknown>, cmd: Command) => {
        resolve(mergeCommanderOpts(cmd, localOpts) as Record<string, unknown>);
      });
    lint.addCommand(sub);
    root.addCommand(lint);
    void root.parseAsync(argv, { from: "user" });
  });
}

describe("mergeCommanderOpts: parent/child option resolution", () => {
  /**
   * @testdoc `lint structure -f json` で子の default に上書きされず "json" が伝播する
   */
  it("should pass `-f json` to the child subcommand without being shadowed by child default", async () => {
    const opts = await runWithFormatShadowing(["lint", "structure", "-f", "json"]);
    expect(opts.format).toBe("json");
  });

  /**
   * @testdoc 引数なし時は子の default "yaml" が優先される
   */
  it("should use the child default (\"yaml\") when no explicit -f is given", async () => {
    const opts = await runWithFormatShadowing(["lint", "structure"]);
    expect(opts.format).toBe("yaml");
  });

  /**
   * @testdoc 子に明示的に `-f terminal` を指定した場合はその値が伝播する
   */
  it("should respect explicit child -f value", async () => {
    const opts = await runWithFormatShadowing(["lint", "structure", "-f", "terminal"]);
    expect(opts.format).toBe("terminal");
  });

  /**
   * @testdoc 親側に `-f json` を指定した場合（`lint -f json structure`）も子に伝播する
   */
  it("should pass parent-positioned `-f json` to the subcommand", async () => {
    const opts = await runWithFormatShadowing(["lint", "-f", "json", "structure"]);
    expect(opts.format).toBe("json");
  });
});

/**
 * 3 階層ツリー（root → discussions → templates → generate 相当）で grand parent の
 * option が伝播することを検証する。Issue #2525 で discussions/templates/index.ts 等の
 * 3 階層 inline merge を `mergeCommanderOpts` に統一するための前提機能。
 */
function runWithThreeLevels(argv: string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    // bare root (no name) — argv は最初のサブコマンド名から始める
    const root = new Command();
    const discussions = new Command("discussions").option(
      "--repo <alias>",
      "repo alias"
    );
    const templates = new Command("templates").option("-v, --verbose", "verbose flag");
    const generate = new Command("generate")
      .option("-l, --lang <lang>", "language code", "en")
      .action((localOpts: Record<string, unknown>, cmd: Command) => {
        resolve(mergeCommanderOpts(cmd, localOpts) as Record<string, unknown>);
      });
    templates.addCommand(generate);
    discussions.addCommand(templates);
    root.addCommand(discussions);
    void root.parseAsync(argv, { from: "user" });
  });
}

describe("mergeCommanderOpts: 3-level command tree", () => {
  /**
   * @testdoc grand parent (discussions) の `--repo` と直接親 (templates) の `-v` が
   *         孫 (generate) の options に伝播する
   */
  it("should propagate grand-parent and parent options to grandchild action", async () => {
    const opts = await runWithThreeLevels([
      "discussions",
      "--repo",
      "upstream",
      "templates",
      "-v",
      "generate",
      "-l",
      "ja",
    ]);
    expect(opts.verbose).toBe(true);
    expect(opts.repo).toBe("upstream");
    expect(opts.lang).toBe("ja");
  });

  /**
   * @testdoc 祖先側に explicit な値がない場合、各 default が反映される
   */
  it("should fall back to defaults when no ancestor option is given", async () => {
    const opts = await runWithThreeLevels([
      "discussions",
      "templates",
      "generate",
    ]);
    expect(opts.lang).toBe("en"); // child default
    expect(opts.verbose).toBeUndefined();
    expect(opts.repo).toBeUndefined();
  });
});

/**
 * root program option leak テスト (PR #2526 Review Medium-1)。
 *
 * root program に登録された global option（例: --locale, --no-color）が
 * subcommand の action options に注入されないことを保証する。
 * 注入されると、将来 root に option を追加した際に subcommand の同名 option
 * （例: `repo labels --color <hex>` の `--color`）と silent な型衝突を起こす。
 */
function runWithRootGlobalOption(argv: string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    // root program に global option を持たせる（実機の shirokuma-flow と同構造）
    const root = new Command()
      .option("--locale <locale>", "CLI 出力言語")
      .option("--no-color", "色出力を無効化");

    const repo = new Command("repo").option("-v, --verbose", "詳細ログ出力");

    const labels = new Command("labels")
      .option("--create <name>", "ラベル作成")
      .option("--color <color>", "Label color hex (string!)")
      .action((localOpts: Record<string, unknown>, cmd: Command) => {
        resolve(mergeCommanderOpts(cmd, localOpts) as Record<string, unknown>);
      });

    repo.addCommand(labels);
    root.addCommand(repo);
    void root.parseAsync(argv, { from: "user" });
  });
}

describe("mergeCommanderOpts: root program option leak prevention", () => {
  /**
   * @testdoc root program の `--locale` は subcommand の action options に注入されない
   */
  it("should NOT leak root program option (--locale) into action options", async () => {
    const opts = await runWithRootGlobalOption([
      "--locale",
      "ja",
      "repo",
      "labels",
    ]);
    expect(opts.locale).toBeUndefined();
  });

  /**
   * @testdoc root program の `--no-color` (boolean) は subcommand の `--color <hex>` (string) を
   *         汚染しない（同名でも root から漏れない）
   */
  it("should NOT let root --no-color (boolean) shadow subcommand --color <hex> (string)", async () => {
    const opts = await runWithRootGlobalOption([
      "--no-color",
      "repo",
      "labels",
      "--create",
      "test",
      "--color",
      "ff0000",
    ]);
    expect(opts.color).toBe("ff0000");
    expect(typeof opts.color).toBe("string");
  });

  /**
   * @testdoc root program の `--no-color` 指定下で subcommand の `--color <hex>` 未指定時、
   *         root の boolean false が漏れず undefined のまま（cmdLabels 側の `?? "default"` が機能）
   */
  it("should NOT leak root --no-color (false) into subcommand color when subcommand --color is unset", async () => {
    const opts = await runWithRootGlobalOption([
      "--no-color",
      "repo",
      "labels",
    ]);
    // root の color: false が漏れていれば opts.color === false で startsWith() が TypeError を起こす
    // （PR #2526 Review Medium-1 が想定したシナリオ）。
    // root 除外実装下では opts.color === undefined のまま、subcommand 側 default fallback が機能する。
    expect(opts.color).toBeUndefined();
  });
});
