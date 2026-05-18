/**
 * linter tests
 *
 * Markdown リンターのテスト
 *
 * @testdoc linter: Markdown リンターの検出ルールを検証する
 */

import { Linter } from "../../src/lint/index.js";
import type { Document } from "../../src/parsers/types/document.js";
import { createTestConfig } from "../helpers/md/create-config.js";

function createDocument(content: string, filePath: string = "test.md"): Document {
  return {
    path: filePath,
    frontmatter: {},
    content,
    sections: [],
  };
}

describe("Linter.lintDocument", () => {
  /**
   * @testdoc linter: 末尾スペースを検出する
   */
  it("should detect trailing spaces", () => {
    const config = createTestConfig();
    const linter = new Linter(config);
    const doc = createDocument("Hello world   \nNext line\n");

    const issues = linter.lintDocument(doc);

    expect(issues.some((i) => i.rule === "no-trailing-spaces")).toBe(true);
  });

  /**
   * @testdoc linter: 過剰な空行を検出する
   */
  it("should detect multiple blank lines", () => {
    const config = createTestConfig();
    const linter = new Linter(config);
    const doc = createDocument("Line 1\n\n\n\nLine 2\n");

    const issues = linter.lintDocument(doc);

    expect(issues.some((i) => i.rule === "no-multiple-blanks")).toBe(true);
  });

  /**
   * @testdoc linter: 番号付き見出しを検出する
   */
  it("should detect numbered headings", () => {
    const config = createTestConfig();
    const linter = new Linter(config);
    const doc = createDocument("## 1. Introduction\n\nContent\n");

    const issues = linter.lintDocument(doc);

    expect(issues.some((i) => i.rule === "no-numbered-headings")).toBe(true);
  });

  /**
   * @testdoc linter: コードブロック内の番号付き見出しは無視する
   */
  it("should ignore numbered headings in code blocks", () => {
    const config = createTestConfig();
    const linter = new Linter(config);
    const doc = createDocument("```\n## 1. Title\n```\n");

    const issues = linter.lintDocument(doc);

    expect(issues.filter((i) => i.rule === "no-numbered-headings")).toHaveLength(0);
  });

  /**
   * @testdoc linter: mermaid スタイル定義を検出する
   */
  it("should detect mermaid style definitions", () => {
    const config = createTestConfig();
    const linter = new Linter(config);
    const doc = createDocument(
      "```mermaid\ngraph TD\n  A --> B\n  style A fill:#f00\n```\n"
    );

    const issues = linter.lintDocument(doc);

    expect(issues.some((i) => i.rule === "no-mermaid-styling")).toBe(true);
  });

  /**
   * @testdoc linter: ナビゲーションセクションを検出する
   */
  it("should detect navigation sections", () => {
    const config = createTestConfig();
    const linter = new Linter(config);
    const doc = createDocument("## Related Documents\n\n- [Link](./a.md)\n");

    const issues = linter.lintDocument(doc);

    expect(issues.some((i) => i.rule === "no-navigation-sections")).toBe(true);
  });

  /**
   * @testdoc linter: クリーンなドキュメントにはイシューを報告しない
   */
  it("should report no issues for clean document", () => {
    const config = createTestConfig();
    const linter = new Linter(config);
    const doc = createDocument("## Title\n\nSome clean content.\n");

    const issues = linter.lintDocument(doc);

    // May have style info but no warnings/errors
    const warnings = issues.filter((i) => i.severity === "warning" || i.severity === "error");
    expect(warnings).toHaveLength(0);
  });

  /**
   * @testdoc linter: ルール無効化で検出をスキップする
   */
  it("should skip disabled rules", () => {
    const config = createTestConfig({
      lint: {
        builtin_rules: {
          "no-trailing-spaces": false,
        },
      },
    });
    const linter = new Linter(config);
    const doc = createDocument("Hello   \n");

    const issues = linter.lintDocument(doc);

    expect(issues.filter((i) => i.rule === "no-trailing-spaces")).toHaveLength(0);
  });

  /**
   * @testdoc linter: 構造的ボールドを検出する
   */
  it("should detect structural bold", () => {
    const config = createTestConfig();
    const linter = new Linter(config);
    const doc = createDocument("- **Name**: John\n- **Age**: 30\n");

    const issues = linter.lintDocument(doc);

    expect(issues.some((i) => i.rule === "no-structural-bold")).toBe(true);
  });

  /**
   * @testdoc linter: リストマーカースタイルの不一致を検出する
   */
  it("should detect non-dash list markers", () => {
    const config = createTestConfig();
    const linter = new Linter(config);
    const doc = createDocument("* Item 1\n* Item 2\n");

    const issues = linter.lintDocument(doc);

    expect(issues.some((i) => i.rule === "list-marker-style")).toBe(true);
  });
});
