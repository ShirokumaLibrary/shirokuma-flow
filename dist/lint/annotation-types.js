/**
 * lint-annotations 用型定義
 *
 * コードアノテーションの整合性検証に使用する型
 */
/**
 * デフォルト設定
 */
export const defaultLintAnnotationsConfig = {
    enabled: true,
    strict: false,
    rules: {
        "usedComponents-match": {
            severity: "warning",
            checkOrder: false,
            excludeHooks: true,
        },
        "screen-required": {
            severity: "warning",
            paths: ["apps/*/app/**/page.tsx"],
            exclude: ["**/not-found.tsx", "**/error.tsx", "**/loading.tsx"],
        },
        "component-required": {
            severity: "info",
            paths: ["apps/*/components/**/*.tsx"],
            exclude: ["**/components/ui/**", "**/providers/**"],
        },
    },
    exclude: ["**/node_modules/**", "**/__tests__/**"],
};
//# sourceMappingURL=annotation-types.js.map