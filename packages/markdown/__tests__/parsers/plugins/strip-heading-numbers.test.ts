/**
 * strip-heading-numbers plugin tests
 *
 * 見出し番号削除プラグインの入出力テスト
 *
 * @testdoc stripHeadingNumbers: 見出し番号削除プラグインを検証する
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import {
  remarkStripHeadingNumbers,
  hasNumberedHeadings,
} from "../../../src/parsers/plugins/strip-heading-numbers.js";
import { processWithPlugin } from "../../helpers/md/process-plugin.js";

const process = (md: string) => processWithPlugin(md, remarkStripHeadingNumbers);

describe("remarkStripHeadingNumbers", () => {
  /**
   * @testdoc stripHeadingNumbers: 単純な番号付き見出しから番号を削除する
   */
  it("should strip simple numbered headings", async () => {
    const input = "## 1. Introduction\n";
    const output = await process(input);
    expect(output).toContain("## Introduction");
    expect(output).not.toContain("1.");
  });

  /**
   * @testdoc stripHeadingNumbers: 階層番号付き見出しから番号を削除する
   */
  it("should strip hierarchical numbered headings", async () => {
    const input = "### 2.1. Getting Started\n";
    const output = await process(input);
    expect(output).toContain("### Getting Started");
    expect(output).not.toContain("2.1.");
  });

  /**
   * @testdoc stripHeadingNumbers: 深い階層番号を削除する
   */
  it("should strip deep hierarchical numbers", async () => {
    const input = "#### 3.2.1. Advanced Topics\n";
    const output = await process(input);
    expect(output).toContain("#### Advanced Topics");
  });

  /**
   * @testdoc stripHeadingNumbers: 番号なし見出しはそのまま保持する
   */
  it("should preserve non-numbered headings", async () => {
    const input = "## Introduction\n";
    const output = await process(input);
    expect(output).toContain("## Introduction");
  });

  /**
   * @testdoc stripHeadingNumbers: 複数の番号付き見出しをすべて処理する
   */
  it("should handle multiple numbered headings", async () => {
    const input =
      "## 1. First\n\n## 2. Second\n\n### 2.1. Sub-Second\n";
    const output = await process(input);
    expect(output).toContain("## First");
    expect(output).toContain("## Second");
    expect(output).toContain("### Sub-Second");
  });
});

describe("hasNumberedHeadings (plugin version)", () => {
  /**
   * @testdoc hasNumberedHeadings: 番号付き見出しを検出する
   */
  it("should detect numbered headings", () => {
    const tree = unified().use(remarkParse).parse("## 1. Title\n");
    expect(hasNumberedHeadings(tree)).toBe(true);
  });

  /**
   * @testdoc hasNumberedHeadings: 番号なし見出しでは false を返す
   */
  it("should return false for non-numbered headings", () => {
    const tree = unified().use(remarkParse).parse("## Title\n");
    expect(hasNumberedHeadings(tree)).toBe(false);
  });
});
