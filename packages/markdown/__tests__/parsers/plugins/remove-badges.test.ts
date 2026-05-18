/**
 * remove-badges plugin tests
 *
 * バッジ画像削除プラグインの入出力テスト
 *
 * @testdoc removeBadges: バッジ画像削除プラグインを検証する
 */

import { remarkRemoveBadges } from "../../../src/parsers/plugins/remove-badges.js";
import { processWithPlugin } from "../../helpers/md/process-plugin.js";

const process = (md: string) => processWithPlugin(md, remarkRemoveBadges);

describe("remarkRemoveBadges", () => {
  /**
   * @testdoc removeBadges: shields.io バッジを削除する
   */
  it("should remove shields.io badges", async () => {
    const input =
      "![Build](https://img.shields.io/github/workflow/status/org/repo)\n";
    const output = await process(input);
    expect(output).not.toContain("shields.io");
  });

  /**
   * @testdoc removeBadges: Codecov バッジを削除する
   */
  it("should remove codecov badges", async () => {
    const input = "![Coverage](https://codecov.io/gh/org/repo/badge.svg)\n";
    const output = await process(input);
    expect(output).not.toContain("codecov");
  });

  /**
   * @testdoc removeBadges: GitHub Actions バッジを削除する
   */
  it("should remove GitHub Actions badges", async () => {
    const input =
      "![CI](https://github.com/org/repo/workflows/CI/badge.svg)\n";
    const output = await process(input);
    expect(output).not.toContain("badge.svg");
  });

  /**
   * @testdoc removeBadges: 通常の画像は保持する
   */
  it("should preserve non-badge images", async () => {
    const input = "![Screenshot](./images/screenshot.png)\n";
    const output = await process(input);
    expect(output).toContain("screenshot.png");
  });

  /**
   * @testdoc removeBadges: badgen.net バッジを削除する
   */
  it("should remove badgen.net badges", async () => {
    const input = "![License](https://badgen.net/badge/license/MIT/blue)\n";
    const output = await process(input);
    expect(output).not.toContain("badgen.net");
  });

  /**
   * @testdoc removeBadges: travis-ci バッジを削除する
   */
  it("should remove travis-ci badges", async () => {
    const input =
      "![Build](https://travis-ci.org/org/repo.svg?branch=main)\n";
    const output = await process(input);
    expect(output).not.toContain("travis-ci");
  });

  /**
   * @testdoc removeBadges: テキストとバッジが混在する場合テキストを保持する
   */
  it("should preserve text when removing badges", async () => {
    const input =
      "# My Project\n\n![Badge](https://img.shields.io/npm/v/pkg)\n\nDescription here.\n";
    const output = await process(input);
    expect(output).toContain("# My Project");
    expect(output).toContain("Description here.");
    expect(output).not.toContain("shields.io");
  });
});
