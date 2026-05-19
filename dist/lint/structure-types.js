/**
 * lint-structure コマンドの型定義
 *
 * プロジェクト構造検証のための型
 */
// ============================================
// デフォルト設定
// ============================================
export const defaultLintStructureConfig = {
    enabled: true,
    strict: true,
    rules: {
        "dir-required": {
            severity: "error",
            apps: [
                "app",
                "app/[locale]",
                "components",
                "components/ui",
                "lib",
                "lib/actions",
                "lib/auth",
                "messages",
            ],
            packages: {
                database: ["src/schema", "src"],
            },
        },
        "file-required": {
            severity: "error",
            apps: ["middleware.ts", "next.config.ts", "package.json"],
            packages: {
                database: ["src/schema/index.ts", "src/index.ts", "drizzle.config.ts"],
            },
        },
        "lib-no-root-files": {
            severity: "error",
            enabled: true,
        },
        "lib-has-index": {
            severity: "warning",
            enabled: true,
        },
        "dir-recommended": {
            severity: "info",
            apps: ["types", "hooks", "lib/security", "lib/utils"],
        },
        "naming-convention": {
            severity: "warning",
            enabled: true,
            rules: {
                domainDirs: "PascalCase",
                components: "PascalCase",
                actions: "camelCase",
                routeGroups: "lowercase",
            },
        },
        "no-cross-app-import": {
            severity: "error",
            enabled: true,
        },
        "components-domain-grouping": {
            severity: "warning",
            enabled: true,
            systemDirs: ["ui", "layout", "common", "providers", "__tests__"],
        },
        "lib-structure-compliance": {
            severity: "error",
            enabled: true,
            allowedDirs: [
                "actions",
                "auth",
                "context",
                "constants",
                "security",
                "utils",
                "validations",
                "__tests__",
            ],
            disallowContextMixing: true,
        },
        "barrel-export-required": {
            severity: "warning",
            enabled: true,
            targetDirs: ["components", "lib"],
            excludeDirs: ["ui", "__tests__", "node_modules"],
            minFiles: 2,
        },
        "actions-separation": {
            severity: "error",
            enabled: true,
            disallowCrudToDomain: true,
        },
    },
};
//# sourceMappingURL=structure-types.js.map