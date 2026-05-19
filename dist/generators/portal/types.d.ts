/**
 * ポータルジェネレーター型定義
 *
 * portal/lib/types.ts の Node.js 移植版。
 * React / Next.js 依存を除去した純粋な型定義。
 */
export type AppName = "Admin" | "Public" | "Web" | "API" | "Shared" | "Unknown";
export interface TestCase {
    id?: string;
    file: string;
    describe: string;
    it: string;
    description?: string;
    purpose?: string;
    expected?: string;
    line: number;
    framework: "jest" | "playwright";
    tags?: string[];
    docs?: TestDocComment;
    describeDocs?: DescribeDoc[];
    bdd?: BddAnnotation;
    category?: TestCategory;
    /** 関連アプリケーション (@app) */
    app?: string;
}
export interface TestDocComment {
    testdoc?: string;
    purpose?: string;
    precondition?: string;
    expected?: string;
    testCategory?: string;
}
export interface DescribeDoc {
    name: string;
    testdoc?: string;
    testGroupDoc?: string;
    purpose?: string;
}
export interface BddAnnotation {
    given?: string;
    when?: string;
    then?: string;
    and?: string[];
}
export type TestCategory = "success" | "auth" | "error" | "validation" | "edge" | "integration" | "unknown";
export interface TestCasesData {
    testCases: TestCase[];
    summary: {
        totalFiles: number;
        totalTests: number;
        jestFiles: number;
        jestTests: number;
        playwrightFiles: number;
        playwrightTests: number;
        fileStats?: Array<{
            file: string;
            framework: string;
            describes: number;
            tests: number;
            module?: {
                type: string;
                name: string;
                detailPath: string;
            };
            categoryStats?: Record<string, number>;
        }>;
    };
    generatedAt: string;
}
export interface FeatureMapData {
    features: Record<string, FeatureGroup>;
    uncategorized: FeatureGroup;
    moduleDescriptions: Record<string, string>;
    moduleTypes: Record<string, TypeItem[]>;
    moduleUtilities: Record<string, UtilityItem[]>;
    apps?: AppName[];
    generatedAt: string;
}
export interface FeatureGroup {
    screens: ScreenItem[];
    components: ComponentItem[];
    actions: ActionItem[];
    modules: ModuleItem[];
    tables: TableItem[];
}
export interface ModuleItem {
    name: string;
    path: string;
    description?: string;
    descriptionEn?: string;
    usedInScreens?: string[];
    usedInComponents?: string[];
    usedInActions?: string[];
    app?: AppName;
    category?: string;
}
export interface ScreenItem {
    name: string;
    path: string;
    route?: string;
    description?: string;
    descriptionEn?: string;
    components?: string[];
    actions?: string[];
    app?: AppName;
}
export interface ComponentItem {
    name: string;
    path: string;
    description?: string;
    descriptionEn?: string;
    props?: PropInfo[];
    app?: AppName;
}
export interface ActionItem {
    name: string;
    path: string;
    description?: string;
    descriptionEn?: string;
    params?: ParamInfo[];
    returns?: string;
    dbTables?: string[];
    app?: AppName;
}
export interface TableItem {
    name: string;
    schema?: string;
    description?: string;
    columns?: ColumnInfo[];
    app?: AppName;
}
export interface PropInfo {
    name: string;
    type: string;
    required: boolean;
    description?: string;
}
export interface ParamInfo {
    name: string;
    type: string;
    description?: string;
}
export interface ColumnInfo {
    name: string;
    type: string;
    nullable: boolean;
    primaryKey?: boolean;
    references?: string;
}
export interface TypeItem {
    name: string;
    kind: "type" | "interface" | "enum";
    description?: string;
}
export interface UtilityItem {
    name: string;
    description?: string;
}
export interface DbSchemaData {
    /** データベース情報（複数 DB 対応） */
    databases?: DatabaseInfo[];
    tables: DbTable[];
    generatedAt?: string;
}
export interface DatabaseInfo {
    name: string;
    description?: string;
    tableCount: number;
}
export interface DbTable {
    name: string;
    file?: string;
    schema?: string;
    description?: string;
    category?: string;
    columnCount?: number;
    columns?: DbColumn[];
    indexes?: DbIndex[];
    foreignKeys?: DbForeignKey[];
    /** データベース名（複数 DB 対応） */
    database?: string;
}
export interface DbColumn {
    name: string;
    type: string;
    nullable: boolean;
    default?: string;
    primaryKey?: boolean;
    unique?: boolean;
    description?: string;
}
export interface DbIndex {
    name: string;
    columns: string[];
    unique: boolean;
    description?: string;
}
export interface DbForeignKey {
    column: string;
    references: {
        table: string;
        column: string;
    };
}
export interface DetailsData {
    details: Record<string, DetailItem>;
    generatedAt: string;
}
export interface DetailItem {
    name: string;
    type: "screen" | "component" | "action" | "module" | "table";
    moduleName: string;
    description: string;
    filePath: string;
    sourceCode: string;
    app?: AppName;
    jsDoc: {
        description: string;
        params: DetailParamInfo[];
        returns?: string;
        throws?: string[];
        examples: string[];
        tags: {
            name: string;
            value: string;
        }[];
    };
    related: {
        usedInScreens?: string[];
        usedInComponents?: string[];
        usedInActions?: string[];
        dbTables?: string[];
    };
    testCoverage: {
        hasTest: boolean;
        totalTests: number;
        coverageScore: number;
        byCategory: Record<string, DetailTestCase[]>;
        recommendations: string[];
    };
    inputSchema?: InputSchemaInfo;
    outputSchema?: OutputSchemaInfo;
    errorCodes?: ErrorCodeInfo[];
    authLevel?: AuthLevel;
    rateLimit?: string;
    csrfProtection?: boolean;
}
export type AuthLevel = "none" | "authenticated" | "member" | "admin";
export interface InputSchemaInfo {
    name: string;
    parameters: ZodParameterInfo[];
}
export interface ZodParameterInfo {
    name: string;
    type: string;
    format?: string;
    required: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    default?: unknown;
    description?: string;
    enumValues?: string[];
    validation?: {
        message?: string;
    };
}
export interface OutputSchemaInfo {
    type: string;
    successType?: string;
    errorType?: string;
}
export interface ErrorCodeInfo {
    code: string;
    description: string;
    status?: number;
}
export interface DetailParamInfo {
    name: string;
    type?: string;
    description: string;
}
export interface DetailTestCase {
    name: string;
    file: string;
    line: number;
    summary: string;
    purpose?: string;
    expected?: string;
    bdd?: BddAnnotation;
}
export type AppType = "web" | "api" | "cli" | "library";
export type ApiProtocol = "mcp" | "rest" | "graphql" | "grpc";
export type SectionType = "overview" | "featureMap" | "dbSchema" | "testCases" | "i18n" | "tools" | "endpoints" | "commands" | "modules";
export interface ApplicationsData {
    shared: SharedSections;
    apps: AppConfig[];
}
export interface SharedSections {
    sections: AppSectionConfig[];
}
export interface AppConfigBase {
    id: string;
    name: string;
    description?: string;
    icon: string;
    color: string;
    type?: AppType;
    source?: string;
    stats?: AppStats;
    sections: AppSectionConfig[];
    dbTables?: string[];
    tests?: {
        match: string[];
    };
}
export interface ApiAppConfig extends AppConfigBase {
    type: "api";
    protocol: ApiProtocol;
    toolsFile?: string;
}
export type AppConfig = AppConfigBase | ApiAppConfig;
export interface AppSectionConfig {
    type: SectionType;
    label: string;
    icon?: string;
    available?: boolean;
    count?: number;
    filter?: {
        paths?: string[];
    };
}
export interface AppStats {
    screens?: number;
    components?: number;
    actions?: number;
    tables?: number;
    tools?: number;
    endpoints?: number;
    commands?: number;
    modules?: number;
    tests?: number;
}
export interface ApiToolsData {
    name?: string;
    description?: string;
    protocol?: ApiProtocol;
    tools: ApiTool[];
    categories: ApiToolCategory[];
    summary: {
        totalTools: number;
        totalCategories: number;
    };
    generatedAt: string;
}
export interface ApiTool {
    name: string;
    description: string;
    category?: string;
    feature?: string;
    dbTables?: string[];
    authLevel?: AuthLevel;
    inputSchema?: {
        type: string;
        properties?: Record<string, ApiToolParam>;
        required?: string[];
    };
    relatedTests?: string;
}
export interface ApiToolParam {
    type: string;
    description?: string;
    enum?: string[];
}
export interface ApiToolCategory {
    name: string;
    description?: string;
    tools: string[];
}
export interface I18nApp {
    id: string;
    name: string;
    icon: string;
    color: string;
    namespaceCount: number;
    keyCount: number;
}
export interface I18nEntry {
    key: string;
    values: Record<string, string | undefined>;
}
export interface I18nNamespace {
    name: string;
    app?: string;
    description?: string;
    entries: I18nEntry[];
    stats: {
        totalKeys: number;
        keysByLocale: Record<string, number>;
        fullyTranslatedKeys: number;
        missingKeys: number;
    };
}
export interface I18nData {
    locales: string[];
    primaryLocale: string;
    apps: I18nApp[];
    namespaces: I18nNamespace[];
    stats: {
        totalNamespaces: number;
        totalKeys: number;
        coveragePercent: number;
    };
    generatedAt: string;
}
export interface PackageModuleInfo {
    name: string;
    path: string;
    description?: string;
    exports: PackageExportItem[];
    dependencies: string[];
}
export interface PackageExportItem {
    name: string;
    kind: "function" | "type" | "interface" | "const" | "class" | "enum";
    description?: string;
    signature?: string;
}
export interface PackageInfo {
    name: string;
    path: string;
    prefix: string;
    description?: string;
    icon?: string;
    color?: string;
    modules: PackageModuleInfo[];
    stats: {
        moduleCount: number;
        exportCount: number;
        typeCount: number;
        functionCount: number;
    };
}
export interface PackagesData {
    packages: PackageInfo[];
    summary: {
        totalPackages: number;
        totalModules: number;
        totalExports: number;
    };
    generatedAt: string;
}
export interface CoverageData {
    results: Array<{
        source: string;
        test?: string;
        testCount: number;
        status: "covered" | "skipped" | "missing";
        skipReason?: string;
    }>;
    orphans: Array<{
        test: string;
        expectedSource: string;
    }>;
    summary: {
        totalSources: number;
        coveredCount: number;
        skippedCount: number;
        missingCount: number;
        orphanCount: number;
        coveragePercent: number;
    };
    passed: boolean;
}
export interface GithubIssue {
    number: number;
    title: string;
    url: string;
    state: string;
    labels: string[];
    status: string | null;
    priority: string | null;
    type: string | null;
    size: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface GithubDiscussion {
    number: number;
    title: string;
    url: string;
    category: string;
    author: string;
    createdAt: string;
    updatedAt: string;
    body?: string;
}
export interface GithubRepoInfo {
    owner: string;
    name: string;
    fullName: string;
    description: string | null;
    url: string;
    defaultBranch: string;
    visibility: string;
    stargazers: number;
    forks: number;
    issues: number;
    pullRequests: number;
}
export interface GithubData {
    repository: GithubRepoInfo;
    issues: {
        inProgress: GithubIssue[];
        ready: GithubIssue[];
        backlog: GithubIssue[];
        icebox: GithubIssue[];
        done: GithubIssue[];
        total: number;
    };
    handovers: GithubDiscussion[];
    specs: GithubDiscussion[];
    fetchedAt: string;
}
export interface SearchItem {
    id: string;
    title: string;
    description: string;
    category: "screen" | "component" | "action" | "table" | "test" | "db";
    module?: string;
    path: string;
    keywords: string[];
}
export interface SearchIndex {
    items: SearchItem[];
    generatedAt: string;
}
/**
 * PortalData: ポータルジェネレーターが保持する全データ
 */
export interface PortalData {
    projectName: string;
    featureMap: FeatureMapData | null;
    testCases: TestCasesData | null;
    dbSchema: DbSchemaData | null;
    details: DetailsData | null;
    applications: ApplicationsData | null;
    i18n: I18nData | null;
    packages: PackagesData | null;
    apiTools: ApiToolsData | null;
    coverage: CoverageData | null;
    overview: {
        content: string;
    } | null;
    githubData: GithubData | null;
    available: {
        hasFeatureMap: boolean;
        hasTestCases: boolean;
        hasDbSchema: boolean;
        hasDetails: boolean;
        hasApplications: boolean;
        hasI18n: boolean;
        hasPackages: boolean;
        hasApiTools: boolean;
        hasOverview: boolean;
        hasGithubData: boolean;
    };
}
//# sourceMappingURL=types.d.ts.map