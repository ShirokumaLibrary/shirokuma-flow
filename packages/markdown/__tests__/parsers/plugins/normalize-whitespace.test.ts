/**
 * normalize-whitespace plugin tests
 *
 * 空白正規化プラグインの入出力テスト
 *
 * @testdoc normalizeWhitespace: 空白正規化プラグインを検証する
 */

import {
  normalizeWhitespaceContent,
  hasExcessiveWhitespace,
} from "../../../src/parsers/plugins/normalize-whitespace.js";

describe("normalizeWhitespaceContent", () => {
  /**
   * @testdoc normalizeWhitespace: 3 行以上の連続空行を 2 行に正規化する
   */
  it("should reduce 3+ consecutive blank lines to 2", () => {
    const input = "A\n\n\n\nB";
    const output = normalizeWhitespaceContent(input);
    expect(output).toBe("A\n\nB");
  });

  /**
   * @testdoc normalizeWhitespace: 行末スペースを削除する
   */
  it("should remove trailing spaces", () => {
    const input = "Hello   \nWorld  ";
    const output = normalizeWhitespaceContent(input);
    expect(output).toBe("Hello\nWorld");
  });

  /**
   * @testdoc normalizeWhitespace: 正常なコンテンツは変更しない
   */
  it("should not modify well-formed content", () => {
    const input = "Line one\n\nLine two\n";
    const output = normalizeWhitespaceContent(input);
    expect(output).toBe("Line one\n\nLine two\n");
  });

  /**
   * @testdoc normalizeWhitespace: 大量の空行を正規化する
   */
  it("should handle many consecutive blank lines", () => {
    const input = "A\n\n\n\n\n\n\nB";
    const output = normalizeWhitespaceContent(input);
    expect(output).toBe("A\n\nB");
  });
});

describe("hasExcessiveWhitespace", () => {
  /**
   * @testdoc hasExcessiveWhitespace: 3 行以上の空行を検出する
   */
  it("should detect 3+ blank lines", () => {
    expect(hasExcessiveWhitespace("A\n\n\n\nB")).toBe(true);
  });

  /**
   * @testdoc hasExcessiveWhitespace: 行末スペースを検出する
   */
  it("should detect trailing spaces", () => {
    expect(hasExcessiveWhitespace("Hello   \nWorld")).toBe(true);
  });

  /**
   * @testdoc hasExcessiveWhitespace: 正常なコンテンツでは false を返す
   */
  it("should return false for clean content", () => {
    expect(hasExcessiveWhitespace("A\n\nB\n")).toBe(false);
  });

  /**
   * @testdoc hasExcessiveWhitespace: 2 行の空行は許容する
   */
  it("should accept exactly 2 blank lines", () => {
    expect(hasExcessiveWhitespace("A\n\nB")).toBe(false);
  });
});
