/**
 * Shared test helper for creating Config objects
 *
 * md サブシステムテスト共通の Config ファクトリ
 */

import type { Config } from "../../../src/parsers/types/config.js";

/**
 * テスト用の Config オブジェクトを生成する
 *
 * build, validation, lint は浅いマージで個別プロパティをオーバーライド可能。
 * その他のトップレベルプロパティはそのまま上書き。
 */
export function createTestConfig(overrides: Partial<Config> = {}): Config {
  const { build, lint, validation, ...rest } = overrides;
  return {
    directories: { source: "docs/", output: "dist/", config: ".shirokuma/" },
    build: {
      default_output: "output.md",
      include: ["**/*.md"],
      exclude: ["node_modules/**"],
      frontmatter: { strip: true },
      toc: { enabled: false, depth: 3, title: "TOC" },
      file_separator: "\n\n---\n\n",
      sort: "path",
      strip_section_meta: false,
      strip_heading_numbers: false,
      ...build,
    },
    validation: {
      required_frontmatter: [],
      no_internal_links: false,
      ...validation,
    },
    lint: {
      builtin_rules: {},
      ...lint,
    },
    ...rest,
  } as Config;
}
