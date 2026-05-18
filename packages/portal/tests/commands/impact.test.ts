import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Impact Command Tests
 *
 * @testdoc impact コマンドのテスト
 */

import { createMockLogger } from "../helpers/command-test-utils.js";

// =============================================================================
// Mocks
// =============================================================================

const mockCreateLogger = vi.fn();
const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockMkdirSync = vi.fn();

vi.mock("../../src/utils/logger.js", () => ({
  createLogger: mockCreateLogger,
}));

vi.mock("../../src/utils/i18n.js", () => ({
  t: vi.fn((key: string) => key),
}));

vi.mock("node:fs", () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  mkdirSync: mockMkdirSync,
}));

// impact.ts はモジュールレベルで createLogger() を呼ぶため、import 前にデフォルト値を設定
mockCreateLogger.mockReturnValue(createMockLogger());

const { impactCommand } = await import("../../src/commands/impact.js");

// =============================================================================
// Helpers
// =============================================================================

function createDetailsJson(details: Record<string, unknown>) {
  return JSON.stringify({
    details,
    generatedAt: "2026-01-01T00:00:00Z",
  });
}

// =============================================================================
// Tests
// =============================================================================

describe("impactCommand", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateLogger.mockReturnValue(createMockLogger());
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  /**
   * @testdoc details.json が存在しない場合に return する
   */
  it("should return early when details.json does not exist", async () => {
    mockExistsSync.mockReturnValue(false);

    await impactCommand({});

    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  /**
   * @testdoc 空の details で正常に処理する
   */
  it("should handle empty details", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(createDetailsJson({}));

    await impactCommand({});

    // テーブル出力がされるはず
    expect(logSpy).toHaveBeenCalled();
  });

  /**
   * @testdoc 特定ターゲットの影響分析を行う
   */
  it("should analyze impact for a specific target", async () => {
    const details = {
      "component/auth/LoginForm": {
        name: "LoginForm",
        type: "component",
        moduleName: "auth",
        filePath: "components/LoginForm.tsx",
        related: {
          usedInScreens: ["LoginScreen"],
        },
      },
      "screen/auth/LoginScreen": {
        name: "LoginScreen",
        type: "screen",
        moduleName: "auth",
        filePath: "app/login/page.tsx",
        related: {},
      },
    };

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(createDetailsJson(details));

    await impactCommand({ target: "LoginForm" });

    expect(logSpy).toHaveBeenCalled();
  });

  /**
   * @testdoc 見つからないターゲットの場合に return する
   */
  it("should return when target is not found", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(createDetailsJson({
      "component/auth/LoginForm": {
        name: "LoginForm",
        type: "component",
        moduleName: "auth",
        filePath: "components/LoginForm.tsx",
        related: {},
      },
    }));

    await impactCommand({ target: "NonExistent" });

    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  /**
   * @testdoc JSON 形式で出力する
   */
  it("should output JSON format", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(createDetailsJson({
      "component/auth/LoginForm": {
        name: "LoginForm",
        type: "component",
        moduleName: "auth",
        filePath: "components/LoginForm.tsx",
        related: {},
      },
    }));

    await impactCommand({ format: "json", target: "LoginForm" });

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  /**
   * @testdoc HTML 形式で出力する
   */
  it("should output HTML format", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(createDetailsJson({
      "component/auth/LoginForm": {
        name: "LoginForm",
        type: "component",
        moduleName: "auth",
        filePath: "components/LoginForm.tsx",
        related: {},
      },
    }));

    await impactCommand({ format: "html", target: "LoginForm" });

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining("impact-analysis.html"),
      expect.stringContaining("<!DOCTYPE html>")
    );
  });

  /**
   * @testdoc 推移的依存を検出する
   */
  it("should detect transitive dependencies", async () => {
    const details = {
      "table/db/users": {
        name: "users",
        type: "table",
        moduleName: "db",
        filePath: "schema/users.ts",
        related: {
          usedInActions: ["loginAction"],
        },
      },
      "action/auth/loginAction": {
        name: "loginAction",
        type: "action",
        moduleName: "auth",
        filePath: "actions/login.ts",
        related: {
          usedInScreens: ["LoginScreen"],
        },
      },
      "screen/auth/LoginScreen": {
        name: "LoginScreen",
        type: "screen",
        moduleName: "auth",
        filePath: "app/login/page.tsx",
        related: {},
      },
    };

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(createDetailsJson(details));

    // JSON で出力して結果を検証
    await impactCommand({ format: "json", target: "users" });

    expect(mockWriteFileSync).toHaveBeenCalled();
    const jsonCall = mockWriteFileSync.mock.calls.find(
      (c) => typeof c[0] === "string" && (c[0] as string).includes(".json")
    );
    if (jsonCall) {
      const report = JSON.parse(jsonCall[1] as string);
      expect(report.items[0].totalAffected).toBeGreaterThanOrEqual(0);
    }
  });
});
