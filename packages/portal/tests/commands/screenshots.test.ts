import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Screenshots Command Tests
 *
 * @testdoc screenshots コマンドのテスト
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
const mockFileExists = vi.fn();
const mockGlobSync = vi.fn();
const mockSpawnAsync = vi.fn();
const mockParseScreenshotAnnotations = vi.fn();
const mockInferRouteFromPath = vi.fn();
const mockApplyRouteParams = vi.fn();
const mockEscapeRegExp = vi.fn();

vi.mock("../../src/utils/logger.js", () => ({
  createLogger: mockCreateLogger,
}));

vi.mock("../../src/utils/i18n.js", () => ({
  t: vi.fn((key: string) => key),
}));

vi.mock("../../src/utils/config.js", () => ({
  loadConfig: mockLoadConfig,
  getOutputPath: mockGetOutputPath,
}));

vi.mock("../../src/utils/file.js", () => ({
  ensureDir: mockEnsureDir,
  writeFile: mockWriteFile,
  readFile: mockReadFile,
  fileExists: mockFileExists,
}));

vi.mock("glob", () => ({
  globSync: mockGlobSync,
}));

vi.mock("../../src/utils/spawn-async.js", () => ({
  spawnAsync: mockSpawnAsync,
}));

vi.mock("../../src/parsers/screenshot-annotations.js", () => ({
  parseScreenshotAnnotations: mockParseScreenshotAnnotations,
}));

vi.mock("../../src/utils/route-inference.js", () => ({
  inferRouteFromPath: mockInferRouteFromPath,
  applyRouteParams: mockApplyRouteParams,
}));

vi.mock("../../src/utils/sanitize.js", () => ({
  escapeRegExp: mockEscapeRegExp,
}));

const { screenshotsCommand } = await import("../../src/commands/screenshots.js");

// =============================================================================
// Tests
// =============================================================================

describe("screenshotsCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateLogger.mockReturnValue(createMockLogger());
    mockLoadConfig.mockReturnValue({ project: { name: "test" } });
    mockGetOutputPath.mockReturnValue("/output/portal");
    mockGlobSync.mockReturnValue([]);
    mockReadFile.mockReturnValue(null);
    mockFileExists.mockReturnValue(false);
    mockInferRouteFromPath.mockReturnValue("/");
    mockApplyRouteParams.mockImplementation((route: string) => route);
    mockEscapeRegExp.mockImplementation((s: string) => s);
  });

  /**
   * @testdoc screenshots が disabled の場合に早期 return する
   */
  it("should return early when screenshots is disabled", async () => {
    mockLoadConfig.mockReturnValue({
      project: { name: "test" },
      screenshots: { enabled: false },
    });

    await screenshotsCommand({ project: "/test", config: "config.yaml" });

    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  /**
   * @testdoc スクリーンが見つからない場合に早期 return する
   */
  it("should return early when no screens found", async () => {
    mockLoadConfig.mockReturnValue({ project: { name: "test" } });
    // feature-map.json が存在しない → screens 0件
    mockReadFile.mockReturnValue(null);

    await screenshotsCommand({ project: "/test", config: "config.yaml" });

    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  /**
   * @testdoc feature-map ソースからスクリーンを収集する
   */
  it("should collect screens from feature-map source", async () => {
    mockLoadConfig.mockReturnValue({
      project: { name: "test" },
      screenshots: { source: "feature-map" },
    });
    mockFileExists.mockReturnValue(true);
    // feature-map.json からスクリーンを返す
    mockReadFile.mockImplementation((path: string) => {
      if (typeof path === "string" && path.includes("feature-map.json")) {
        return JSON.stringify({
          features: {
            Auth: {
              screens: [
                { name: "LoginScreen", path: "apps/web/app/login/page.tsx", route: "/login" },
              ],
            },
          },
        });
      }
      return null;
    });
    mockInferRouteFromPath.mockReturnValue("/login");
    mockApplyRouteParams.mockImplementation((route: string) => route);

    await screenshotsCommand({ project: "/test", config: "config.yaml" });

    // テストスクリプトを生成するため writeFile が呼ばれるはず
    expect(mockWriteFile).toHaveBeenCalled();
  });

  /**
   * @testdoc config ソースからスクリーンを収集する
   */
  it("should collect screens from config source", async () => {
    mockLoadConfig.mockReturnValue({
      project: { name: "test" },
      screenshots: {
        source: "config",
        screens: [
          { name: "Dashboard", route: "/dashboard", description: "Main dashboard" },
        ],
      },
    });

    await screenshotsCommand({ project: "/test", config: "config.yaml" });

    expect(mockWriteFile).toHaveBeenCalled();
  });
});
