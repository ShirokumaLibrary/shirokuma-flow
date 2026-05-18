import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Details Command Tests
 *
 * @testdoc details コマンドのテスト
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
const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockCreateDetailsContext = vi.fn();
const mockExtractModuleName = vi.fn();
const mockGetElementFullKey = vi.fn();
const mockFindTestCasesForModule = vi.fn();
const mockGenerateScreenDetailPage = vi.fn();
const mockGenerateComponentDetailPage = vi.fn();
const mockGenerateActionDetailPage = vi.fn();
const mockGenerateTableDetailPage = vi.fn();
const mockGenerateModuleItemDetailPage = vi.fn();
const mockGenerateModuleDetailPage = vi.fn();

vi.mock("../../src/utils/logger.js", () => ({
  createLogger: mockCreateLogger,
}));

vi.mock("../../src/utils/i18n.js", () => ({
  t: vi.fn((key: string, _params?: any) => key),
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
}));

vi.mock("node:fs", () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
}));

vi.mock("../../src/commands/details-context.js", () => ({
  createDetailsContext: mockCreateDetailsContext,
  extractModuleName: mockExtractModuleName,
  getElementFullKey: mockGetElementFullKey,
}));

vi.mock("../../src/analyzers/details-test-analysis.js", () => ({
  findTestCasesForModule: mockFindTestCasesForModule,
}));

vi.mock("../../src/generators/details-entity-pages.js", () => ({
  generateScreenDetailPage: mockGenerateScreenDetailPage,
  generateComponentDetailPage: mockGenerateComponentDetailPage,
  generateActionDetailPage: mockGenerateActionDetailPage,
  generateTableDetailPage: mockGenerateTableDetailPage,
  generateModuleItemDetailPage: mockGenerateModuleItemDetailPage,
}));

vi.mock("../../src/generators/details-module-page.js", () => ({
  generateModuleDetailPage: mockGenerateModuleDetailPage,
}));

const { detailsCommand } = await import("../../src/commands/details.js");

// =============================================================================
// Tests
// =============================================================================

describe("detailsCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateLogger.mockReturnValue(createMockLogger());
    mockLoadConfig.mockReturnValue({ project: { name: "test" } });
    mockGetOutputPath.mockReturnValue("/output/portal");
    mockCreateDetailsContext.mockReturnValue({
      allTestCases: [],
      existingElements: {
        screens: new Map(),
        components: new Map(),
        actions: new Map(),
        modules: new Map(),
        tables: new Map(),
      },
      detailsJsonItems: {},
    });
    mockExtractModuleName.mockReturnValue("test-module");
    mockGetElementFullKey.mockImplementation((_mod: string, name: string) => name);
  });

  /**
   * @testdoc feature-map.json が存在しない場合に return する
   */
  it("should return early when feature-map.json does not exist", async () => {
    mockExistsSync.mockReturnValue(false);

    await detailsCommand({ project: "/test", config: "config.yaml" });

    expect(mockGenerateScreenDetailPage).not.toHaveBeenCalled();
  });

  /**
   * @testdoc 空の feature-map を正常に処理する
   */
  it("should handle empty feature map", async () => {
    mockExistsSync.mockImplementation((path: unknown) => {
      if (typeof path === "string" && path.includes("feature-map.json")) return true;
      return false;
    });
    mockReadFileSync.mockReturnValue(JSON.stringify({
      features: {},
    }));

    await detailsCommand({ project: "/test", config: "config.yaml" });

    expect(mockWriteFile).toHaveBeenCalled();
  });

  /**
   * @testdoc 各エンティティの詳細ページを生成する
   */
  it("should generate detail pages for each entity type", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation((path: unknown) => {
      if (typeof path === "string" && path.includes("test-cases.json")) {
        return JSON.stringify({ testCases: [] });
      }
      return JSON.stringify({
        features: {
          "Auth": {
            screens: [{ name: "LoginScreen", path: "app/login/page.tsx" }],
            components: [{ name: "LoginForm", path: "components/LoginForm.tsx" }],
            actions: [{ name: "loginAction", path: "actions/login.ts" }],
            modules: [],
            tables: [{ name: "users", path: "schema/users.ts" }],
          },
        },
      });
    });

    await detailsCommand({ project: "/test", config: "config.yaml" });

    expect(mockGenerateScreenDetailPage).toHaveBeenCalledTimes(1);
    expect(mockGenerateComponentDetailPage).toHaveBeenCalledTimes(1);
    expect(mockGenerateActionDetailPage).toHaveBeenCalledTimes(1);
    expect(mockGenerateTableDetailPage).toHaveBeenCalledTimes(1);
  });
});
