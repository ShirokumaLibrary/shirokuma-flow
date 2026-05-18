import { describe, it, expect, vi, beforeEach } from 'vitest';
/**
 * Portal Command Tests
 *
 * @testdoc portal コマンドのテスト
 */

import { createMockLogger } from "../helpers/command-test-utils.js";

// =============================================================================
// Mocks（vi.hoisted で hoisting 対応）
// =============================================================================

const mocks = vi.hoisted(() => ({
  createLogger: vi.fn(),
  loadConfig: vi.fn(),
  getOutputPath: vi.fn(),
  portalGeneratorGenerate: vi.fn(),
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
  runApiTools: vi.fn(),
}));

vi.mock("../../src/utils/logger.js", () => ({
  createLogger: mocks.createLogger,
}));

vi.mock("../../src/utils/i18n.js", () => ({
  t: vi.fn((key: string) => key),
}));

vi.mock("../../src/utils/config.js", () => ({
  loadConfig: mocks.loadConfig,
  getOutputPath: mocks.getOutputPath,
  CONFIG_FILE: ".shirokuma/config.yaml",
  CONFIG_FILE_CANDIDATES: [".shirokuma/config.yaml"],
}));

vi.mock("../../src/generators/portal/index.js", () => ({
  PortalGenerator: class {
    generate() { return mocks.portalGeneratorGenerate(); }
  },
}));

vi.mock("../../src/commands/api-tools.js", () => ({
  runApiTools: mocks.runApiTools,
}));

vi.mock("node:fs", () => ({
  existsSync: mocks.existsSync,
  writeFileSync: mocks.writeFileSync,
}));

const { portalCommand } = await import("../../src/commands/portal.js");

// =============================================================================
// Tests
// =============================================================================

describe("portalCommand", () => {
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = createMockLogger();
    mocks.createLogger.mockReturnValue(mockLogger);
    mocks.loadConfig.mockReturnValue({ project: { name: "TestProject" } });
    mocks.getOutputPath.mockReturnValue("/output/portal");
    mocks.portalGeneratorGenerate.mockResolvedValue(undefined);
    mocks.existsSync.mockReturnValue(false);
    mocks.runApiTools.mockResolvedValue(undefined);
  });

  /**
   * @testdoc PortalGenerator を使用してポータルを生成する
   */
  it("should generate portal using PortalGenerator", async () => {
    const options = { project: "/test", config: "config.yaml" };
    const result = await portalCommand(options);

    expect(result).toBe(0);
    expect(mocks.portalGeneratorGenerate).toHaveBeenCalledTimes(1);
  });

  /**
   * @testdoc output オプションを渡すと指定パスを使用する
   */
  it("should use output option when provided", async () => {
    const options = {
      project: "/test",
      config: "config.yaml",
      output: "/custom/output",
    };
    const result = await portalCommand(options);

    expect(result).toBe(0);
    expect(mocks.getOutputPath).not.toHaveBeenCalled();
  });

  /**
   * @testdoc PortalGenerator のエラーを伝播する
   */
  it("should propagate errors from PortalGenerator", async () => {
    mocks.portalGeneratorGenerate.mockRejectedValue(new Error("generation failed"));

    await expect(
      portalCommand({ project: "/test", config: "config.yaml" })
    ).rejects.toThrow("generation failed");
  });

  /**
   * @testdoc api-tools.json が存在しない場合は runApiTools を呼ぶ
   */
  it("should call runApiTools when api-tools.json does not exist", async () => {
    mocks.existsSync.mockReturnValue(false);

    await portalCommand({ project: "/test", config: "config.yaml" });

    expect(mocks.runApiTools).toHaveBeenCalledTimes(1);
  });

  /**
   * @testdoc api-tools.json が既に存在する場合は runApiTools をスキップする
   */
  it("should skip runApiTools when api-tools.json already exists", async () => {
    mocks.existsSync.mockImplementation((p: unknown) =>
      typeof p === "string" && (p as string).includes("api-tools.json")
    );

    await portalCommand({ project: "/test", config: "config.yaml" });

    expect(mocks.runApiTools).not.toHaveBeenCalled();
  });

  /**
   * @testdoc runApiTools が失敗してもポータル生成は続行する
   */
  it("should continue portal generation when runApiTools fails", async () => {
    mocks.runApiTools.mockRejectedValue(new Error("api-tools failed"));

    const result = await portalCommand({ project: "/test", config: "config.yaml" });

    expect(result).toBe(0);
    expect(mocks.portalGeneratorGenerate).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining("api-tools.json の生成をスキップ")
    );
  });
});
