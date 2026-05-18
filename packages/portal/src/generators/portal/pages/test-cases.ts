/**
 * テストケースページジェネレーター
 */

import { renderTemplate } from "../renderer.js";
import type { PortalData, TestCase } from "../types.js";

/**
 * テストケース一覧ページの HTML を生成する
 */
export function generateTestCasesPage(data: PortalData): string {
  if (!data.testCases) {
    return renderTemplate("pages/empty-state.html.hbs", {
      title: "テストケース",
      message: "test-cases.json が見つかりません。",
    });
  }

  const { testCases } = data;

  // ファイル統計を構築
  const fileStats = buildFileStats(testCases.testCases);

  return renderTemplate("pages/test-cases.html.hbs", {
    projectName: data.projectName,
    summary: testCases.summary,
    fileStats,
    generatedAt: testCases.generatedAt,
  });
}

/**
 * テストケースファイル詳細ページの HTML を生成する
 */
export function generateTestCasesFilePage(
  data: PortalData,
  fileSlug: string
): string {
  if (!data.testCases) {
    return renderTemplate("pages/empty-state.html.hbs", {
      title: "テストケース",
      message: "test-cases.json が見つかりません。",
    });
  }

  // fileSlug からファイルパスを復元（スラッシュはエンコードされている）
  const decodedSlug = decodeURIComponent(fileSlug);
  const tests = data.testCases.testCases.filter(
    (tc) =>
      tc.file === decodedSlug ||
      tc.file.endsWith(decodedSlug) ||
      encodeURIComponent(tc.file) === fileSlug
  );

  if (tests.length === 0) {
    return renderTemplate("pages/empty-state.html.hbs", {
      title: "テストファイル",
      message: `ファイル「${decodedSlug}」が見つかりません。`,
    });
  }

  const file = tests[0].file;
  const framework = tests[0].framework;

  // describe グループでまとめる
  const describeGroups = groupByDescribe(tests);

  return renderTemplate("pages/test-cases-file.html.hbs", {
    projectName: data.projectName,
    file,
    fileSlug,
    framework,
    totalTests: tests.length,
    describeGroups,
  });
}

/**
 * テストケース詳細ページ（1件）の HTML を生成する
 */
export function generateTestCaseDetailPage(
  data: PortalData,
  fileSlug: string,
  line: number
): string {
  if (!data.testCases) {
    return renderTemplate("pages/empty-state.html.hbs", {
      title: "テストケース詳細",
      message: "test-cases.json が見つかりません。",
    });
  }

  const decodedSlug = decodeURIComponent(fileSlug);
  const test = data.testCases.testCases.find(
    (tc) =>
      (tc.file === decodedSlug ||
        tc.file.endsWith(decodedSlug) ||
        encodeURIComponent(tc.file) === fileSlug) &&
      tc.line === line
  );

  if (!test) {
    return renderTemplate("pages/empty-state.html.hbs", {
      title: "テストケース詳細",
      message: `テストケースが見つかりません。`,
    });
  }

  return renderTemplate("pages/test-cases-detail.html.hbs", {
    projectName: data.projectName,
    test,
    fileSlug,
  });
}

// === 内部ユーティリティ ===

interface FileStatEntry {
  file: string;
  framework: string;
  testCount: number;
  describeCount: number;
  fileSlug: string;
}

function buildFileStats(testCases: TestCase[]): FileStatEntry[] {
  const fileMap = new Map<
    string,
    { framework: string; tests: Set<string>; describes: Set<string> }
  >();

  for (const tc of testCases) {
    if (!fileMap.has(tc.file)) {
      fileMap.set(tc.file, {
        framework: tc.framework,
        tests: new Set(),
        describes: new Set(),
      });
    }
    const entry = fileMap.get(tc.file)!;
    entry.tests.add(`${tc.describe}::${tc.it}`);
    entry.describes.add(tc.describe);
  }

  return Array.from(fileMap.entries())
    .map(([file, stats]) => ({
      file,
      framework: stats.framework,
      testCount: stats.tests.size,
      describeCount: stats.describes.size,
      fileSlug: encodeURIComponent(file),
    }))
    .sort((a, b) => a.file.localeCompare(b.file));
}

interface DescribeGroup {
  describe: string;
  tests: TestCase[];
}

function groupByDescribe(tests: TestCase[]): DescribeGroup[] {
  const groups = new Map<string, TestCase[]>();

  for (const tc of tests) {
    if (!groups.has(tc.describe)) {
      groups.set(tc.describe, []);
    }
    groups.get(tc.describe)!.push(tc);
  }

  return Array.from(groups.entries()).map(([describe, tcList]) => ({
    describe,
    tests: tcList,
  }));
}
