/**
 * remark utils tests
 *
 * remark ユーティリティのテスト
 *
 * @testdoc remarkUtils: remark 処理ユーティリティを検証する
 */

import {
  processMarkdown,
  parseMarkdown,
  getAST,
  stringifyAST,
} from "../../../src/utils/md/remark.js";

describe("processMarkdown", () => {
  /**
   * @testdoc remarkUtils: Markdown を処理して文字列を返す
   */
  it("should process markdown and return string", async () => {
    const input = "## Title\n\nParagraph text.\n";
    const result = await processMarkdown(input);

    expect(result).toContain("Title");
    expect(result).toContain("Paragraph text.");
  });

  /**
   * @testdoc remarkUtils: GFM をデフォルトで有効にする
   */
  it("should support GFM by default", async () => {
    const input = "| A | B |\n|---|---|\n| 1 | 2 |\n";
    const result = await processMarkdown(input);

    expect(result).toContain("| A | B |");
    expect(result).toContain("| 1 | 2 |");
  });

  /**
   * @testdoc remarkUtils: カスタムプラグインを適用する
   */
  it("should apply custom plugins", async () => {
    // Use a simple plugin that doesn't modify anything
    const noopPlugin = () => () => {};
    const input = "## Title\n";
    const result = await processMarkdown(input, { plugins: [noopPlugin] });

    expect(result).toContain("Title");
  });
});

describe("getAST", () => {
  /**
   * @testdoc remarkUtils: Markdown を AST にパースする
   */
  it("should parse markdown into AST", async () => {
    const ast = await getAST("## Hello\n\nWorld.\n");

    expect(ast.type).toBe("root");
    expect(ast.children.length).toBeGreaterThan(0);
  });
});

describe("stringifyAST", () => {
  /**
   * @testdoc remarkUtils: AST を Markdown 文字列に変換する
   */
  it("should stringify AST back to markdown", async () => {
    const ast = await getAST("## Hello\n\nWorld.\n");
    const result = await stringifyAST(ast);

    expect(result).toContain("Hello");
    expect(result).toContain("World");
  });
});

describe("parseMarkdown", () => {
  /**
   * @testdoc remarkUtils: compiler なしでエラーをスローする
   */
  it("should throw without compiler", async () => {
    // parseMarkdown calls process() without stringify, so it throws
    await expect(parseMarkdown("## Title\n")).rejects.toThrow("compiler");
  });
});
