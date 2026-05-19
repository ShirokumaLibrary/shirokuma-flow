/**
 * test-cases コマンド - テストケース一覧生成
 *
 * Jest と Playwright のテストケースを抽出し、HTML/Markdown で出力する
 */
import type { TestCasesOptions } from "./test-cases-types.js";
/**
 * test-cases コマンドハンドラ
 */
export declare function testCasesCommand(options: TestCasesOptions): Promise<number>;
/**
 * Jest テストファイルを収集
 */
export declare function collectJestFiles(projectPath: string, jestConfig?: {
    config?: string;
    testMatch?: string[];
}): Promise<string[]>;
/**
 * Playwright テストファイルを収集
 */
export declare function collectPlaywrightFiles(projectPath: string, playwrightConfig?: {
    config?: string;
    testDir?: string;
}): Promise<string[]>;
//# sourceMappingURL=test-cases.d.ts.map