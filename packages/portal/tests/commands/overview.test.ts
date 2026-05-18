import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Overview Command Tests
 *
 * @testdoc overview コマンドのテスト
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
  resolvePath: mockResolvePath,
}));

vi.mock("../../src/utils/file.js", () => ({
  ensureDir: mockEnsureDir,
  writeFile: mockWriteFile,
  readFile: mockReadFile,
  fileExists: mockFileExists,
}));

vi.mock("../../src/utils/html.js", () => ({
  wrapHtmlDocument: mockWrapHtmlDocument,
  escapeHtml: mockEscapeHtml,
  icons: { back: "<svg/>", globe: "<svg/>", star: "<svg/>" },
}));

const { overviewCommand } = await import("../../src/commands/overview.js");

// =============================================================================
// Tests
// =============================================================================

describe("overviewCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateLogger.mockReturnValue(createMockLogger());
    mockLoadConfig.mockReturnValue({ project: { name: "test" } });
    mockGetOutputPath.mockReturnValue("/output/portal");
    mockResolvePath.mockImplementation((_base: string, p: string) => `/resolved/${p}`);
    // package.json を返すが feature-map.json は返さない
    mockReadFile.mockImplementation((path: string) => {
      if (typeof path === "string" && path.includes("package.json")) {
        return JSON.stringify({ name: "test-project", version: "1.0.0" });
      }
      return null;
    });
    mockWrapHtmlDocument.mockReturnValue("<html></html>");
    mockEscapeHtml.mockImplementation((s: string) => s);
  });

  /**
   * @testdoc 正常系で HTML ファイルを生成する
   */
  it("should generate overview HTML file", async () => {
    await overviewCommand({ project: "/test", config: "config.yaml" });

    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining("overview.html"),
      expect.any(String)
    );
  });

  /**
   * @testdoc overview が disabled の場合に早期 return する
   */
  it("should return early when overview is disabled", async () => {
    mockLoadConfig.mockReturnValue({
      project: { name: "test" },
      overview: { enabled: false },
    });

    await overviewCommand({ project: "/test", config: "config.yaml" });

    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  /**
   * @testdoc package.json が存在しない場合もエラーにならない
   */
  it("should handle missing package.json gracefully", async () => {
    mockReadFile.mockReturnValue(null);

    await overviewCommand({ project: "/test", config: "config.yaml" });

    expect(mockWriteFile).toHaveBeenCalled();
  });

  /**
   * @testdoc feature-map.json の統計を含める
   */
  it("should include feature-map stats when available", async () => {
    mockReadFile.mockImplementation((path: string) => {
      if (typeof path === "string" && path.includes("package.json")) {
        return JSON.stringify({ name: "test", version: "1.0.0" });
      }
      if (typeof path === "string" && path.includes("feature-map.json")) {
        return JSON.stringify({
          features: {
            Auth: {
              screens: [{ name: "LoginScreen", path: "app/login/page.tsx" }],
              components: [{ name: "LoginForm", path: "components/LoginForm.tsx" }],
              actions: [],
              tables: [],
            },
          },
        });
      }
      return null;
    });

    await overviewCommand({ project: "/test", config: "config.yaml" });

    expect(mockWriteFile).toHaveBeenCalled();
  });
});
