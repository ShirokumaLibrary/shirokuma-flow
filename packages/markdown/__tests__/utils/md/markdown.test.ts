/**
 * markdown utils tests
 *
 * Markdown パース・見出し解析ユーティリティのテスト
 *
 * @testdoc markdownUtils: Markdown パースユーティリティを検証する
 */

import {
  parseHeadings,
  countHeadings,
  flattenHeadings,
  countLines,
} from "../../../src/utils/md/markdown.js";

describe("parseHeadings", () => {
  /**
   * @testdoc markdownUtils: 見出し階層を正しくパースする
   */
  it("should parse heading hierarchy", () => {
    const content = "# Title\n\n## Section A\n\n### Subsection\n\n## Section B\n";
    const headings = parseHeadings(content);

    expect(headings).toHaveLength(1); // 1 top-level heading
    expect(headings[0]!.text).toBe("Title");
    expect(headings[0]!.children).toHaveLength(2); // Section A, Section B
    expect(headings[0]!.children[0]!.text).toBe("Section A");
    expect(headings[0]!.children[0]!.children).toHaveLength(1); // Subsection
  });

  /**
   * @testdoc markdownUtils: 見出しがない場合は空配列を返す
   */
  it("should return empty for no headings", () => {
    expect(parseHeadings("Just text.\n")).toEqual([]);
  });

  /**
   * @testdoc markdownUtils: 行番号を正しく設定する
   */
  it("should set correct line numbers", () => {
    const content = "# Title\n\n## Section\n";
    const headings = parseHeadings(content);

    expect(headings[0]!.startLine).toBe(1);
  });
});

describe("countHeadings", () => {
  /**
   * @testdoc markdownUtils: 全見出し数を再帰的にカウントする
   */
  it("should count all headings recursively", () => {
    const headings = parseHeadings(
      "# A\n\n## B\n\n### C\n\n## D\n"
    );
    const count = countHeadings(headings);

    expect(count).toBe(4); // A, B, C, D
  });

  /**
   * @testdoc markdownUtils: 空配列の場合は 0 を返す
   */
  it("should return 0 for empty array", () => {
    expect(countHeadings([])).toBe(0);
  });
});

describe("flattenHeadings", () => {
  /**
   * @testdoc markdownUtils: 階層構造をフラットなリストにする
   */
  it("should flatten heading hierarchy", () => {
    const headings = parseHeadings("# A\n\n## B\n\n### C\n");
    const flat = flattenHeadings(headings);

    expect(flat).toHaveLength(3);
    expect(flat.map((h) => h.text)).toEqual(["A", "B", "C"]);
  });
});

describe("countLines", () => {
  /**
   * @testdoc markdownUtils: 行数を正しくカウントする
   */
  it("should count lines correctly", () => {
    expect(countLines("line1\nline2\nline3")).toBe(3);
    expect(countLines("single")).toBe(1);
    expect(countLines("")).toBe(1);
  });
});
