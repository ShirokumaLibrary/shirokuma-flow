import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Coverage Command Tests
 *
 * Tests for Istanbul/Jest coverage report parsing and visualization.
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseIstanbulCoverage,
  calculateTotalCoverage,
  checkThresholds,
  formatCoverageReport,
  getCoverageStatus,
  type IstanbulCoverageSummary,
  type FileCoverage,
  type CoverageThresholds,
  type CoverageCheckResult,
} from "../../src/commands/coverage.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("parseIstanbulCoverage", () => {
  /**
   * @testdoc 有効なIstanbul JSONを解析してFileCoverage配列を返す
   */
  it("should parse valid Istanbul JSON and return FileCoverage array", () => {
    const istanbulJson: IstanbulCoverageSummary = {
      total: {
        lines: { total: 100, covered: 80, skipped: 0, pct: 80 },
        statements: { total: 110, covered: 88, skipped: 0, pct: 80 },
        functions: { total: 20, covered: 16, skipped: 0, pct: 80 },
        branches: { total: 30, covered: 21, skipped: 0, pct: 70 },
      },
      "/path/to/file1.ts": {
        lines: { total: 50, covered: 45, skipped: 0, pct: 90 },
        statements: { total: 55, covered: 50, skipped: 0, pct: 90.91 },
        functions: { total: 10, covered: 9, skipped: 0, pct: 90 },
        branches: { total: 15, covered: 12, skipped: 0, pct: 80 },
      },
      "/path/to/file2.ts": {
        lines: { total: 50, covered: 35, skipped: 0, pct: 70 },
        statements: { total: 55, covered: 38, skipped: 0, pct: 69.09 },
        functions: { total: 10, covered: 7, skipped: 0, pct: 70 },
        branches: { total: 15, covered: 9, skipped: 0, pct: 60 },
      },
    };

    const result = parseIstanbulCoverage(istanbulJson);

    expect(result).toHaveLength(2);
    expect(result[0].path).toBe("/path/to/file1.ts");
    expect(result[0].lines.pct).toBe(90);
    expect(result[1].path).toBe("/path/to/file2.ts");
    expect(result[1].branches.pct).toBe(60);
  });

  /**
   * @testdoc 空のJSONでは空の配列を返す
   */
  it("should return empty array for empty JSON", () => {
    const result = parseIstanbulCoverage({});
    expect(result).toHaveLength(0);
  });

  /**
   * @testdoc totalエントリはファイル一覧から除外される
   */
  it("should exclude total entry from file list", () => {
    const istanbulJson: IstanbulCoverageSummary = {
      total: {
        lines: { total: 100, covered: 80, skipped: 0, pct: 80 },
        statements: { total: 110, covered: 88, skipped: 0, pct: 80 },
        functions: { total: 20, covered: 16, skipped: 0, pct: 80 },
        branches: { total: 30, covered: 21, skipped: 0, pct: 70 },
      },
    };

    const result = parseIstanbulCoverage(istanbulJson);
    expect(result).toHaveLength(0);
  });
});

describe("calculateTotalCoverage", () => {
  /**
   * @testdoc ファイル一覧からtotal coverageを計算する
   */
  it("should calculate total coverage from file list", () => {
    const files: FileCoverage[] = [
      {
        path: "/file1.ts",
        lines: { total: 100, covered: 80, pct: 80 },
        statements: { total: 100, covered: 80, pct: 80 },
        functions: { total: 10, covered: 8, pct: 80 },
        branches: { total: 20, covered: 14, pct: 70 },
      },
      {
        path: "/file2.ts",
        lines: { total: 100, covered: 60, pct: 60 },
        statements: { total: 100, covered: 60, pct: 60 },
        functions: { total: 10, covered: 6, pct: 60 },
        branches: { total: 20, covered: 12, pct: 60 },
      },
    ];

    const total = calculateTotalCoverage(files);

    expect(total.lines.total).toBe(200);
    expect(total.lines.covered).toBe(140);
    expect(total.lines.pct).toBe(70);
    expect(total.branches.pct).toBe(65);
  });

  /**
   * @testdoc 空のファイル一覧では0%を返す
   */
  it("should return 0% for empty file list", () => {
    const total = calculateTotalCoverage([]);

    expect(total.lines.pct).toBe(0);
    expect(total.statements.pct).toBe(0);
    expect(total.functions.pct).toBe(0);
    expect(total.branches.pct).toBe(0);
  });

  /**
   * @testdoc totalが0の場合は0%を返す
   */
  it("should return 0% when total is 0", () => {
    const files: FileCoverage[] = [
      {
        path: "/empty.ts",
        lines: { total: 0, covered: 0, pct: 0 },
        statements: { total: 0, covered: 0, pct: 0 },
        functions: { total: 0, covered: 0, pct: 0 },
        branches: { total: 0, covered: 0, pct: 0 },
      },
    ];

    const total = calculateTotalCoverage(files);

    expect(total.lines.pct).toBe(0);
  });
});

describe("checkThresholds", () => {
  const defaultThresholds: CoverageThresholds = {
    lines: 80,
    branches: 70,
    functions: 80,
    statements: 80,
  };

  /**
   * @testdoc 全ての閾値を満たすと成功を返す
   */
  it("should return success when all thresholds are met", () => {
    const coverage = {
      lines: { total: 100, covered: 85, pct: 85 },
      statements: { total: 100, covered: 85, pct: 85 },
      functions: { total: 10, covered: 9, pct: 90 },
      branches: { total: 20, covered: 15, pct: 75 },
    };

    const result = checkThresholds(coverage, defaultThresholds);

    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  /**
   * @testdoc lines閾値未満で失敗を返す
   */
  it("should return failure when lines threshold is not met", () => {
    const coverage = {
      lines: { total: 100, covered: 70, pct: 70 },
      statements: { total: 100, covered: 85, pct: 85 },
      functions: { total: 10, covered: 9, pct: 90 },
      branches: { total: 20, covered: 15, pct: 75 },
    };

    const result = checkThresholds(coverage, defaultThresholds);

    expect(result.passed).toBe(false);
    expect(result.failures).toContain("lines: 70% < 80%");
  });

  /**
   * @testdoc 複数の閾値未満で全ての失敗を報告する
   */
  it("should report all failures when multiple thresholds are not met", () => {
    const coverage = {
      lines: { total: 100, covered: 50, pct: 50 },
      statements: { total: 100, covered: 50, pct: 50 },
      functions: { total: 10, covered: 5, pct: 50 },
      branches: { total: 20, covered: 10, pct: 50 },
    };

    const result = checkThresholds(coverage, defaultThresholds);

    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(4);
  });

  /**
   * @testdoc 閾値が未定義の場合はチェックをスキップする
   */
  it("should skip check for undefined thresholds", () => {
    const coverage = {
      lines: { total: 100, covered: 50, pct: 50 },
      statements: { total: 100, covered: 50, pct: 50 },
      functions: { total: 10, covered: 5, pct: 50 },
      branches: { total: 20, covered: 10, pct: 50 },
    };

    const partialThresholds: CoverageThresholds = {
      lines: 80,
    };

    const result = checkThresholds(coverage, partialThresholds);

    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toContain("lines");
  });
});

describe("getCoverageStatus", () => {
  /**
   * @testdoc 90%以上は'high'を返す
   */
  it("should return 'high' for 90% or above", () => {
    expect(getCoverageStatus(90)).toBe("high");
    expect(getCoverageStatus(95)).toBe("high");
    expect(getCoverageStatus(100)).toBe("high");
  });

  /**
   * @testdoc 70-89%は'medium'を返す
   */
  it("should return 'medium' for 70-89%", () => {
    expect(getCoverageStatus(70)).toBe("medium");
    expect(getCoverageStatus(80)).toBe("medium");
    expect(getCoverageStatus(89)).toBe("medium");
  });

  /**
   * @testdoc 70%未満は'low'を返す
   */
  it("should return 'low' for below 70%", () => {
    expect(getCoverageStatus(69)).toBe("low");
    expect(getCoverageStatus(50)).toBe("low");
    expect(getCoverageStatus(0)).toBe("low");
  });
});

describe("formatCoverageReport", () => {
  const sampleFiles: FileCoverage[] = [
    {
      path: "/src/utils/file.ts",
      lines: { total: 100, covered: 90, pct: 90 },
      statements: { total: 100, covered: 90, pct: 90 },
      functions: { total: 10, covered: 9, pct: 90 },
      branches: { total: 20, covered: 18, pct: 90 },
    },
    {
      path: "/src/commands/lint.ts",
      lines: { total: 50, covered: 35, pct: 70 },
      statements: { total: 50, covered: 35, pct: 70 },
      functions: { total: 5, covered: 3, pct: 60 },
      branches: { total: 10, covered: 6, pct: 60 },
    },
  ];

  /**
   * @testdoc summary形式でサマリー情報を出力する
   */
  it("should output summary information in summary format", () => {
    const result = formatCoverageReport(sampleFiles, "summary");

    expect(result).toContain("Coverage Summary");
    expect(result).toContain("Lines:");
    expect(result).toContain("Statements:");
    expect(result).toContain("Functions:");
    expect(result).toContain("Branches:");
  });

  /**
   * @testdoc json形式で有効なJSONを出力する
   */
  it("should output valid JSON in json format", () => {
    const result = formatCoverageReport(sampleFiles, "json");
    const parsed = JSON.parse(result);

    expect(parsed.files).toHaveLength(2);
    expect(parsed.total).toBeDefined();
    expect(parsed.total.lines).toBeDefined();
  });

  /**
   * @testdoc html形式でHTMLダッシュボードを出力する
   */
  it("should output HTML dashboard in html format", () => {
    const result = formatCoverageReport(sampleFiles, "html");

    expect(result).toContain("<!DOCTYPE html>");
    expect(result).toContain("Coverage Dashboard");
    expect(result).toContain("/src/utils/file.ts");
  });

  /**
   * @testdoc html出力にファイル別カバレッジ表を含む
   */
  it("should include file coverage table in html output", () => {
    const result = formatCoverageReport(sampleFiles, "html");

    expect(result).toContain("<table");
    expect(result).toContain("Lines");
    expect(result).toContain("Branches");
    expect(result).toContain("Functions");
    expect(result).toContain("Statements");
  });

  /**
   * @testdoc html出力でカバレッジに応じた色分けを行う
   */
  it("should color code coverage in html output", () => {
    const result = formatCoverageReport(sampleFiles, "html");

    // high (>=90): green, medium (70-89): yellow, low (<70): red
    expect(result).toContain("coverage-high");
    expect(result).toContain("coverage-medium");
  });
});

describe("Coverage integration", () => {
  /**
   * @testdoc ファイル解析から閾値チェックまでの完全なワークフローが動作する
   */
  it("should work through complete workflow from parsing to threshold check", () => {
    const istanbulJson: IstanbulCoverageSummary = {
      total: {
        lines: { total: 200, covered: 170, skipped: 0, pct: 85 },
        statements: { total: 220, covered: 187, skipped: 0, pct: 85 },
        functions: { total: 30, covered: 24, skipped: 0, pct: 80 },
        branches: { total: 50, covered: 35, skipped: 0, pct: 70 },
      },
      "/src/file1.ts": {
        lines: { total: 100, covered: 90, skipped: 0, pct: 90 },
        statements: { total: 110, covered: 99, skipped: 0, pct: 90 },
        functions: { total: 15, covered: 13, skipped: 0, pct: 86.67 },
        branches: { total: 25, covered: 20, skipped: 0, pct: 80 },
      },
      "/src/file2.ts": {
        lines: { total: 100, covered: 80, skipped: 0, pct: 80 },
        statements: { total: 110, covered: 88, skipped: 0, pct: 80 },
        functions: { total: 15, covered: 11, skipped: 0, pct: 73.33 },
        branches: { total: 25, covered: 15, skipped: 0, pct: 60 },
      },
    };

    // Step 1: Parse
    const files = parseIstanbulCoverage(istanbulJson);
    expect(files).toHaveLength(2);

    // Step 2: Calculate total
    const total = calculateTotalCoverage(files);
    expect(total.lines.pct).toBe(85);

    // Step 3: Check thresholds
    const thresholds: CoverageThresholds = {
      lines: 80,
      branches: 70,
      functions: 75,
      statements: 80,
    };

    const result = checkThresholds(total, thresholds);
    expect(result.passed).toBe(true);

    // Step 4: Format output
    const output = formatCoverageReport(files, "summary");
    expect(output).toContain("Lines:");
  });
});
