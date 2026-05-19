/**
 * remove-comments plugin tests
 *
 * HTML コメント削除プラグインの入出力テスト
 *
 * @testdoc removeComments: HTML コメント削除プラグインを検証する
 */

import { remarkRemoveComments } from "../../../src/parsers/plugins/remove-comments.js";
import { processWithPlugin } from "../../helpers/md/process-plugin.js";

const process = (md: string) => processWithPlugin(md, remarkRemoveComments);

describe("remarkRemoveComments", () => {
  /**
   * @testdoc removeComments: 単一行 HTML コメントを削除する
   */
  it("should remove single-line HTML comments", async () => {
    const input = "Hello\n\n<!-- TODO: fix this -->\n\nWorld\n";
    const output = await process(input);
    expect(output).not.toContain("<!-- TODO");
    expect(output).toContain("Hello");
    expect(output).toContain("World");
  });

  /**
   * @testdoc removeComments: 複数行 HTML コメントを削除する
   */
  it("should remove multi-line HTML comments", async () => {
    const input =
      "Before\n\n<!-- Author: John\nDate: 2024-01-15 -->\n\nAfter\n";
    const output = await process(input);
    expect(output).not.toContain("Author");
    expect(output).toContain("Before");
    expect(output).toContain("After");
  });

  /**
   * @testdoc removeComments: コメントがない場合はそのまま返す
   */
  it("should pass through content without comments", async () => {
    const input = "# Title\n\nParagraph text.\n";
    const output = await process(input);
    expect(output).toContain("# Title");
    expect(output).toContain("Paragraph text.");
  });

  /**
   * @testdoc removeComments: 複数のコメントをすべて削除する
   */
  it("should remove multiple comments", async () => {
    const input =
      "<!-- first -->\n\nText\n\n<!-- second -->\n\nMore text\n";
    const output = await process(input);
    expect(output).not.toContain("first");
    expect(output).not.toContain("second");
    expect(output).toContain("Text");
    expect(output).toContain("More text");
  });

  /**
   * @testdoc removeComments: HTML タグ（非コメント）は保持する
   */
  it("should preserve non-comment HTML", async () => {
    const input = '<div class="container">content</div>\n';
    const output = await process(input);
    expect(output).toContain("container");
  });
});
