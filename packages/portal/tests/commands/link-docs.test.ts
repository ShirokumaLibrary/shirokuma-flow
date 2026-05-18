import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Link Docs Command Tests
 *
 * @testdoc link-docs コマンドのテスト
 */

import { createMockLogger } from "../helpers/command-test-utils.js";

// =============================================================================
// Mocks
// =============================================================================

const mockCreateLogger = vi.fn();
const mockLoadConfig = vi.fn();
const mockGetOutputPath = vi.fn();
const mockResolvePath = vi.fn();
const mockEnsureDir = vi.fn();
const mockWriteFile = vi.fn();
const mockReadFile = vi.fn();
const mockFileExists = vi.fn();
const mockSafeRegExp = vi.fn();
const mockWrapHtmlDocument = vi.fn();
const mockEscapeHtml = vi.fn();
const mockGlobSync = vi.fn();
const mockCollectJestFiles = vi.fn();
const mockCollectPlaywrightFiles = vi.fn();
const mockExtractTestCases = vi.fn();

vi.mock("../../src/utils/logger.js", () => ({
  createLogger: mockCreateLogger,
}));

vi.mock("../../src/utils/i18n.js", () => ({
  t: vi.fn((key: string) => key),
}));

vi.mock("../../src/utils/config.js", () => ({
  loadConfig: mockLoadConfig,
  getOutputPath: mockGetOutputPath,
  resolvePath: mockResolvePath,
  CONFIG_FILE: ".shirokuma/config.yaml",
  CONFIG_FILE_CANDIDATES: [".shirokuma/config.yaml"],
}));

vi.mock("../../src/utils/file.js", () => ({
  ensureDir: mockEnsureDir,
  writeFile: mockWriteFile,
  readFile: mockReadFile,
  fileExists: mockFileExists,
}));

vi.mock("../../src/utils/sanitize.js", () => ({
  safeRegExp: mockSafeRegExp,
}));

vi.mock("../../src/utils/html.js", () => ({
  wrapHtmlDocument: mockWrapHtmlDocument,
  escapeHtml: mockEscapeHtml,
  icons: { back: "<svg/>" },
}));

vi.mock("glob", () => ({
  globSync: mockGlobSync,
}));

vi.mock("../../src/commands/test-cases.js", () => ({
  collectJestFiles: mockCollectJestFiles,
  collectPlaywrightFiles: mockCollectPlaywrightFiles,
}));

vi.mock("../../src/parsers/test-annotations.js", () => ({
  extractTestCases: mockExtractTestCases,
}));

const { linkDocsCommand } = await import("../../src/commands/link-docs.js");

// =============================================================================
// Tests
// =============================================================================

describe("linkDocsCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateLogger.mockReturnValue(createMockLogger());
    mockLoadConfig.mockReturnValue({
      project: { name: "test" },
      lintCoverage: {},
      testCases: {},
    });
    mockGetOutputPath.mockReturnValue("/output/portal");
    mockResolvePath.mockImplementation((_base: string, p: string) => `/resolved/${p}`);
    mockGlobSync.mockReturnValue([]);
    mockCollectJestFiles.mockResolvedValue([]);
    mockCollectPlaywrightFiles.mockResolvedValue([]);
    mockWrapHtmlDocument.mockReturnValue("<html></html>");
    mockEscapeHtml.mockImplementation((s: string) => s);
    mockSafeRegExp.mockImplementation((p: string) => new RegExp(p));
  });

  /**
   * @testdoc ソースファイルもテストもない場合に正常に完了する
   */
  it("should complete successfully with no source or test files", async () => {
    await linkDocsCommand({ project: "/test", config: "config.yaml" });

    expect(mockWriteFile).toHaveBeenCalledTimes(2); // HTML + JSON
  });

  /**
   * @testdoc JSON レポートにサマリーを含める
   */
  it("should include summary in JSON report", async () => {
    await linkDocsCommand({ project: "/test", config: "config.yaml" });

    const jsonCall = mockWriteFile.mock.calls.find(
      (c) => typeof c[0] === "string" && (c[0] as string).includes(".json")
    );
    expect(jsonCall).toBeDefined();
    if (jsonCall) {
      const report = JSON.parse(jsonCall[1] as string);
      expect(report.summary).toBeDefined();
      expect(report.summary.totalSources).toBe(0);
      expect(report.summary.coveragePercent).toBe(100);
    }
  });

  /**
   * @testdoc ソースファイルにマッチするテストがない場合 missing ステータスにする
   */
  it("should mark source files without matching tests as missing", async () => {
    mockGlobSync.mockReturnValue(["/test/src/utils/helper.ts"]);
    mockReadFile.mockReturnValue("export function helper() {}");

    await linkDocsCommand({ project: "/test", config: "config.yaml" });

    const jsonCall = mockWriteFile.mock.calls.find(
      (c) => typeof c[0] === "string" && (c[0] as string).includes(".json")
    );
    expect(jsonCall).toBeDefined();
    if (jsonCall) {
      const report = JSON.parse(jsonCall[1] as string);
      expect(report.linkedSources.length).toBe(1);
      expect(report.linkedSources[0].status).toBe("missing");
    }
  });

  /**
   * @testdoc @skip-test アノテーションのあるソースを skipped にする
   */
  it("should mark source files with @skip-test as skipped", async () => {
    mockGlobSync.mockReturnValue(["/test/src/utils/config.ts"]);
    mockReadFile.mockReturnValue("/** @skip-test 設定ファイルのため */\nexport const config = {};");

    await linkDocsCommand({ project: "/test", config: "config.yaml" });

    const jsonCall = mockWriteFile.mock.calls.find(
      (c) => typeof c[0] === "string" && (c[0] as string).includes(".json")
    );
    expect(jsonCall).toBeDefined();
    if (jsonCall) {
      const report = JSON.parse(jsonCall[1] as string);
      const skipped = report.linkedSources.filter((s: any) => s.status === "skipped");
      expect(skipped.length).toBe(1);
    }
  });
});
