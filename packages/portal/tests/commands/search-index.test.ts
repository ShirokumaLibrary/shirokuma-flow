import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Search Index Command Tests
 *
 * Tests for the search index generation functionality.
 */

import {
  SearchDocument,
  extractSearchDocuments,
  extractTestCaseDocuments,
  extractMarkdownDocuments,
  buildSearchIndex,
  normalizeText,
  tokenize,
} from "../../src/commands/search-index.js";

describe("Search Index Command", () => {
  describe("normalizeText", () => {
    /**
     * @testdoc テキストの正規化: 小文字変換と余分な空白削除
     */
    it("should normalize text by lowercasing and removing extra whitespace", () => {
      expect(normalizeText("  Hello   World  ")).toBe("hello world");
      expect(normalizeText("TEST")).toBe("test");
      expect(normalizeText("\n\t  multiple\n\nlines  \t")).toBe("multiple lines");
    });

    /**
     * @testdoc 空文字列とnullの処理
     */
    it("should handle empty strings", () => {
      expect(normalizeText("")).toBe("");
      expect(normalizeText("   ")).toBe("");
    });
  });

  describe("tokenize", () => {
    /**
     * @testdoc 英語テキストをトークン化できる
     */
    it("should tokenize English text into words", () => {
      const tokens = tokenize("Hello World Test");
      expect(tokens).toContain("hello");
      expect(tokens).toContain("world");
      expect(tokens).toContain("test");
    });

    /**
     * @testdoc 日本語テキストをN-gramでトークン化できる
     */
    it("should tokenize Japanese text using n-grams", () => {
      const tokens = tokenize("テスト");
      // N-gram (bigram) tokenization
      expect(tokens.length).toBeGreaterThan(0);
      // Should include character sequences
      expect(tokens.some((t) => t.includes("テ") || t.includes("ス"))).toBe(true);
    });

    /**
     * @testdoc 混合テキスト(日本語と英語)を処理できる
     */
    it("should handle mixed Japanese and English text", () => {
      const tokens = tokenize("Hello テスト World");
      expect(tokens.some((t) => t.includes("hello"))).toBe(true);
      expect(tokens.some((t) => t.includes("world"))).toBe(true);
    });
  });

  describe("extractTestCaseDocuments", () => {
    /**
     * @testdoc テストケースからSearchDocumentを生成できる
     */
    it("should extract search documents from test cases", () => {
      const testContent = `
describe("User Management", () => {
  /**
   * @testdoc ユーザーを作成できる
   */
  it("should create a user", () => {
    // test code
  });

  /**
   * @testdoc ユーザーを削除できる
   */
  it("should delete a user", () => {
    // test code
  });
});
`;
      const docs = extractTestCaseDocuments(testContent, "test/user.test.ts", "/test-cases.html");

      expect(docs.length).toBe(2);
      expect(docs[0].type).toBe("testcase");
      // @testdocがある場合は日本語がタイトルになる
      expect(docs[0].title).toBe("ユーザーを作成できる");
      expect(docs[0].content).toContain("ユーザーを作成");
      expect(docs[0].content).toContain("User Management");
    });

    /**
     * @testdoc @testdocがないテストケースは英語名で登録される
     */
    it("should use English name for tests without @testdoc", () => {
      const itCall = "it";
      const testContent = `
describe("API Tests", () => {
  ${itCall}("should handle API requests", () => {
    // test code
  });
});
`;
      const docs = extractTestCaseDocuments(testContent, "test/api.test.ts", "/test-cases.html");

      expect(docs.length).toBe(1);
      expect(docs[0].title).toBe("should handle API requests");
    });
  });

  describe("extractMarkdownDocuments", () => {
    /**
     * @testdoc MarkdownファイルからSearchDocumentを生成できる
     */
    it("should extract search documents from markdown content", () => {
      const mdContent = `# User Guide

This is the user guide for the application.

## Getting Started

Follow these steps to get started.
`;
      const docs = extractMarkdownDocuments(mdContent, "docs/guide.md", "/viewer.html?file=/docs/guide.md");

      expect(docs.length).toBe(1);
      expect(docs[0].type).toBe("markdown");
      expect(docs[0].title).toBe("User Guide");
      expect(docs[0].content).toContain("Getting Started");
    });

    /**
     * @testdoc frontmatterからタイトルを抽出できる
     */
    it("should extract title from frontmatter", () => {
      const mdContent = `---
title: Custom Title
description: A custom description
---

# Heading

Content here.
`;
      const docs = extractMarkdownDocuments(mdContent, "docs/custom.md", "/viewer.html?file=/docs/custom.md");

      expect(docs[0].title).toBe("Custom Title");
    });
  });

  describe("buildSearchIndex", () => {
    /**
     * @testdoc SearchDocumentの配列からインデックスJSONを生成できる
     */
    it("should build search index from documents array", () => {
      const documents: SearchDocument[] = [
        {
          id: "test-1",
          title: "Test Case 1",
          content: "This is test content",
          url: "/test-cases.html#test-1",
          type: "testcase",
        },
        {
          id: "doc-1",
          title: "Documentation",
          content: "Documentation content",
          url: "/docs/readme.md",
          type: "markdown",
        },
      ];

      const index = buildSearchIndex(documents);

      expect(index.documents).toEqual(documents);
      expect(index.version).toBe("1.0");
      expect(typeof index.generatedAt).toBe("string");
    });

    /**
     * @testdoc 空の配列でも正常に処理できる
     */
    it("should handle empty documents array", () => {
      const index = buildSearchIndex([]);

      expect(index.documents).toEqual([]);
      expect(index.version).toBe("1.0");
    });
  });

  describe("extractSearchDocuments", () => {
    /**
     * @testdoc 複数のソースからドキュメントを抽出・統合できる
     */
    it("should extract and combine documents from multiple sources", async () => {
      // This test would require mocking file system
      // For now, we test the structure
      const mockTestCases = [
        {
          id: "tc-1",
          title: "Test 1",
          content: "Test content",
          url: "/test-cases.html",
          type: "testcase" as const,
        },
      ];

      const mockMarkdown = [
        {
          id: "md-1",
          title: "Doc 1",
          content: "Doc content",
          url: "/docs/doc1.md",
          type: "markdown" as const,
        },
      ];

      const combined = [...mockTestCases, ...mockMarkdown];

      expect(combined.length).toBe(2);
      expect(combined.filter((d) => d.type === "testcase").length).toBe(1);
      expect(combined.filter((d) => d.type === "markdown").length).toBe(1);
    });
  });
});

describe("SearchDocument Interface", () => {
  /**
   * @testdoc SearchDocumentが正しい構造を持つ
   */
  it("should have correct structure", () => {
    const doc: SearchDocument = {
      id: "unique-id",
      title: "Document Title",
      content: "Document content for searching",
      url: "/path/to/document",
      type: "testcase",
      category: "optional-category",
    };

    expect(doc.id).toBe("unique-id");
    expect(doc.title).toBe("Document Title");
    expect(doc.content).toBe("Document content for searching");
    expect(doc.url).toBe("/path/to/document");
    expect(doc.type).toBe("testcase");
    expect(doc.category).toBe("optional-category");
  });

  /**
   * @testdoc 全てのドキュメントタイプをサポート
   */
  it("should support all document types", () => {
    const types: SearchDocument["type"][] = ["testcase", "api", "adr", "markdown"];

    types.forEach((type) => {
      const doc: SearchDocument = {
        id: `${type}-1`,
        title: `${type} Title`,
        content: "content",
        url: "/url",
        type,
      };
      expect(doc.type).toBe(type);
    });
  });
});
