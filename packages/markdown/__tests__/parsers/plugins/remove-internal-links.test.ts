/**
 * remove-internal-links plugin tests
 *
 * 内部リンク削除プラグインの入出力テスト
 *
 * @testdoc removeInternalLinks: 内部リンク削除プラグインを検証する
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import {
  remarkRemoveInternalLinks,
  countInternalLinks,
} from "../../../src/parsers/plugins/remove-internal-links.js";
import { processWithPlugin } from "../../helpers/md/process-plugin.js";

const process = (md: string) => processWithPlugin(md, remarkRemoveInternalLinks);

describe("remarkRemoveInternalLinks", () => {
  /**
   * @testdoc removeInternalLinks: 相対パスの .md リンクを削除しテキストを保持する
   */
  it("should remove relative .md links and keep text", async () => {
    const input = "[See documentation](./docs/guide.md)\n";
    const output = await process(input);
    expect(output).toContain("See documentation");
    expect(output).not.toContain("./docs/guide.md");
  });

  /**
   * @testdoc removeInternalLinks: 親ディレクトリ参照リンクを削除する
   */
  it("should remove parent directory .md links", async () => {
    const input = "[Previous section](../intro.md)\n";
    const output = await process(input);
    expect(output).toContain("Previous section");
    expect(output).not.toContain("../intro.md");
  });

  /**
   * @testdoc removeInternalLinks: 外部リンクは保持する
   */
  it("should preserve external links", async () => {
    const input = "[GitHub](https://github.com)\n";
    const output = await process(input);
    expect(output).toContain("[GitHub](https://github.com)");
  });

  /**
   * @testdoc removeInternalLinks: 内部と外部リンクが混在する場合を正しく処理する
   */
  it("should handle mixed internal and external links", async () => {
    const input =
      "See [docs](./guide.md) and [GitHub](https://github.com).\n";
    const output = await process(input);
    expect(output).toContain("docs");
    expect(output).not.toContain("./guide.md");
    expect(output).toContain("https://github.com");
  });

  /**
   * @testdoc removeInternalLinks: 深い相対パスリンクを削除する
   */
  it("should remove deeply nested relative links", async () => {
    const input = "[API](../../api/reference.md)\n";
    const output = await process(input);
    expect(output).toContain("API");
    expect(output).not.toContain("../../api/reference.md");
  });
});

describe("countInternalLinks", () => {
  /**
   * @testdoc countInternalLinks: 内部リンクの数を正しくカウントする
   */
  it("should count internal links", () => {
    const tree = unified()
      .use(remarkParse)
      .parse("[a](./a.md) and [b](../b.md) and [c](https://example.com)\n");
    const count = countInternalLinks(tree);
    expect(count).toBe(2);
  });

  /**
   * @testdoc countInternalLinks: 内部リンクがなければ 0 を返す
   */
  it("should return 0 for no internal links", () => {
    const tree = unified()
      .use(remarkParse)
      .parse("[GitHub](https://github.com)\n");
    const count = countInternalLinks(tree);
    expect(count).toBe(0);
  });
});
