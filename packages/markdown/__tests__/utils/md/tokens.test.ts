/**
 * tokens utils tests
 *
 * トークン推定・フォーマットのテスト
 *
 * @testdoc tokensUtils: トークン推定ユーティリティを検証する
 */

import { estimateTokens, formatTokenCount } from "../../../src/utils/md/tokens.js";

describe("estimateTokens", () => {
  /**
   * @testdoc tokensUtils: テキストのトークン数を推定する
   */
  it("should estimate token count", () => {
    const text = "Hello world, this is a test.";
    const tokens = estimateTokens(text);

    expect(tokens).toBeGreaterThan(0);
    // Rough check - should be reasonable (text is ~7 tokens)
    expect(tokens).toBeLessThan(50);
  });

  /**
   * @testdoc tokensUtils: 空文字列のトークン数は 0 を返す
   */
  it("should return 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  /**
   * @testdoc tokensUtils: 長いテキストのトークン数を推定する
   */
  it("should handle long text", () => {
    const text = "word ".repeat(1000);
    const tokens = estimateTokens(text);

    expect(tokens).toBeGreaterThan(100);
  });
});

describe("formatTokenCount", () => {
  /**
   * @testdoc tokensUtils: 1000 未満はそのまま表示する
   */
  it("should format small numbers as-is", () => {
    expect(formatTokenCount(500)).toBe("500");
    expect(formatTokenCount(42)).toBe("42");
  });

  /**
   * @testdoc tokensUtils: 1000 以上は K 表記にする
   */
  it("should format thousands with K suffix", () => {
    expect(formatTokenCount(1500)).toBe("1.5K");
    expect(formatTokenCount(10000)).toBe("10.0K");
  });

  /**
   * @testdoc tokensUtils: 1000000 以上は M 表記にする
   */
  it("should format millions with M suffix", () => {
    expect(formatTokenCount(1500000)).toBe("1.50M");
    expect(formatTokenCount(2000000)).toBe("2.00M");
  });
});
