/**
 * token-optimizer tests
 *
 * トークン最適化分析のテスト
 *
 * @testdoc tokenOptimizer: トークン最適化分析を検証する
 */

import { TokenOptimizer } from "../../src/lint/token-optimizer.js";

describe("TokenOptimizer.analyze", () => {
  let optimizer: TokenOptimizer;

  beforeEach(() => {
    optimizer = new TokenOptimizer();
  });

  /**
   * @testdoc tokenOptimizer: 構造的ボールドを検出する
   */
  it("should detect structural bold in key-value pairs", () => {
    const content = "**Name**: John Doe\n**Age**: 30\n";
    const issues = optimizer.analyze(content, "test.md");

    expect(issues.some((i) => i.rule === "structural-bold")).toBe(true);
    expect(issues[0]!.tokenSavings).toBeGreaterThan(0);
  });

  /**
   * @testdoc tokenOptimizer: 内部リンクを検出する
   */
  it("should detect internal links", () => {
    const content = "See [docs](./guide.md) and [api](../api/ref.md).\n";
    const issues = optimizer.analyze(content, "test.md");

    expect(issues.some((i) => i.rule === "internal-link")).toBe(true);
  });

  /**
   * @testdoc tokenOptimizer: 冗長な修飾語を検出する
   */
  it("should detect redundant modifiers", () => {
    const content = "Automatically extract data from files.\n";
    const issues = optimizer.analyze(content, "test.md");

    expect(issues.some((i) => i.rule === "redundant-modifier")).toBe(true);
  });

  /**
   * @testdoc tokenOptimizer: クリーンなコンテンツには問題を報告しない
   */
  it("should report no issues for clean content", () => {
    const content = "Simple paragraph with no issues.\n";
    const issues = optimizer.analyze(content, "test.md");

    expect(issues).toHaveLength(0);
  });
});

describe("TokenOptimizer.generateReport", () => {
  let optimizer: TokenOptimizer;

  beforeEach(() => {
    optimizer = new TokenOptimizer();
  });

  /**
   * @testdoc tokenOptimizer: レポートを正しく生成する
   */
  it("should generate report with correct totals", () => {
    const issues = optimizer.analyze(
      "**Key**: Value\n[link](./file.md)\n",
      "test.md"
    );
    const report = optimizer.generateReport(issues);

    expect(report.totalIssues).toBe(issues.length);
    expect(report.totalTokenSavings).toBeGreaterThan(0);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  /**
   * @testdoc tokenOptimizer: 問題なしの場合のレポートを生成する
   */
  it("should generate empty report", () => {
    const report = optimizer.generateReport([]);

    expect(report.totalIssues).toBe(0);
    expect(report.totalTokenSavings).toBe(0);
    expect(report.recommendations).toContain(
      "✓ No token optimization issues found!"
    );
  });

  /**
   * @testdoc tokenOptimizer: Markdown 形式でレポートをフォーマットする
   */
  it("should format report as markdown", () => {
    const issues = optimizer.analyze(
      "**Field**: value\n",
      "test.md"
    );
    const report = optimizer.generateReport(issues);
    const md = optimizer.formatReportMarkdown(report);

    expect(md).toContain("# Token Optimization Report");
    expect(md).toContain("Issues Found");
  });

  /**
   * @testdoc tokenOptimizer: JSON 形式でレポートをフォーマットする
   */
  it("should format report as JSON", () => {
    const report = optimizer.generateReport([]);
    const json = optimizer.formatReportJSON(report);
    const parsed = JSON.parse(json);

    expect(parsed.totalIssues).toBe(0);
  });
});
