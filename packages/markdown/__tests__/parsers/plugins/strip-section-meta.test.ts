/**
 * strip-section-meta plugin tests
 *
 * セクションメタ削除プラグインの入出力テスト
 *
 * @testdoc stripSectionMeta: セクションメタ削除プラグインを検証する
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import {
  remarkStripSectionMeta,
  hasSectionMeta,
} from "../../../src/parsers/plugins/strip-section-meta.js";
import { processWithPlugin } from "../../helpers/md/process-plugin.js";

const process = (md: string) => processWithPlugin(md, remarkStripSectionMeta);

describe("remarkStripSectionMeta", () => {
  /**
   * @testdoc stripSectionMeta: 単一行 section-meta コメントを削除する
   */
  it("should remove single-line section-meta comment", async () => {
    const input =
      "## Title\n\n<!-- section-meta priority: high tokens: 450 -->\n\nContent\n";
    const output = await process(input);
    expect(output).not.toContain("section-meta");
    expect(output).toContain("## Title");
    expect(output).toContain("Content");
  });

  /**
   * @testdoc stripSectionMeta: 複数行 section-meta コメントを削除する
   */
  it("should remove multi-line section-meta comment", async () => {
    const input =
      "## Title\n\n<!-- section-meta\npriority: high\ntokens: 450\n-->\n\nContent\n";
    const output = await process(input);
    expect(output).not.toContain("section-meta");
    expect(output).not.toContain("priority");
    expect(output).toContain("Content");
  });

  /**
   * @testdoc stripSectionMeta: section-meta でない通常コメントは保持する
   */
  it("should preserve non-section-meta comments", async () => {
    const input = "<!-- TODO: fix this -->\n\nContent\n";
    const output = await process(input);
    expect(output).toContain("TODO");
  });

  /**
   * @testdoc stripSectionMeta: section-meta がない場合はそのまま返す
   */
  it("should pass through content without section-meta", async () => {
    const input = "# Title\n\nParagraph text.\n";
    const output = await process(input);
    expect(output).toContain("# Title");
    expect(output).toContain("Paragraph text.");
  });

  /**
   * @testdoc stripSectionMeta: 複数の section-meta をすべて削除する
   */
  it("should remove multiple section-meta comments", async () => {
    const input =
      "## A\n\n<!-- section-meta\npriority: high\n-->\n\n## B\n\n<!-- section-meta\npriority: low\n-->\n\nContent\n";
    const output = await process(input);
    expect(output).not.toContain("section-meta");
    expect(output).toContain("## A");
    expect(output).toContain("## B");
  });
});

describe("hasSectionMeta", () => {
  /**
   * @testdoc hasSectionMeta: section-meta を検出する
   */
  it("should detect section-meta", () => {
    const tree = unified()
      .use(remarkParse)
      .parse("<!-- section-meta\npriority: high\n-->\n");
    expect(hasSectionMeta(tree)).toBe(true);
  });

  /**
   * @testdoc hasSectionMeta: section-meta がなければ false を返す
   */
  it("should return false when no section-meta", () => {
    const tree = unified()
      .use(remarkParse)
      .parse("## Title\n\nContent\n");
    expect(hasSectionMeta(tree)).toBe(false);
  });
});
