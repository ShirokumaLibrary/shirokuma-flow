/**
 * normalize-headings plugin tests
 *
 * 階層的見出し正規化（RAG 用コンテキスト保持）の入出力テスト
 *
 * @testdoc normalizeHeadings: 見出しの階層的正規化プラグインを検証する
 */

import { remarkNormalizeHeadings } from "../../../src/parsers/plugins/normalize-headings.js";
import { processWithPlugin } from "../../helpers/md/process-plugin.js";

const process = (md: string, separator?: string) =>
  processWithPlugin(md, remarkNormalizeHeadings, separator ? { separator } : undefined);

describe("remarkNormalizeHeadings", () => {
  /**
   * @testdoc normalizeHeadings: h2 のみの場合 Configuration テキストを含む
   */
  it("should include Configuration text for standalone h2", async () => {
    const input = "## Configuration\n";
    const output = await process(input);
    expect(output).toContain("Configuration");
  });

  /**
   * @testdoc normalizeHeadings: h3 に親 h2 のコンテキストを付与する
   */
  it("should prepend parent h2 context to h3", async () => {
    const input = "## Configuration\n\n### Consumer Settings\n";
    const output = await process(input);
    expect(output).toContain("Configuration / Consumer Settings");
  });

  /**
   * @testdoc normalizeHeadings: h4 に h2+h3 の階層コンテキストを付与する
   */
  it("should build full hierarchy for h4", async () => {
    const input =
      "## Configuration\n\n### Consumer Settings\n\n#### offset_reset\n";
    const output = await process(input);
    // remark-stringify may escape underscores (offset\_reset or offset\\_reset)
    expect(output).toContain("Configuration / Consumer Settings /");
    expect(output).toMatch(/offset\\?_reset/);
  });

  /**
   * @testdoc normalizeHeadings: カスタムセパレーターを適用する
   */
  it("should use custom separator", async () => {
    const input = "## A\n\n### B\n";
    const output = await process(input, " > ");
    expect(output).toContain("A > B");
  });

  /**
   * @testdoc normalizeHeadings: 同レベル見出しの切り替わりでスタックをリセットする
   */
  it("should reset context when same-level heading appears", async () => {
    const input =
      "## Config\n\n### Setting A\n\n## Logging\n\n### Setting B\n";
    const output = await process(input);
    expect(output).toContain("Logging / Setting B");
    expect(output).not.toContain("Config / Setting B");
  });

  /**
   * @testdoc normalizeHeadings: 見出しが無い場合は変更しない
   */
  it("should not modify document without headings", async () => {
    const input = "Just a paragraph.\n";
    const output = await process(input);
    expect(output).toContain("Just a paragraph.");
  });

  /**
   * @testdoc normalizeHeadings: h1 を含む深い階層を正しく処理する
   */
  it("should handle h1 through h4 hierarchy", async () => {
    const input = "# Root\n\n## Child\n\n### Grandchild\n";
    const output = await process(input);
    expect(output).toContain("Root / Child / Grandchild");
  });

  /**
   * @testdoc normalizeHeadings: h1→h3 のレベルスキップで空セグメントを生成しない
   */
  it("should not produce empty segments when heading levels are skipped (h1→h3)", async () => {
    const input = "# Intro\n\n### Deep\n";
    const output = await process(input);
    expect(output).toContain("Intro / Deep");
    expect(output).not.toContain("Intro /  / Deep");
  });

  /**
   * @testdoc normalizeHeadings: h2→h4 のレベルスキップで空セグメントを生成しない
   */
  it("should not produce empty segments when heading levels are skipped (h2→h4)", async () => {
    const input = "## Parent\n\n#### GrandChild\n";
    const output = await process(input);
    expect(output).toContain("Parent / GrandChild");
    expect(output).not.toContain("Parent /  / GrandChild");
  });

  /**
   * @testdoc normalizeHeadings: h1→h4 の2レベルスキップで空セグメントを生成しない
   */
  it("should not produce empty segments when skipping two levels (h1→h4)", async () => {
    const input = "# Root\n\n#### Leaf\n";
    const output = await process(input);
    expect(output).toContain("Root / Leaf");
    expect(output).not.toMatch(/Root \/ {2,}/);
  });

  /**
   * @testdoc normalizeHeadings: 先頭が h2 の場合に先頭区切り文字を生成しない
   */
  it("should not produce leading separator when first heading is h2", async () => {
    const input = "## Config\n\n### Setting\n";
    const output = await process(input);
    // h2 が先頭の場合、h1 が未定義でも先頭に " / " が付かない
    expect(output).not.toMatch(/^\s*\//m);
    expect(output).toContain("Config / Setting");
  });
});
