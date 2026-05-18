/**
 * heading-numbers parser tests
 *
 * 見出し番号解析・検出・削除のテスト
 *
 * @testdoc headingNumbers: 見出し番号の解析と削除を検証する
 */

import {
  stripHeadingNumbers,
  hasNumberedHeadings,
  extractNumberedHeadings,
} from "../../src/parsers/heading-numbers.js";

describe("stripHeadingNumbers", () => {
  /**
   * @testdoc headingNumbers: 単純な番号付き見出しから番号を削除する
   */
  it("should strip simple numbered headings", () => {
    const input = "## 1. Introduction\n";
    const output = stripHeadingNumbers(input);
    expect(output).toBe("## Introduction\n");
  });

  /**
   * @testdoc headingNumbers: 階層番号付き見出しから番号を削除する
   */
  it("should strip hierarchical numbered headings", () => {
    const input = "### 2.1. Getting Started\n";
    const output = stripHeadingNumbers(input);
    expect(output).toBe("### Getting Started\n");
  });

  /**
   * @testdoc headingNumbers: 深い階層番号を削除する
   */
  it("should strip deep hierarchical numbers", () => {
    const input = "#### 3.2.1. Advanced Topics\n";
    const output = stripHeadingNumbers(input);
    expect(output).toBe("#### Advanced Topics\n");
  });

  /**
   * @testdoc headingNumbers: 番号なし見出しはそのまま保持する
   */
  it("should preserve non-numbered headings", () => {
    const input = "## Introduction\n";
    const output = stripHeadingNumbers(input);
    expect(output).toBe("## Introduction\n");
  });

  /**
   * @testdoc headingNumbers: コードブロック内の番号付き見出しは保持する
   */
  it("should preserve numbered headings inside code blocks", () => {
    const input = "```\n## 1. Title\n```\n";
    const output = stripHeadingNumbers(input);
    expect(output).toContain("## 1. Title");
  });

  /**
   * @testdoc headingNumbers: 複数の見出しを一括処理する
   */
  it("should handle multiple headings", () => {
    const input = "## 1. First\n\n## 2. Second\n\n### 2.1. Sub\n";
    const output = stripHeadingNumbers(input);
    expect(output).toContain("## First");
    expect(output).toContain("## Second");
    expect(output).toContain("### Sub");
  });
});

describe("hasNumberedHeadings", () => {
  /**
   * @testdoc headingNumbers: 番号付き見出しを検出する
   */
  it("should detect numbered headings", () => {
    expect(hasNumberedHeadings("## 1. Title\n")).toBe(true);
  });

  /**
   * @testdoc headingNumbers: 番号なし見出しでは false を返す
   */
  it("should return false for non-numbered headings", () => {
    expect(hasNumberedHeadings("## Title\n")).toBe(false);
  });

  /**
   * @testdoc headingNumbers: コードブロック内の番号付き見出しは無視する
   */
  it("should ignore numbered headings inside code blocks", () => {
    expect(hasNumberedHeadings("```\n## 1. Title\n```\n")).toBe(false);
  });
});

describe("extractNumberedHeadings", () => {
  /**
   * @testdoc headingNumbers: 番号付き見出しの詳細を抽出する
   */
  it("should extract numbered heading details", () => {
    const result = extractNumberedHeadings("## 1. Introduction\n\n### 2.1. Setup\n");
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      level: 2,
      number: "1",
      title: "Introduction",
    });
    expect(result[1]).toMatchObject({
      level: 3,
      number: "2.1",
      title: "Setup",
    });
  });

  /**
   * @testdoc headingNumbers: 番号なしの場合は空配列を返す
   */
  it("should return empty array for no numbered headings", () => {
    expect(extractNumberedHeadings("## Title\n")).toEqual([]);
  });

  /**
   * @testdoc headingNumbers: 行番号を正しく返す
   */
  it("should return correct line numbers", () => {
    const result = extractNumberedHeadings("# Title\n\n## 1. Intro\n");
    expect(result).toHaveLength(1);
    expect(result[0]!.lineNumber).toBe(3);
  });
});
