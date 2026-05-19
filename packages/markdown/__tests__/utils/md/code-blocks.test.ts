/**
 * code-blocks utils tests
 *
 * コードブロック検出・操作ユーティリティのテスト
 *
 * @testdoc codeBlocks: コードブロック操作ユーティリティを検証する
 */

import {
  CodeBlockTracker,
  extractCodeBlocks,
  isLineInCodeBlock,
  extractAndReplace,
  restoreCodeBlocks,
  processExcludingCodeBlocks,
} from "../../../src/utils/md/code-blocks.js";

describe("CodeBlockTracker", () => {
  /**
   * @testdoc codeBlocks: コードブロック内外を正しく追跡する
   */
  it("should track code block state", () => {
    const tracker = new CodeBlockTracker();

    expect(tracker.isInCodeBlock()).toBe(false);

    tracker.processLine("```typescript");
    expect(tracker.isInCodeBlock()).toBe(true);

    tracker.processLine("const x = 1;");
    expect(tracker.isInCodeBlock()).toBe(true);

    tracker.processLine("```");
    expect(tracker.isInCodeBlock()).toBe(false);
  });

  /**
   * @testdoc codeBlocks: リセットで状態を初期化する
   */
  it("should reset state", () => {
    const tracker = new CodeBlockTracker();
    tracker.processLine("```");
    expect(tracker.isInCodeBlock()).toBe(true);

    tracker.reset();
    expect(tracker.isInCodeBlock()).toBe(false);
  });
});

describe("extractCodeBlocks", () => {
  /**
   * @testdoc codeBlocks: コードブロックを抽出する
   */
  it("should extract code blocks with metadata", () => {
    const content = "Text\n```typescript\nconst x = 1;\n```\nMore text\n";
    const blocks = extractCodeBlocks(content);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.language).toBe("typescript");
    expect(blocks[0]!.content).toContain("const x = 1;");
    expect(blocks[0]!.startLine).toBe(2);
    expect(blocks[0]!.endLine).toBe(4);
  });

  /**
   * @testdoc codeBlocks: 複数のコードブロックを抽出する
   */
  it("should extract multiple code blocks", () => {
    const content = "```js\na();\n```\n\n```py\nb()\n```\n";
    const blocks = extractCodeBlocks(content);

    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.language).toBe("js");
    expect(blocks[1]!.language).toBe("py");
  });

  /**
   * @testdoc codeBlocks: コードブロックがない場合は空配列を返す
   */
  it("should return empty for no code blocks", () => {
    expect(extractCodeBlocks("Just text.\n")).toEqual([]);
  });
});

describe("isLineInCodeBlock", () => {
  /**
   * @testdoc codeBlocks: コードブロック内の行を正しく判定する
   */
  it("should check if line is in code block", () => {
    const blocks = extractCodeBlocks("Text\n```\ncode\n```\nMore\n");

    expect(isLineInCodeBlock(1, blocks)).toBe(false);
    expect(isLineInCodeBlock(2, blocks)).toBe(true);
    expect(isLineInCodeBlock(3, blocks)).toBe(true);
    expect(isLineInCodeBlock(4, blocks)).toBe(true);
    expect(isLineInCodeBlock(5, blocks)).toBe(false);
  });
});

describe("extractAndReplace / restoreCodeBlocks", () => {
  /**
   * @testdoc codeBlocks: コードブロックをプレースホルダーに置換・復元する
   */
  it("should replace and restore code blocks", () => {
    const original = "Text\n```\ncode\n```\nMore\n";
    const { content, blocks, placeholder } = extractAndReplace(original);

    expect(content).not.toContain("```");
    expect(blocks).toHaveLength(1);

    const restored = restoreCodeBlocks(content, blocks, placeholder);
    expect(restored).toContain("```\ncode\n```");
  });
});

describe("processExcludingCodeBlocks", () => {
  /**
   * @testdoc codeBlocks: コードブロック外のコンテンツのみ変換する
   */
  it("should transform only non-code-block content", () => {
    const input = "hello\n```\nhello\n```\nhello\n";
    const result = processExcludingCodeBlocks(input, (text) =>
      text.replace(/hello/g, "world")
    );

    // Only outside code blocks should be transformed
    expect(result).toContain("world");
    expect(result).toContain("```\nhello\n```");
  });
});
