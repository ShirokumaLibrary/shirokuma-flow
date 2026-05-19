/**
 * section-meta parser tests
 *
 * セクションメタ YAML 解析のテスト
 *
 * @testdoc sectionMeta: セクションメタの解析・削除・検証を検証する
 */

import {
  extractSectionMeta,
  stripSectionMeta,
  validateSectionMeta,
  getSectionMeta,
} from "../../src/parsers/section-meta.js";

describe("extractSectionMeta", () => {
  /**
   * @testdoc sectionMeta: section-meta を正しく抽出する
   */
  it("should extract section-meta", () => {
    const md = "## Title\n<!-- section-meta\npriority: high\ntokens: 450\n-->\nContent\n";
    const result = extractSectionMeta(md);
    expect(result.sectionMeta).toHaveLength(1);
    expect(result.sectionMeta[0]!.parsed).toEqual({
      priority: "high",
      tokens: 450,
    });
  });

  /**
   * @testdoc sectionMeta: 複数の section-meta を抽出する
   */
  it("should extract multiple section-meta blocks", () => {
    const md =
      "## A\n<!-- section-meta\npriority: high\n-->\n\n## B\n<!-- section-meta\npriority: low\n-->\n";
    const result = extractSectionMeta(md);
    expect(result.sectionMeta).toHaveLength(2);
  });

  /**
   * @testdoc sectionMeta: コードブロック内の section-meta を無視する
   */
  it("should ignore section-meta inside code blocks", () => {
    const md = "```\n<!-- section-meta\npriority: high\n-->\n```\n";
    const result = extractSectionMeta(md);
    expect(result.sectionMeta).toHaveLength(0);
  });

  /**
   * @testdoc sectionMeta: section-meta がない場合は空配列を返す
   */
  it("should return empty array for no section-meta", () => {
    const result = extractSectionMeta("## Title\n\nContent\n");
    expect(result.sectionMeta).toHaveLength(0);
  });
});

describe("stripSectionMeta", () => {
  /**
   * @testdoc sectionMeta: section-meta を削除してコンテンツを保持する
   */
  it("should strip section-meta and keep content", () => {
    const md =
      "## Title\n\n<!-- section-meta\npriority: high\n-->\n\nContent\n";
    const result = stripSectionMeta(md);
    expect(result).not.toContain("section-meta");
    expect(result).toContain("## Title");
    expect(result).toContain("Content");
  });

  /**
   * @testdoc sectionMeta: コードブロック内の section-meta を保持する
   */
  it("should preserve section-meta inside code blocks", () => {
    const md = "```\n<!-- section-meta\npriority: high\n-->\n```\n";
    const result = stripSectionMeta(md);
    expect(result).toContain("section-meta");
  });

  /**
   * @testdoc sectionMeta: 削除後の過剰な空行を正規化する
   */
  it("should normalize excessive blank lines after removal", () => {
    const md =
      "A\n\n\n<!-- section-meta\npriority: high\n-->\n\n\nB\n";
    const result = stripSectionMeta(md);
    // 3行以上の空行は2行に正規化
    expect(result).not.toMatch(/\n{4,}/);
  });
});

describe("validateSectionMeta", () => {
  /**
   * @testdoc sectionMeta: 有効な YAML をエラーなしで通過する
   */
  it("should pass for valid YAML", () => {
    const md = "<!-- section-meta\npriority: high\n-->\n";
    const errors = validateSectionMeta(md);
    expect(errors).toHaveLength(0);
  });

  /**
   * @testdoc sectionMeta: 無効な YAML でエラーを報告する
   */
  it("should report error for invalid YAML", () => {
    const md = "<!-- section-meta\n  bad: yaml: : :\n-->\n";
    const errors = validateSectionMeta(md);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]!.error).toContain("Invalid YAML");
  });

  /**
   * @testdoc sectionMeta: 閉じていない section-meta でエラーを報告する
   */
  it("should report unclosed section-meta", () => {
    const md = "<!-- section-meta\npriority: high\n";
    const errors = validateSectionMeta(md);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.error).toContain("Unclosed");
  });
});

describe("getSectionMeta", () => {
  /**
   * @testdoc sectionMeta: 特定の見出しの section-meta を取得する
   */
  it("should get section-meta for a specific heading", () => {
    const md =
      "## Config\n<!-- section-meta\npriority: high\n-->\n\n## Other\n";
    const meta = getSectionMeta(md, "Config");
    expect(meta).toEqual({ priority: "high" });
  });

  /**
   * @testdoc sectionMeta: 見出しに section-meta がない場合は null を返す
   */
  it("should return null when heading has no section-meta", () => {
    const md = "## Config\n\nContent\n";
    const meta = getSectionMeta(md, "Config");
    expect(meta).toBeNull();
  });

  /**
   * @testdoc sectionMeta: 存在しない見出しでは null を返す
   */
  it("should return null for non-existent heading", () => {
    const md = "## Title\n<!-- section-meta\npriority: high\n-->\n";
    const meta = getSectionMeta(md, "NonExistent");
    expect(meta).toBeNull();
  });
});
