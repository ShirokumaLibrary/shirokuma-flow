/**
 * 設定ファイル読み込みユーティリティ
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { t, setLocaleFromConfig } from "./i18n.js";
/**
 * デフォルト設定
 */
export const defaultConfig = {
    project: {
        name: "Project",
        description: "",
    },
    output: {
        dir: "./docs",
        portal: "./docs/portal",
        generated: "./docs/generated",
    },
    typedoc: {
        entryPoints: ["./src"],
        tsconfig: "./tsconfig.json",
        exclude: ["**/node_modules/**", "**/*.test.ts", "**/*.spec.ts"],
    },
    schema: {
        sources: [
            { path: "./packages/database/src/schema" },
        ],
        pattern: "*.ts",
    },
    deps: {
        include: ["src", "lib", "app"],
        exclude: ["node_modules", ".next", "dist"],
        output: undefined,
        formats: ["svg", "json"],
    },
    testCases: {
        jest: {
            config: "./jest.config.ts",
            testMatch: ["**/__tests__/**/*.test.{ts,tsx}", "**/*.test.{ts,tsx}"],
        },
        playwright: {
            config: "./playwright.config.ts",
            testDir: "./tests/e2e",
        },
        output: undefined,
        bddAnnotations: {
            enabled: true,
            tags: ["given", "when", "then", "and"],
        },
    },
    portal: {
        title: "ドキュメントポータル",
        links: [],
        devTools: [],
    },
    packages: [],
    lintTests: {
        rules: {
            "testdoc-required": "warning",
            "testdoc-japanese": "warning",
            "testdoc-min-length": "info",
            "duplicate-testdoc": "error",
            "describe-coverage": "info",
        },
        strict: false,
        coverageThreshold: 0,
        ignore: [],
    },
    adr: {
        enabled: true,
        directory: "docs/adr",
        template: "madr",
        language: "ja",
    },
    search: {
        enabled: true,
        engine: "flexsearch",
        indexOutput: undefined,
        include: ["docs/**/*.md", "README.md", "CLAUDE.md"],
        exclude: ["**/node_modules/**"],
    },
    linkDocs: {
        enabled: true,
        showCoverage: true,
        apiDocsPath: "docs/generated/api",
        testCasesPath: "docs/portal/test-cases.html",
        outputFile: "linked-docs.html",
    },
    featureMap: {
        enabled: true,
        include: [
            "apps/*/app/**/*.tsx",
            "apps/*/components/**/*.tsx",
            "apps/*/lib/actions/**/*.ts",
            "packages/*/src/schema/**/*.ts",
        ],
        exclude: [
            "**/node_modules/**",
            "**/*.test.ts",
            "**/*.test.tsx",
            "**/*.spec.ts",
            "**/*.spec.tsx",
        ],
    },
    overview: {
        enabled: true,
        file: undefined,
        layers: [],
        features: [],
        techStack: [],
        quickLinks: [],
    },
    screenshots: {
        enabled: true,
        source: "feature-map",
        scanPaths: ["apps/*/app/**/*page.tsx"],
        screens: [],
        baseUrl: "https://localhost:3000",
        locale: "ja",
        auth: {
            email: "admin@example.com",
            password: "Admin@Test2024!",
            loginPath: "/login",
        },
        viewport: {
            width: 1280,
            height: 720,
        },
        outputDir: "docs/portal/screenshots",
        testFile: "tests/e2e/screenshots.generated.spec.ts",
        routeParams: {
            "[locale]": "ja",
            "[orgSlug]": "test-org",
            "[projectSlug]": "test-project",
            "[sessionId]": "test-session",
            "[entityId]": "test-entity",
        },
        screenOverrides: {},
        dynamicRoutes: {
            enabled: false,
            helperModule: "./tests/helpers/database",
            paramMethods: {},
            databaseUrl: "",
        },
    },
    lintDocs: {
        enabled: false,
        strict: false,
        required: [],
        validateLinks: {
            enabled: true,
            checkInternal: true,
            checkExternal: false,
        },
        formatting: {
            maxLineLength: 120,
            requireBlankLineBeforeHeading: true,
        },
    },
    lintAnnotations: {
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
    },
    lintStructure: {
        enabled: false,
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
        },
    },
};
/**
 * 設定ファイルを読み込む
 */
export function loadConfig(projectPath, configFile) {
    const configPath = resolve(projectPath, configFile);
    if (!existsSync(configPath)) {
        console.warn(t("config.notFound", { path: configPath }));
        console.warn(t("config.usingDefaults"));
        return defaultConfig;
    }
    try {
        const content = readFileSync(configPath, "utf-8");
        const userConfig = parseYaml(content);
        // デフォルト設定とマージ
        const merged = mergeConfig(defaultConfig, userConfig);
        // Set locale from config if available
        if (merged.locale) {
            setLocaleFromConfig(merged.locale);
        }
        return merged;
    }
    catch (error) {
        console.error(t("config.loadFailed", { error: String(error) }));
        return defaultConfig;
    }
}
/**
 * 設定をマージ
 */
function mergeConfig(base, override) {
    return {
        locale: override.locale ?? base.locale,
        project: { ...base.project, ...override.project },
        output: { ...base.output, ...override.output },
        typedoc: { ...base.typedoc, ...override.typedoc },
        schema: override.schema ?? base.schema,
        deps: { ...base.deps, ...override.deps },
        testCases: {
            jest: { ...base.testCases?.jest, ...override.testCases?.jest },
            playwright: { ...base.testCases?.playwright, ...override.testCases?.playwright },
            output: override.testCases?.output ?? base.testCases?.output,
            bddAnnotations: {
                enabled: override.testCases?.bddAnnotations?.enabled ?? base.testCases?.bddAnnotations?.enabled ?? true,
                tags: override.testCases?.bddAnnotations?.tags ?? base.testCases?.bddAnnotations?.tags ?? ["given", "when", "then", "and"],
            },
        },
        portal: { ...base.portal, ...override.portal },
        packages: override.packages ?? base.packages ?? [],
        lintTests: {
            rules: { ...base.lintTests?.rules, ...override.lintTests?.rules },
            strict: override.lintTests?.strict ?? base.lintTests?.strict,
            coverageThreshold: override.lintTests?.coverageThreshold ?? base.lintTests?.coverageThreshold,
            ignore: override.lintTests?.ignore ?? base.lintTests?.ignore,
        },
        lintCoverage: override.lintCoverage
            ? {
                enabled: override.lintCoverage.enabled ?? base.lintCoverage?.enabled,
                strict: override.lintCoverage.strict ?? base.lintCoverage?.strict,
                requireSkipReason: override.lintCoverage.requireSkipReason ?? base.lintCoverage?.requireSkipReason,
                conventions: override.lintCoverage.conventions ?? base.lintCoverage?.conventions,
                exclude: override.lintCoverage.exclude ?? base.lintCoverage?.exclude,
            }
            : base.lintCoverage,
        adr: override.adr
            ? {
                enabled: override.adr.enabled ?? base.adr?.enabled,
                directory: override.adr.directory ?? base.adr?.directory,
                template: override.adr.template ?? base.adr?.template,
                language: override.adr.language ?? base.adr?.language,
            }
            : base.adr,
        coverage: override.coverage
            ? {
                enabled: override.coverage.enabled ?? base.coverage?.enabled,
                source: override.coverage.source ?? base.coverage?.source,
                thresholds: {
                    ...base.coverage?.thresholds,
                    ...override.coverage.thresholds,
                },
                failUnder: override.coverage.failUnder ?? base.coverage?.failUnder,
            }
            : base.coverage,
        search: override.search
            ? {
                enabled: override.search.enabled ?? base.search?.enabled ?? true,
                engine: override.search.engine ?? base.search?.engine ?? "flexsearch",
                indexOutput: override.search.indexOutput ?? base.search?.indexOutput,
                include: override.search.include ?? base.search?.include,
                exclude: override.search.exclude ?? base.search?.exclude,
            }
            : base.search,
        linkDocs: override.linkDocs
            ? {
                enabled: override.linkDocs.enabled ?? base.linkDocs?.enabled ?? true,
                showCoverage: override.linkDocs.showCoverage ?? base.linkDocs?.showCoverage ?? true,
                apiDocsPath: override.linkDocs.apiDocsPath ?? base.linkDocs?.apiDocsPath,
                testCasesPath: override.linkDocs.testCasesPath ?? base.linkDocs?.testCasesPath,
                outputFile: override.linkDocs.outputFile ?? base.linkDocs?.outputFile,
            }
            : base.linkDocs,
        featureMap: override.featureMap
            ? {
                enabled: override.featureMap.enabled ?? base.featureMap?.enabled ?? true,
                include: override.featureMap.include ?? base.featureMap?.include,
                exclude: override.featureMap.exclude ?? base.featureMap?.exclude,
                externalDocs: override.featureMap.externalDocs ?? base.featureMap?.externalDocs,
                storybook: override.featureMap.storybook ?? base.featureMap?.storybook,
            }
            : base.featureMap,
        overview: override.overview
            ? {
                enabled: override.overview.enabled ?? base.overview?.enabled ?? true,
                file: override.overview.file ?? base.overview?.file,
                layers: override.overview.layers ?? base.overview?.layers ?? [],
                features: override.overview.features ?? base.overview?.features ?? [],
                techStack: override.overview.techStack ?? base.overview?.techStack ?? [],
                quickLinks: override.overview.quickLinks ?? base.overview?.quickLinks ?? [],
            }
            : base.overview,
        screenshots: override.screenshots
            ? {
                enabled: override.screenshots.enabled ?? base.screenshots?.enabled ?? true,
                source: override.screenshots.source ?? base.screenshots?.source ?? "feature-map",
                scanPaths: override.screenshots.scanPaths ?? base.screenshots?.scanPaths,
                screens: override.screenshots.screens ?? base.screenshots?.screens,
                baseUrl: override.screenshots.baseUrl ?? base.screenshots?.baseUrl,
                locale: override.screenshots.locale ?? base.screenshots?.locale,
                accounts: override.screenshots.accounts ?? base.screenshots?.accounts,
                defaultAccount: override.screenshots.defaultAccount ?? base.screenshots?.defaultAccount,
                loginPath: override.screenshots.loginPath ?? override.screenshots.auth?.loginPath ?? base.screenshots?.loginPath,
                auth: {
                    email: override.screenshots.auth?.email ?? base.screenshots?.auth?.email,
                    password: override.screenshots.auth?.password ?? base.screenshots?.auth?.password,
                    loginPath: override.screenshots.auth?.loginPath ?? base.screenshots?.auth?.loginPath,
                },
                viewport: {
                    width: override.screenshots.viewport?.width ?? base.screenshots?.viewport?.width,
                    height: override.screenshots.viewport?.height ?? base.screenshots?.viewport?.height,
                },
                outputDir: override.screenshots.outputDir ?? base.screenshots?.outputDir,
                testFile: override.screenshots.testFile ?? base.screenshots?.testFile,
                routeParams: { ...base.screenshots?.routeParams, ...override.screenshots.routeParams },
                screenOverrides: { ...base.screenshots?.screenOverrides, ...override.screenshots.screenOverrides },
                dynamicRoutes: {
                    enabled: override.screenshots.dynamicRoutes?.enabled ?? base.screenshots?.dynamicRoutes?.enabled ?? false,
                    helperModule: override.screenshots.dynamicRoutes?.helperModule ?? base.screenshots?.dynamicRoutes?.helperModule ?? "./tests/helpers/database",
                    paramMethods: { ...base.screenshots?.dynamicRoutes?.paramMethods, ...override.screenshots.dynamicRoutes?.paramMethods },
                    databaseUrl: override.screenshots.dynamicRoutes?.databaseUrl ?? base.screenshots?.dynamicRoutes?.databaseUrl ?? "",
                },
                apps: override.screenshots.apps ?? base.screenshots?.apps,
            }
            : base.screenshots,
        lintCode: override.lintCode
            ? {
                enabled: override.lintCode.enabled ?? base.lintCode?.enabled ?? false,
                strict: override.lintCode.strict ?? base.lintCode?.strict ?? false,
                serverActions: override.lintCode.serverActions ?? base.lintCode?.serverActions,
            }
            : base.lintCode,
        applications: override.applications
            ? {
                shared: override.applications.shared ?? base.applications?.shared,
                apps: override.applications.apps ?? base.applications?.apps,
            }
            : base.applications,
        lintDocs: override.lintDocs
            ? {
                enabled: override.lintDocs.enabled ?? base.lintDocs?.enabled ?? false,
                strict: override.lintDocs.strict ?? base.lintDocs?.strict ?? false,
                required: override.lintDocs.required ?? base.lintDocs?.required ?? [],
                validateLinks: override.lintDocs.validateLinks ?? base.lintDocs?.validateLinks,
                formatting: override.lintDocs.formatting ?? base.lintDocs?.formatting,
            }
            : base.lintDocs,
        lintAnnotations: override.lintAnnotations
            ? {
                enabled: override.lintAnnotations.enabled ?? base.lintAnnotations?.enabled ?? true,
                strict: override.lintAnnotations.strict ?? base.lintAnnotations?.strict ?? false,
                rules: {
                    "usedComponents-match": {
                        ...base.lintAnnotations?.rules?.["usedComponents-match"],
                        ...override.lintAnnotations.rules?.["usedComponents-match"],
                    },
                    "screen-required": {
                        ...base.lintAnnotations?.rules?.["screen-required"],
                        ...override.lintAnnotations.rules?.["screen-required"],
                    },
                    "component-required": {
                        ...base.lintAnnotations?.rules?.["component-required"],
                        ...override.lintAnnotations.rules?.["component-required"],
                    },
                },
                exclude: override.lintAnnotations.exclude ?? base.lintAnnotations?.exclude,
            }
            : base.lintAnnotations,
        plugins: override.plugins
            ? {
                channel: override.plugins.channel ?? base.plugins?.channel,
            }
            : base.plugins,
        hooks: override.hooks
            ? {
                allow: override.hooks.allow ?? base.hooks?.allow,
            }
            : base.hooks,
        skills: override.skills
            ? {
                routing: {
                    designing: {
                        add: { ...base.skills?.routing?.designing?.add, ...override.skills?.routing?.designing?.add },
                        exclude: override.skills?.routing?.designing?.exclude ?? base.skills?.routing?.designing?.exclude,
                    },
                    coding: {
                        add: { ...base.skills?.routing?.coding?.add, ...override.skills?.routing?.coding?.add },
                        exclude: override.skills?.routing?.coding?.exclude ?? base.skills?.routing?.coding?.exclude,
                    },
                    reviewing: {
                        add: { ...base.skills?.routing?.reviewing?.add, ...override.skills?.routing?.reviewing?.add },
                        exclude: override.skills?.routing?.reviewing?.exclude ?? base.skills?.routing?.reviewing?.exclude,
                    },
                },
            }
            : base.skills,
        repoPairs: override.repoPairs ?? base.repoPairs,
        crossRepos: override.crossRepos ?? base.crossRepos,
        docs: override.docs
            ? {
                outputDir: override.docs.outputDir ?? base.docs?.outputDir,
            }
            : base.docs,
        lintWorkflow: override.lintWorkflow
            ? {
                enabled: override.lintWorkflow.enabled ?? base.lintWorkflow?.enabled ?? true,
                strict: override.lintWorkflow.strict ?? base.lintWorkflow?.strict ?? false,
                rules: {
                    "issue-fields": {
                        ...base.lintWorkflow?.rules?.["issue-fields"],
                        ...override.lintWorkflow.rules?.["issue-fields"],
                    },
                    "branch-naming": {
                        ...base.lintWorkflow?.rules?.["branch-naming"],
                        ...override.lintWorkflow.rules?.["branch-naming"],
                    },
                    "main-protection": {
                        ...base.lintWorkflow?.rules?.["main-protection"],
                        ...override.lintWorkflow.rules?.["main-protection"],
                    },
                    "commit-format": {
                        ...base.lintWorkflow?.rules?.["commit-format"],
                        ...override.lintWorkflow.rules?.["commit-format"],
                    },
                    "co-authored-by": {
                        ...base.lintWorkflow?.rules?.["co-authored-by"],
                        ...override.lintWorkflow.rules?.["co-authored-by"],
                    },
                },
            }
            : base.lintWorkflow,
        lintStructure: override.lintStructure
            ? {
                enabled: override.lintStructure.enabled ?? base.lintStructure?.enabled ?? false,
                strict: override.lintStructure.strict ?? base.lintStructure?.strict ?? true,
                excludeApps: override.lintStructure.excludeApps ?? base.lintStructure?.excludeApps,
                rules: override.lintStructure.rules ?? base.lintStructure?.rules,
            }
            : base.lintStructure,
    };
}
/**
 * パスを解決 (プロジェクトルートからの相対パス)
 */
export function resolvePath(projectPath, relativePath) {
    if (relativePath.startsWith("/")) {
        return relativePath;
    }
    return resolve(projectPath, relativePath);
}
/**
 * 出力パスを取得
 */
export function getOutputPath(config, projectPath, type) {
    const outputDir = resolvePath(projectPath, config.output.dir);
    switch (type) {
        case "portal":
            return config.output.portal
                ? resolvePath(projectPath, config.output.portal)
                : resolve(outputDir, "portal");
        case "generated":
            return config.output.generated
                ? resolvePath(projectPath, config.output.generated)
                : resolve(outputDir, "generated");
        case "base":
        default:
            return outputDir;
    }
}
//# sourceMappingURL=config.js.map