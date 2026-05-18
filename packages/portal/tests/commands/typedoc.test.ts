import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * TypeDoc Command Tests
 *
 * @testdoc typedoc コマンドのテスト
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
const mockFileExists = vi.fn();
const mockDirExists = vi.fn();
const mockIsLocalBinAvailable = vi.fn();
const mockIsPackageInstalled = vi.fn();
const mockExecFileAsync = vi.fn();

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
  fileExists: mockFileExists,
  dirExists: mockDirExists,
}));

vi.mock("../../src/utils/package-check.js", () => ({
  isLocalBinAvailable: mockIsLocalBinAvailable,
  isPackageInstalled: mockIsPackageInstalled,
}));

vi.mock("../../src/utils/spawn-async.js", () => ({
  execFileAsync: mockExecFileAsync,
}));

const { typedocCommand } = await import("../../src/commands/typedoc.js");

// =============================================================================
// Tests
// =============================================================================

describe("typedocCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateLogger.mockReturnValue(createMockLogger());
    mockResolvePath.mockImplementation((_base: string, p: string) => `/resolved/${p}`);
    mockGetOutputPath.mockReturnValue("/output/generated");
  });

  /**
   * @testdoc TypeDoc 未インストール時に exit code 1 を返す
   */
  it("should return 1 when typedoc is not installed", async () => {
    mockIsLocalBinAvailable.mockReturnValue(false);

    const exitCode = await typedocCommand({ project: "/test", config: "config.yaml" });
    expect(exitCode).toBe(1);
  });

  /**
   * @testdoc エントリポイント未設定時に return する
   */
  it("should return early when no entry points configured", async () => {
    mockIsLocalBinAvailable.mockReturnValue(true);
    mockLoadConfig.mockReturnValue({ typedoc: {} });

    await typedocCommand({ project: "/test", config: "config.yaml" });

    expect(mockExecFileAsync).not.toHaveBeenCalled();
  });

  /**
   * @testdoc エントリポイントが存在しない場合に exit code 1 を返す
   */
  it("should return 1 when no valid entry points found", async () => {
    mockIsLocalBinAvailable.mockReturnValue(true);
    mockLoadConfig.mockReturnValue({
      typedoc: { entryPoints: ["src/actions"] },
    });
    mockFileExists.mockReturnValue(false);
    mockDirExists.mockReturnValue(false);

    const exitCode = await typedocCommand({ project: "/test", config: "config.yaml" });
    expect(exitCode).toBe(1);
  });

  /**
   * @testdoc 正常系: TypeDoc を実行する
   */
  it("should execute typedoc when properly configured", async () => {
    mockIsLocalBinAvailable.mockReturnValue(true);
    mockLoadConfig.mockReturnValue({
      typedoc: { entryPoints: ["src/actions"] },
    });
    mockFileExists.mockReturnValue(true);
    mockDirExists.mockReturnValue(true);
    mockIsPackageInstalled.mockReturnValue(false);
    mockExecFileAsync.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

    await typedocCommand({ project: "/test", config: "config.yaml" });

    expect(mockExecFileAsync).toHaveBeenCalledWith(
      "npx",
      expect.arrayContaining(["typedoc"]),
      expect.any(Object)
    );
  });

  /**
   * @testdoc TypeDoc 実行失敗時に exit code 1 を返す
   */
  it("should return 1 when typedoc generation fails", async () => {
    mockIsLocalBinAvailable.mockReturnValue(true);
    mockLoadConfig.mockReturnValue({
      typedoc: { entryPoints: ["src/actions"] },
    });
    mockFileExists.mockReturnValue(true);
    mockDirExists.mockReturnValue(true);
    mockIsPackageInstalled.mockReturnValue(false);
    mockExecFileAsync.mockResolvedValue({ exitCode: 1, stdout: "", stderr: "error" });

    const exitCode = await typedocCommand({ project: "/test", config: "config.yaml" });
    expect(exitCode).toBe(1);
  });

  /**
   * @testdoc markdown プラグインが利用可能な場合にプラグインを追加する
   */
  it("should add markdown plugin when available", async () => {
    mockIsLocalBinAvailable.mockReturnValue(true);
    mockLoadConfig.mockReturnValue({
      typedoc: { entryPoints: ["src/actions"] },
    });
    mockFileExists.mockReturnValue(true);
    mockDirExists.mockReturnValue(true);
    mockIsPackageInstalled.mockReturnValue(true);
    mockExecFileAsync.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

    await typedocCommand({ project: "/test", config: "config.yaml" });

    expect(mockExecFileAsync).toHaveBeenCalledWith(
      "npx",
      expect.arrayContaining(["--plugin", "typedoc-plugin-markdown"]),
      expect.any(Object)
    );
  });
});
