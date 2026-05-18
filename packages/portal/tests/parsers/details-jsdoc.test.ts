import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Tests for details-jsdoc.ts
 *
 * Covers: cleanJSDoc, formatCode, simpleMarkdown, extractJSDoc,
 * parseJSDoc, parseJSDocForJson, splitTypeSourceCode
 */

import {
  cleanJSDoc,
  formatCode,
  simpleMarkdown,
  parseJSDoc,
  parseJSDocForJson,
  splitTypeSourceCode,
} from "../../src/parsers/details-jsdoc.js";

describe("details-jsdoc", () => {
  describe("cleanJSDoc", () => {
    /**
     * @testdoc JSDocの区切り文字とアスタリスクを除去する
     */
    it("should remove JSDoc delimiters and asterisks", () => {
      const input = `/**
 * This is a description
 * @param name The name
 */`;
      const result = cleanJSDoc(input);
      expect(result).toContain("This is a description");
      expect(result).toContain("@param name The name");
      expect(result).not.toContain("/**");
      expect(result).not.toContain("*/");
    });

    /**
     * @testdoc 単一行のJSDocコメントを正しく処理する
     */
    it("should handle single-line JSDoc", () => {
      const result = cleanJSDoc("/** Hello world */");
      expect(result.trim()).toBe("Hello world");
    });

    /**
     * @testdoc 複数行の行構造を維持して出力する
     */
    it("should preserve line structure", () => {
      const input = `/**
 * Line one
 * Line two
 */`;
      const result = cleanJSDoc(input);
      expect(result).toContain("Line one");
      expect(result).toContain("Line two");
    });
  });

  describe("formatCode", () => {
    /**
     * @testdoc HTMLエンティティを正しくエスケープする
     */
    it("should escape HTML entities", () => {
      const result = formatCode('<div class="test">Hello & "world"</div>');
      expect(result).toContain("&lt;");
      expect(result).toContain("&gt;");
      expect(result).toContain("&amp;");
      expect(result).toContain("&quot;");
    });
  });

  describe("simpleMarkdown", () => {
    /**
     * @testdoc 空文字列の入力に対して空文字列を返す
     */
    it("should return empty string for empty input", () => {
      expect(simpleMarkdown("")).toBe("");
    });

    /**
     * @testdoc テキストを段落タグで囲んで出力する
     */
    it("should wrap text in paragraphs", () => {
      const result = simpleMarkdown("Hello world");
      expect(result).toContain("<p>Hello world</p>");
    });

    /**
     * @testdoc コードブロックを言語付きのpreタグに変換する
     */
    it("should handle code blocks", () => {
      const result = simpleMarkdown("```ts\nconst x = 1;\n```");
      expect(result).toContain("<pre");
      expect(result).toContain("<code");
      expect(result).toContain("language-ts");
      expect(result).toContain("const x = 1;");
    });

    /**
     * @testdoc インラインコードをcodeタグに変換する
     */
    it("should handle inline code", () => {
      const result = simpleMarkdown("Use `const` keyword");
      expect(result).toContain("<code>const</code>");
    });

    /**
     * @testdoc 二重改行で段落を分割して出力する
     */
    it("should separate paragraphs by double newline", () => {
      const result = simpleMarkdown("First paragraph\n\nSecond paragraph");
      expect(result).toContain("<p>First paragraph</p>");
      expect(result).toContain("<p>Second paragraph</p>");
    });

    /**
     * @testdoc インラインコード内のHTMLをエスケープしてXSSを防止する
     */
    it("should escape HTML in inline code to prevent XSS", () => {
      const result = simpleMarkdown("Use `<img src=x onerror=\"alert('XSS')\">` keyword");
      expect(result).not.toContain("<img");
      expect(result).toContain("&lt;img");
      expect(result).toContain("<code>");
    });

    /**
     * @testdoc 段落テキスト内のHTMLをエスケープしてXSSを防止する
     */
    it("should escape HTML in paragraph text to prevent XSS", () => {
      const result = simpleMarkdown("Some <script>alert('XSS')</script> text");
      expect(result).not.toContain("<script>");
      expect(result).toContain("&lt;script&gt;");
    });

    /**
     * @testdoc インラインコードと段落テキストの両方でHTMLエスケープする
     */
    it("should escape HTML in mixed inline code and paragraph text", () => {
      const result = simpleMarkdown("Use `<b>bold</b>` and <img src=x onerror=alert(1)> here");
      expect(result).toContain("<code>&lt;b&gt;bold&lt;/b&gt;</code>");
      expect(result).not.toContain("<img");
      expect(result).toContain("&lt;img");
    });

    /**
     * @testdoc コードブロックのエスケープを維持しつつ段落テキストもエスケープする
     */
    it("should preserve code block escaping while escaping paragraphs", () => {
      const result = simpleMarkdown("Dangerous <div>text</div>\n\n```ts\nconst x = 1;\n```\n\nMore <b>text</b>");
      expect(result).toContain("&lt;div&gt;text&lt;/div&gt;");
      expect(result).toContain("&lt;b&gt;text&lt;/b&gt;");
      expect(result).toContain("<pre");
      expect(result).toContain("const x = 1;");
    });
  });

  describe("parseJSDoc", () => {
    /**
     * @testdoc プレーンテキストから説明文を解析する
     */
    it("should parse description from plain text", () => {
      const result = parseJSDoc("A simple function that does something.");
      expect(result.description).toBe("A simple function that does something.");
    });

    /**
     * @testdoc @paramタグを名前・型・説明に分解して解析する
     */
    it("should parse @param tags", () => {
      const result = parseJSDoc("Description\n@param {string} name - The name\n@param {number} age - The age");
      expect(result.params).toHaveLength(2);
      expect(result.params[0]).toEqual({ name: "name", type: "string", description: "The name" });
      expect(result.params[1]).toEqual({ name: "age", type: "number", description: "The age" });
    });

    /**
     * @testdoc @returnsタグの戻り値説明を解析する
     */
    it("should parse @returns tag", () => {
      const result = parseJSDoc("@returns The computed value");
      expect(result.returns).toBe("The computed value");
    });

    /**
     * @testdoc @returnエイリアスタグも正しく解析する
     */
    it("should parse @return tag (alias)", () => {
      const result = parseJSDoc("@return The result");
      expect(result.returns).toBe("The result");
    });

    /**
     * @testdoc @throwsタグを複数件解析する
     */
    it("should parse @throws tags", () => {
      const result = parseJSDoc("@throws Error if input is invalid\n@throws TypeError if type is wrong");
      expect(result.throws).toHaveLength(2);
      expect(result.throws![0]).toBe("Error if input is invalid");
    });

    /**
     * @testdoc @exampleタグのコードブロックを解析する
     */
    it("should parse @example tag", () => {
      const result = parseJSDoc("@example\n```ts\nconst x = 1;\n```");
      expect(result.examples).toHaveLength(1);
      expect(result.examples[0]).toContain("const x = 1;");
    });

    /**
     * @testdoc カスタムタグ（serverAction, feature, dbTables）を解析する
     */
    it("should parse custom tags", () => {
      const result = parseJSDoc("@serverAction\n@feature entities\n@dbTables users, sessions");
      expect(result.tags.find((t) => t.name === "serverAction")).toBeDefined();
      expect(result.tags.find((t) => t.name === "feature")?.value).toBe("entities");
      expect(result.tags.find((t) => t.name === "dbTables")?.value).toBe("users, sessions");
    });

    /**
     * @testdoc 空文字列の入力に対して空の解析結果を返す
     */
    it("should return empty result for empty input", () => {
      const result = parseJSDoc("");
      expect(result.description).toBe("");
      expect(result.params).toEqual([]);
      expect(result.examples).toEqual([]);
    });

    /**
     * @testdoc @descriptionタグから説明文を解析する
     */
    it("should parse @description tag", () => {
      const result = parseJSDoc("@description A detailed description here");
      expect(result.description).toBe("A detailed description here");
    });
  });

  describe("parseJSDocForJson", () => {
    /**
     * @testdoc 基本的なケースでparseJSDocと同様に解析する
     */
    it("should parse like parseJSDoc for basic cases", () => {
      const result = parseJSDocForJson("Description\n@param {string} name - The name");
      expect(result.description).toBe("Description");
      expect(result.params[0]).toEqual({ name: "name", type: "string", description: "The name" });
    });

    /**
     * @testdoc @errorCodesなど複数行タグを値として解析する
     */
    it("should handle multiline tags like @errorCodes", () => {
      const input = "@errorCodes\n- NOT_FOUND: Resource not found (404)\n- FORBIDDEN: Access denied (403)";
      const result = parseJSDocForJson(input);
      const errorCodesTag = result.tags.find((t) => t.name === "errorCodes");
      expect(errorCodesTag).toBeDefined();
      expect(errorCodesTag!.value).toContain("NOT_FOUND");
      expect(errorCodesTag!.value).toContain("FORBIDDEN");
    });

    /**
     * @testdoc @throwエイリアスも@throwsと同様に解析する
     */
    it("should handle @throws with alias @throw", () => {
      const result = parseJSDocForJson("@throw Something went wrong");
      expect(result.throws).toHaveLength(1);
      expect(result.throws![0]).toBe("Something went wrong");
    });
  });

  describe("splitTypeSourceCode", () => {
    /**
     * @testdoc JSDocと型定義部分を分離して返す
     */
    it("should split JSDoc and type definition", () => {
      const source = `/**
 * A user entity
 * @description Represents a user in the system
 */
export interface User {
  id: string;
  name: string;
}`;
      const result = splitTypeSourceCode(source);
      expect(result.jsdocHtml).toContain("A user entity");
      expect(result.definitionCode).toContain("export interface User");
    });

    /**
     * @testdoc JSDocがない場合はソース全体を定義部分として返す
     */
    it("should return full source as definition when no JSDoc", () => {
      const source = "export type Status = 'active' | 'inactive';";
      const result = splitTypeSourceCode(source);
      expect(result.jsdocHtml).toBe("");
      expect(result.definitionCode).toBe(source.trim());
    });
  });
});
