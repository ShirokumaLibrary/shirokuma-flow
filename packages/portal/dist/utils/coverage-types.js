/**
 * カバレッジ型定義（portal 用軽量版）
 *
 * flow/src/lint/coverage-types.ts から link-docs.ts に必要な定義のみを抽出。
 */
/** デフォルト規約 */
export const defaultConventions = [
    { source: "lib/**/*.ts", test: "__tests__/lib/**/*.test.ts" },
    { source: "lib/**/*.tsx", test: "__tests__/lib/**/*.test.tsx" },
    { source: "components/**/*.tsx", test: "__tests__/components/**/*.test.tsx" },
    { source: "components/**/*.tsx", test: "__tests__/components/**/*.test.ts" },
    { source: "app/**/actions.ts", test: "__tests__/lib/actions/**/*.test.ts" },
];
/** デフォルト除外パターン */
export const defaultExcludes = [
    "components/ui/**",
    "lib/generated/**",
    "**/index.ts",
    "**/*.d.ts",
    "**/node_modules/**",
    "**/__tests__/**",
];
//# sourceMappingURL=coverage-types.js.map