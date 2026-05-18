import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Handlebars ヘルパーテスト
 *
 * @testdoc src/generators/portal/helpers.ts のテスト
 */

import Handlebars from "handlebars";
import { registerHelpers } from "../../src/generators/portal/helpers.js";

// ヘルパー登録（テストスイート全体で 1 回）
registerHelpers();

/** テンプレートをコンパイルして実行するユーティリティ */
function render(template: string, data: Record<string, unknown> = {}): string {
  return Handlebars.compile(template)(data);
}

describe("Handlebars helpers", () => {
  // ===========================================================================
  // 比較・論理ヘルパー
  // ===========================================================================

  describe("eq", () => {
    /**
     * @testdoc 同値なら true を返す
     */
    it("should return true for equal values", () => {
      expect(render('{{#if (eq a b)}}yes{{else}}no{{/if}}', { a: 1, b: 1 })).toBe("yes");
    });

    /**
     * @testdoc 異なる値なら false を返す
     */
    it("should return false for different values", () => {
      expect(render('{{#if (eq a b)}}yes{{else}}no{{/if}}', { a: 1, b: 2 })).toBe("no");
    });

    /**
     * @testdoc 型が異なれば false（strict equality）
     */
    it("should use strict equality", () => {
      expect(render('{{#if (eq a b)}}yes{{else}}no{{/if}}', { a: 1, b: "1" })).toBe("no");
    });
  });

  describe("ne", () => {
    /**
     * @testdoc 異なる値なら true を返す
     */
    it("should return true for different values", () => {
      expect(render('{{#if (ne a b)}}yes{{else}}no{{/if}}', { a: 1, b: 2 })).toBe("yes");
    });
  });

  describe("and", () => {
    /**
     * @testdoc 全値が truthy なら true を返す
     */
    it("should return true when all values are truthy", () => {
      expect(render('{{#if (and a b)}}yes{{else}}no{{/if}}', { a: true, b: true })).toBe("yes");
    });

    /**
     * @testdoc いずれかが falsy なら false を返す
     */
    it("should return false when any value is falsy", () => {
      expect(render('{{#if (and a b)}}yes{{else}}no{{/if}}', { a: true, b: false })).toBe("no");
    });
  });

  describe("or", () => {
    /**
     * @testdoc いずれかが truthy なら true を返す
     */
    it("should return true when any value is truthy", () => {
      expect(render('{{#if (or a b)}}yes{{else}}no{{/if}}', { a: false, b: true })).toBe("yes");
    });

    /**
     * @testdoc 全値が falsy なら false を返す
     */
    it("should return false when all values are falsy", () => {
      expect(render('{{#if (or a b)}}yes{{else}}no{{/if}}', { a: false, b: false })).toBe("no");
    });
  });

  describe("not", () => {
    /**
     * @testdoc truthy 値を反転する
     */
    it("should negate truthy value", () => {
      expect(render('{{#if (not a)}}yes{{else}}no{{/if}}', { a: true })).toBe("no");
    });

    /**
     * @testdoc falsy 値を反転する
     */
    it("should negate falsy value", () => {
      expect(render('{{#if (not a)}}yes{{else}}no{{/if}}', { a: false })).toBe("yes");
    });
  });

  // ===========================================================================
  // コレクションヘルパー
  // ===========================================================================

  describe("length", () => {
    /**
     * @testdoc 配列の長さを返す
     */
    it("should return array length", () => {
      expect(render("{{length arr}}", { arr: [1, 2, 3] })).toBe("3");
    });

    /**
     * @testdoc オブジェクトのキー数を返す
     */
    it("should return object key count", () => {
      expect(render("{{length obj}}", { obj: { a: 1, b: 2 } })).toBe("2");
    });

    /**
     * @testdoc 非コレクションは 0 を返す
     */
    it("should return 0 for non-collection", () => {
      expect(render("{{length val}}", { val: "string" })).toBe("0");
    });
  });

  describe("isEmpty", () => {
    /**
     * @testdoc 空配列は true を返す
     */
    it("should return true for empty array", () => {
      expect(render('{{#if (isEmpty arr)}}empty{{else}}has{{/if}}', { arr: [] })).toBe("empty");
    });

    /**
     * @testdoc null/undefined は true を返す
     */
    it("should return true for null", () => {
      expect(render('{{#if (isEmpty val)}}empty{{else}}has{{/if}}', { val: null })).toBe("empty");
    });

    /**
     * @testdoc 要素がある配列は false を返す
     */
    it("should return false for non-empty array", () => {
      expect(render('{{#if (isEmpty arr)}}empty{{else}}has{{/if}}', { arr: [1] })).toBe("has");
    });
  });

  describe("first", () => {
    /**
     * @testdoc 配列の先頭要素を返す
     */
    it("should return first element", () => {
      expect(render("{{first arr}}", { arr: ["a", "b", "c"] })).toBe("a");
    });

    /**
     * @testdoc 非配列は undefined を返す
     */
    it("should return empty for non-array", () => {
      expect(render("{{first val}}", { val: "string" })).toBe("");
    });
  });

  describe("take", () => {
    /**
     * @testdoc 先頭 N 件を返す
     */
    it("should return first N items", () => {
      const result = render("{{#each (take arr 2)}}{{this}}{{/each}}", { arr: ["a", "b", "c"] });
      expect(result).toBe("ab");
    });

    /**
     * @testdoc 非配列は空配列を返す
     */
    it("should return empty array for non-array", () => {
      expect(render("{{#each (take val 2)}}x{{/each}}", { val: "string" })).toBe("");
    });
  });

  describe("entries", () => {
    /**
     * @testdoc オブジェクトを key/value エントリ配列に変換する
     */
    it("should convert object to entries", () => {
      const result = render("{{#each (entries obj)}}{{key}}={{value}} {{/each}}", { obj: { x: 1, y: 2 } });
      expect(result).toBe("x=1 y=2 ");
    });

    /**
     * @testdoc null は空配列を返す
     */
    it("should return empty for null", () => {
      expect(render("{{#each (entries val)}}x{{/each}}", { val: null })).toBe("");
    });
  });

  // ===========================================================================
  // 数値ヘルパー
  // ===========================================================================

  describe("percent", () => {
    /**
     * @testdoc 小数を 100 倍してパーセントにする
     */
    it("should convert decimal to percentage", () => {
      expect(render("{{percent val}}", { val: 0.856 })).toBe("86");
    });

    /**
     * @testdoc NaN は "0" を返す
     */
    it("should return 0 for NaN", () => {
      expect(render("{{percent val}}", { val: "abc" })).toBe("0");
    });
  });

  describe("round", () => {
    /**
     * @testdoc 数値を四捨五入する
     */
    it("should round number", () => {
      expect(render("{{round val}}", { val: 3.7 })).toBe("4");
    });
  });

  describe("add / sub", () => {
    /**
     * @testdoc 加算する
     */
    it("should add numbers", () => {
      expect(render("{{add a b}}", { a: 3, b: 5 })).toBe("8");
    });

    /**
     * @testdoc 減算する
     */
    it("should subtract numbers", () => {
      expect(render("{{sub a b}}", { a: 10, b: 3 })).toBe("7");
    });
  });

  describe("commaNumber", () => {
    /**
     * @testdoc 数値をカンマ区切りにする
     */
    it("should format number with commas", () => {
      expect(render("{{commaNumber val}}", { val: 1234567 })).toBe("1,234,567");
    });
  });

  describe("inRange", () => {
    /**
     * @testdoc 範囲内なら true を返す
     */
    it("should return true when in range", () => {
      expect(render('{{#if (inRange val 1 10)}}yes{{else}}no{{/if}}', { val: 5 })).toBe("yes");
    });

    /**
     * @testdoc 範囲外なら false を返す
     */
    it("should return false when out of range", () => {
      expect(render('{{#if (inRange val 1 10)}}yes{{else}}no{{/if}}', { val: 15 })).toBe("no");
    });

    /**
     * @testdoc 境界値を含む
     */
    it("should include boundary values", () => {
      expect(render('{{#if (inRange val 1 10)}}yes{{else}}no{{/if}}', { val: 1 })).toBe("yes");
      expect(render('{{#if (inRange val 1 10)}}yes{{else}}no{{/if}}', { val: 10 })).toBe("yes");
    });
  });

  describe("isEven", () => {
    /**
     * @testdoc 偶数なら true を返す
     */
    it("should return true for even index", () => {
      expect(render('{{#if (isEven val)}}even{{else}}odd{{/if}}', { val: 0 })).toBe("even");
      expect(render('{{#if (isEven val)}}even{{else}}odd{{/if}}', { val: 2 })).toBe("even");
    });

    /**
     * @testdoc 奇数なら false を返す
     */
    it("should return false for odd index", () => {
      expect(render('{{#if (isEven val)}}even{{else}}odd{{/if}}', { val: 1 })).toBe("odd");
    });
  });

  // ===========================================================================
  // 文字列ヘルパー
  // ===========================================================================

  describe("truncate", () => {
    /**
     * @testdoc 長い文字列を切り詰める
     */
    it("should truncate long string", () => {
      expect(render("{{truncate str 5}}", { str: "Hello World" })).toBe("Hello…");
    });

    /**
     * @testdoc 短い文字列はそのまま返す
     */
    it("should not truncate short string", () => {
      expect(render("{{truncate str 20}}", { str: "Hello" })).toBe("Hello");
    });
  });

  describe("replace", () => {
    /**
     * @testdoc 文字列を全置換する（ReDoS 安全）
     */
    it("should replace all occurrences without regex", () => {
      expect(render('{{replace str "o" "0"}}', { str: "foo bar boo" })).toBe("f00 bar b00");
    });

    /**
     * @testdoc 正規表現特殊文字を含む from でもリテラル置換する
     */
    it("should treat from as literal string, not regex", () => {
      expect(render('{{replace str "." "!"}}', { str: "a.b.c" })).toBe("a!b!c");
    });

    /**
     * @testdoc null 入力を安全に処理する
     */
    it("should handle null input", () => {
      expect(render('{{replace str "a" "b"}}', { str: null })).toBe("");
    });
  });

  describe("slugify", () => {
    /**
     * @testdoc スペースをハイフンに変換しスラッグを生成する
     */
    it("should generate slug", () => {
      expect(render("{{slugify val}}", { val: "Hello World" })).toBe("hello-world");
    });

    /**
     * @testdoc 特殊文字を除去する
     */
    it("should remove special characters", () => {
      expect(render("{{slugify val}}", { val: "foo/bar@baz" })).toBe("foobarbaz");
    });
  });

  describe("urlEncode", () => {
    /**
     * @testdoc URL エンコードする
     */
    it("should URL encode value", () => {
      expect(render("{{urlEncode val}}", { val: "hello world" })).toBe("hello%20world");
    });
  });

  // ===========================================================================
  // セキュリティ関連ヘルパー
  // ===========================================================================

  describe("json (XSS protection)", () => {
    /**
     * @testdoc オブジェクトを JSON 文字列に変換する
     */
    it("should stringify object to JSON", () => {
      const result = render("{{{json val}}}", { val: { key: "value" } });
      expect(result).toBe('{"key":"value"}');
    });

    /**
     * @testdoc </script> を含むデータで < をエスケープする
     */
    it("should escape < to prevent script tag breakout", () => {
      const result = render("{{{json val}}}", { val: "</script><script>alert(1)</script>" });
      expect(result).not.toContain("</script>");
      expect(result).toContain("\\u003c");
    });

    /**
     * @testdoc ネストされたオブジェクト内の < もエスケープする
     */
    it("should escape < in nested objects", () => {
      const result = render("{{{json val}}}", { val: { name: "<img onerror=alert(1)>" } });
      expect(result).not.toContain("<img");
      expect(result).toContain("\\u003c");
    });

    /**
     * @testdoc null を安全にシリアライズする
     */
    it("should handle null", () => {
      expect(render("{{{json val}}}", { val: null })).toBe("null");
    });
  });

  describe("raw", () => {
    /**
     * @testdoc HTML をエスケープせずに出力する
     */
    it("should output raw HTML without escaping", () => {
      expect(render("{{{raw val}}}", { val: "<b>bold</b>" })).toBe("<b>bold</b>");
    });

    /**
     * @testdoc null は空文字列を返す
     */
    it("should return empty string for null", () => {
      expect(render("{{{raw val}}}", { val: null })).toBe("");
    });
  });

  // ===========================================================================
  // ブロックヘルパー
  // ===========================================================================

  describe("ifExists", () => {
    /**
     * @testdoc 値が存在する場合はブロックを表示する
     */
    it("should render block when value exists", () => {
      expect(render("{{#ifExists val}}yes{{/ifExists}}", { val: "hello" })).toBe("yes");
    });

    /**
     * @testdoc null の場合はブロックを表示しない
     */
    it("should not render block for null", () => {
      expect(render("{{#ifExists val}}yes{{/ifExists}}", { val: null })).toBe("");
    });

    /**
     * @testdoc 空文字列の場合はブロックを表示しない
     */
    it("should not render block for empty string", () => {
      expect(render("{{#ifExists val}}yes{{/ifExists}}", { val: "" })).toBe("");
    });

    /**
     * @testdoc else ブロックが使える
     */
    it("should support else block", () => {
      expect(render("{{#ifExists val}}yes{{else}}no{{/ifExists}}", { val: null })).toBe("no");
    });
  });

  describe("ifNotEmpty", () => {
    /**
     * @testdoc 空でない配列ならブロックを表示する
     */
    it("should render block for non-empty array", () => {
      expect(render("{{#ifNotEmpty arr}}yes{{/ifNotEmpty}}", { arr: [1] })).toBe("yes");
    });

    /**
     * @testdoc 空配列ならブロックを表示しない
     */
    it("should not render block for empty array", () => {
      expect(render("{{#ifNotEmpty arr}}yes{{/ifNotEmpty}}", { arr: [] })).toBe("");
    });

    /**
     * @testdoc 空でないオブジェクトならブロックを表示する
     */
    it("should render block for non-empty object", () => {
      expect(render("{{#ifNotEmpty obj}}yes{{/ifNotEmpty}}", { obj: { a: 1 } })).toBe("yes");
    });

    /**
     * @testdoc null ならブロックを表示しない
     */
    it("should not render block for null", () => {
      expect(render("{{#ifNotEmpty val}}yes{{/ifNotEmpty}}", { val: null })).toBe("");
    });
  });

  // ===========================================================================
  // その他
  // ===========================================================================

  describe("currentYear", () => {
    /**
     * @testdoc 現在年を返す
     */
    it("should return current year", () => {
      expect(render("{{currentYear}}")).toBe(String(new Date().getFullYear()));
    });
  });
});
