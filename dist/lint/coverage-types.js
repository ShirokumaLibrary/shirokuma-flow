/**
 * Coverage Types - 実装-テスト対応チェック用型定義
 *
 * 規約ベースのファイル対応検出と @skip-test アノテーションサポート
 */
/**
 * デフォルト規約
 */
export const defaultConventions = [
    { source: "lib/**/*.ts", test: "__tests__/lib/**/*.test.ts" },
    { source: "lib/**/*.tsx", test: "__tests__/lib/**/*.test.tsx" },
    { source: "components/**/*.tsx", test: "__tests__/components/**/*.test.tsx" },
    { source: "components/**/*.tsx", test: "__tests__/components/**/*.test.ts" },
    { source: "app/**/actions.ts", test: "__tests__/lib/actions/**/*.test.ts" },
];
/**
 * デフォルト除外パターン
 */
export const defaultExcludes = [
    "components/ui/**", // shadcn/ui
    "lib/generated/**", // 自動生成
    "**/index.ts", // re-export
    "**/*.d.ts", // 型定義
    "**/node_modules/**", // 外部パッケージ
    "**/__tests__/**", // テストファイル
];
//# sourceMappingURL=coverage-types.js.map