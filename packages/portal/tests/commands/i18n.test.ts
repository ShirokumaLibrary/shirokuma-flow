import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * i18n Command Tests
 *
 * @testdoc i18n コマンドのテスト
 */

import { createMockLogger } from "../helpers/command-test-utils.js";

// =============================================================================
// Mocks
// =============================================================================

const mockCreateLogger = vi.fn();
const mockLoadConfig = vi.fn();
const mockGetOutputPath = vi.fn();
const mockEnsureDir = vi.fn();
const mockWriteFile = vi.fn();
const mockReadFile = vi.fn();
const mockGlobSync = vi.fn();
const mockWrapHtmlDocument = vi.fn();
const mockEscapeHtml = vi.fn();

vi.mock("../../src/utils/logger.js", () => ({
  createLogger: mockCreateLogger,
}));

vi.mock("../../src/utils/i18n.js", () => ({
  t: vi.fn((key: string) => key),
}));

vi.mock("../../src/utils/config.js", () => ({
  loadConfig: mockLoadConfig,
  getOutputPath: mockGetOutputPath,
  CONFIG_FILE: ".shirokuma/config.yaml",
  CONFIG_FILE_CANDIDATES: [".shirokuma/config.yaml"],
}));

vi.mock("../../src/utils/file.js", () => ({
  ensureDir: mockEnsureDir,
  writeFile: mockWriteFile,
  readFile: mockReadFile,
}));

vi.mock("../../src/utils/html.js", () => ({
  wrapHtmlDocument: mockWrapHtmlDocument,
  escapeHtml: mockEscapeHtml,
  icons: { back: "<svg/>", globe: "<svg/>" },
}));

vi.mock("glob", () => ({
  globSync: mockGlobSync,
}));

const { i18nCommand } = await import("../../src/commands/i18n.js");

// =============================================================================
// Tests
// =============================================================================

describe("i18nCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateLogger.mockReturnValue(createMockLogger());
    mockLoadConfig.mockReturnValue({ project: { name: "test" } });
    mockGetOutputPath.mockReturnValue("/output/portal");
    mockGlobSync.mockReturnValue([]);
    mockWrapHtmlDocument.mockReturnValue("<html></html>");
    mockEscapeHtml.mockImplementation((s: string) => s);
  });

  /**
   * @testdoc メッセージファイルが見つからない場合に早期 return する
   */
  it("should return early when no message files found", async () => {
    mockGlobSync.mockReturnValue([]);

    await i18nCommand({ project: "/test", config: "config.yaml" });

    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  /**
   * @testdoc メッセージファイルが見つかった場合に JSON と HTML を出力する
   */
  it("should write JSON and HTML when message files are found", async () => {
    mockGlobSync.mockReturnValue(["/test/apps/web/messages/ja/common.json"]);
    mockReadFile.mockReturnValue(JSON.stringify({ hello: "こんにちは", world: "世界" }));

    await i18nCommand({ project: "/test", config: "config.yaml" });

    // JSON + HTML list + detail pages
    expect(mockWriteFile).toHaveBeenCalled();
    const jsonCall = mockWriteFile.mock.calls.find(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("i18n.json")
    );
    expect(jsonCall).toBeDefined();
  });

  /**
   * @testdoc JSON レポートに正しい統計を含める
   */
  it("should include correct stats in JSON report", async () => {
    mockGlobSync.mockReturnValue([
      "/test/apps/web/messages/ja/common.json",
      "/test/apps/web/messages/en/common.json",
    ]);
    mockReadFile.mockImplementation((path: string) => {
      if (path.includes("/ja/")) {
        return JSON.stringify({ hello: "こんにちは", world: "世界" });
      }
      if (path.includes("/en/")) {
        return JSON.stringify({ hello: "Hello", world: "World" });
      }
      return null;
    });

    await i18nCommand({ project: "/test", config: "config.yaml" });

    const jsonCall = mockWriteFile.mock.calls.find(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("i18n.json")
    );
    expect(jsonCall).toBeDefined();
    if (jsonCall) {
      const report = JSON.parse(jsonCall[1] as string);
      expect(report.stats).toBeDefined();
      expect(report.stats.totalKeys).toBeGreaterThan(0);
      expect(report.locales).toContain("ja");
    }
  });

  /**
   * @testdoc i18n が disabled の場合に早期 return する
   */
  it("should return early when i18n is disabled", async () => {
    mockLoadConfig.mockReturnValue({
      project: { name: "test" },
      i18n: { enabled: false },
    });

    await i18nCommand({ project: "/test", config: "config.yaml" });

    expect(mockWriteFile).not.toHaveBeenCalled();
  });
});
