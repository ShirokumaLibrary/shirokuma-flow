/**
 * コマンドテスト共通ユーティリティ（portal 用 vitest 版）
 *
 * @testdoc コマンドテスト共通ユーティリティ
 */

import { vi } from 'vitest';
import type { Logger } from '../../src/utils/logger.js';

/**
 * テスト用 Logger モックを作成する。
 */
export function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
    step: vi.fn(),
  } as unknown as Logger;
}
