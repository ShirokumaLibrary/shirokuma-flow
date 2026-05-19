/**
 * remove-duplicates plugin tests
 *
 * 重複段落・セクション削除プラグインの入出力テスト
 *
 * @testdoc removeDuplicates: 重複段落削除プラグインを検証する
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import {
  remarkRemoveDuplicates,
  countDuplicates,
} from "../../../src/parsers/plugins/remove-duplicates.js";
import { processWithPlugin } from "../../helpers/md/process-plugin.js";

const process = (md: string) => processWithPlugin(md, remarkRemoveDuplicates);

function getAST(md: string) {
  return unified().use(remarkParse).parse(md);
}

describe("remarkRemoveDuplicates", () => {
  /**
   * @testdoc removeDuplicates: 重複段落を削除する
   */
  it("should remove duplicate paragraphs", async () => {
    const input =
      "This is a paragraph.\n\n## Section\n\nThis is a paragraph.\n";
    const output = await process(input);
    // 最初の出現は保持、2回目は削除
    const matches = output.match(/This is a paragraph/g);
    expect(matches).toHaveLength(1);
  });

  /**
   * @testdoc removeDuplicates: ユニークな段落はすべて保持する
   */
  it("should keep all unique paragraphs", async () => {
    const input = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.\n";
    const output = await process(input);
    expect(output).toContain("First paragraph.");
    expect(output).toContain("Second paragraph.");
    expect(output).toContain("Third paragraph.");
  });

  /**
   * @testdoc removeDuplicates: 空段落は重複チェックしない
   */
  it("should not count empty paragraphs as duplicates", async () => {
    const input = "A\n\nB\n\nC\n";
    const output = await process(input);
    expect(output).toContain("A");
    expect(output).toContain("B");
    expect(output).toContain("C");
  });

  /**
   * @testdoc removeDuplicates: 3回以上の重複を処理する
   */
  it("should handle triple duplicates", async () => {
    const input = "Same text.\n\nSame text.\n\nSame text.\n";
    const output = await process(input);
    const matches = output.match(/Same text/g);
    expect(matches).toHaveLength(1);
  });
});

describe("countDuplicates", () => {
  /**
   * @testdoc countDuplicates: 重複段落の数を正しくカウントする
   */
  it("should count duplicate paragraphs", async () => {
    const tree = await getAST(
      "Hello world.\n\nHello world.\n\nUnique text.\n"
    );
    const count = countDuplicates(tree);
    expect(count).toBe(1);
  });

  /**
   * @testdoc countDuplicates: 重複がなければ 0 を返す
   */
  it("should return 0 for no duplicates", async () => {
    const tree = await getAST("A.\n\nB.\n\nC.\n");
    const count = countDuplicates(tree);
    expect(count).toBe(0);
  });
});
