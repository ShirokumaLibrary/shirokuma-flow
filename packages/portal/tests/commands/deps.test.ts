import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Deps Command Tests
 *
 * @testdoc deps コマンドのテスト
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
const mockWriteFile = vi.fn();
const mockIsLocalBinAvailable = vi.fn();
const mockExecFileAsync = vi.fn();

vi.mock("../../src/utils/logger.js", () => ({
  createLogger: mockCreateLogger,
}));

vi.mock("../../src/utils/i18n.js", () => ({
  t: vi.fn((key: string, _params?: Record<string, string>) => key),
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
  writeFile: mockWriteFile,
}));

vi.mock("../../src/utils/package-check.js", () => ({
  isLocalBinAvailable: mockIsLocalBinAvailable,
}));

vi.mock("../../src/utils/spawn-async.js", () => ({
  execFileAsync: mockExecFileAsync,
}));

// child_process の exec もモック
vi.mock("node:child_process", () => ({
  exec: vi.fn((_cmd: string, _opts: any, cb: any) => {
    if (cb) cb(null, "", "");
    return {};
  }),
}));

vi.mock("node:util", () => ({
  promisify: vi.fn(() => vi.fn().mockResolvedValue({ stdout: "", stderr: "" })),
}));

const { depsCommand } = await import("../../src/commands/deps.js");

// =============================================================================
// Tests
// =============================================================================

describe("depsCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateLogger.mockReturnValue(createMockLogger());
    mockResolvePath.mockImplementation((_base: string, p: string) => `/resolved/${p}`);
    mockGetOutputPath.mockReturnValue("/output/generated");
    mockLoadConfig.mockReturnValue({ deps: {} });
  });

  /**
   * @testdoc dependency-cruiser 未インストール時に exit code 1 を返す
   */
  it("should return 1 when dependency-cruiser is not installed", async () => {
    mockIsLocalBinAvailable.mockReturnValue(false);

    const exitCode = await depsCommand({ project: "/test", config: "config.yaml" });
    expect(exitCode).toBe(1);
  });

  /**
   * @testdoc 対象パスが存在しない場合に return する
   */
  it("should return early when no target paths exist", async () => {
    mockIsLocalBinAvailable.mockReturnValue(true);
    mockFileExists.mockReturnValue(false);

    await depsCommand({ project: "/test", config: "config.yaml" });

    expect(mockExecFileAsync).not.toHaveBeenCalled();
  });

  /**
   * @testdoc JSON 生成が成功する
   */
  it("should generate JSON output successfully", async () => {
    mockIsLocalBinAvailable.mockReturnValue(true);
    mockFileExists.mockReturnValue(true);
    mockLoadConfig.mockReturnValue({ deps: { formats: ["json"] } });
    mockExecFileAsync
      .mockResolvedValueOnce({ exitCode: 0, stdout: '{"modules":[]}', stderr: "" });

    await depsCommand({ project: "/test", config: "config.yaml" });

    expect(mockWriteFile).toHaveBeenCalled();
  });

  /**
   * @testdoc 全フォーマット失敗時に exit code 1 を返す
   */
  it("should return 1 when all formats fail", async () => {
    mockIsLocalBinAvailable.mockReturnValue(true);
    mockFileExists.mockReturnValue(true);
    mockLoadConfig.mockReturnValue({ deps: { formats: ["json"] } });
    mockExecFileAsync.mockResolvedValue({ exitCode: 1, stdout: "", stderr: "error" });

    const exitCode = await depsCommand({ project: "/test", config: "config.yaml" });
    expect(exitCode).toBe(1);
  });
});
