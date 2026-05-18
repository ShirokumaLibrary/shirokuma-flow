/**
 * details 型定義
 *
 * 詳細ページ生成に使用する全てのインターフェースと型
 */

import { type ActionType } from "../utils/action-inference.js";
import { type AppName } from "../utils/app-inference.js";

// ===== コマンドオプション =====

export interface DetailsOptions {
  project: string;
  config: string;
  output?: string;
  verbose?: boolean;
}

// ===== Feature Map 要素 =====

export interface Screen {
  name: string;
  path: string;
  route: string;
  description: string;
  usedComponents?: string[];
  usedActions?: string[];
  testCoverage?: TestCoverageInfo;
}

export interface Component {
  name: string;
  path: string;
  description: string;
  usedInScreens?: string[];
  usedInComponents?: string[];
  usedActions?: string[];
  testCoverage?: TestCoverageInfo;
}

export interface Action {
  name: string;
  path: string;
  description: string;
  usedInScreens?: string[];
  usedInComponents?: string[];
  dbTables?: string[];
  testCoverage?: TestCoverageInfo;
  actionType?: ActionType;
}

export interface Table {
  name: string;
  path: string;
  description: string;
  usedInActions?: string[];
}

export interface Module {
  name: string;
  path: string;
  description?: string;
  usedInScreens?: string[];
  usedInComponents?: string[];
  usedInActions?: string[];
  usedInMiddleware?: string[];
  usedInLayouts?: string[];
  usedModules?: string[];
  usedInModules?: string[];
  category?: string;
}

export interface TestCoverageInfo {
  hasTest: boolean;
  testCount: number;
  status: "covered" | "partial" | "none";
}

export interface Feature {
  screens: Screen[];
  components: Component[];
  actions: Action[];
  modules: Module[];
  tables: Table[];
}

// ===== Feature Map JSON =====

/**
 * 型定義アイテム（feature-map.ts と同期）
 */
export interface TypeItem {
  name: string;
  kind: "interface" | "type" | "enum";
  description?: string;
  fields?: { name: string; type: string; description?: string }[];
  values?: string[];
  sourceCode?: string;
}

/**
 * ユーティリティアイテム（feature-map.ts と同期）
 */
export interface UtilityItem {
  name: string;
  kind: "constant" | "function";
  description?: string;
  type?: string;
  value?: string;
  params?: { name: string; type: string }[];
}

export interface FeatureMap {
  features: Record<string, Feature>;
  uncategorized?: Feature;
  moduleDescriptions?: Record<string, string>;
  moduleTypes?: Record<string, TypeItem[]>;
  moduleUtilities?: Record<string, UtilityItem[]>;
  generatedAt: string;
}

// ===== テストケース =====

export interface BddAnnotation {
  given?: string;
  when?: string;
  then?: string;
  and?: string[];
}

export interface DescribeDoc {
  name: string;
  testdoc?: string;
  purpose?: string;
}

export interface ShirokumaTestCase {
  file: string;
  describe: string;
  it: string;
  line: number;
  framework: "jest" | "playwright";
  description?: string;
  purpose?: string;
  precondition?: string;
  expected?: string;
  bdd?: BddAnnotation;
  describeDocs?: DescribeDoc[];
}

export interface TestCasesJson {
  testCases: ShirokumaTestCase[];
  summary: {
    totalFiles: number;
    totalTests: number;
  };
  generatedAt: string;
}

// ===== テスト分類 =====

export type TestCategory =
  | "happy-path"
  | "error-handling"
  | "auth"
  | "validation"
  | "edge-case"
  | "integration"
  | "other";

export interface CategorizedTestCase extends ShirokumaTestCase {
  category: TestCategory;
  summary: string;
}

export interface TestCoverageAnalysis {
  totalTests: number;
  byCategory: Record<TestCategory, CategorizedTestCase[]>;
  missingPatterns: string[];
  coverageScore: number;
  recommendations: string[];
}

// ===== JSON出力用型定義 =====

/**
 * Zodスキーマパラメータ情報
 */
export interface ZodParameter {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  format?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  default?: string | number | boolean;
  enum?: string[];
  validation?: {
    message: string;
  };
}

/**
 * 詳細ページJSON出力用の型
 * Next.jsポータルで使用
 */
export interface DetailJsonItem {
  name: string;
  type: "screen" | "component" | "action" | "module" | "table";
  moduleName: string;
  description: string;
  filePath: string;
  sourceCode: string;
  app?: AppName;
  jsDoc: {
    description: string;
    params: { name: string; type?: string; description: string }[];
    returns?: string;
    throws?: string[];
    examples: string[];
    tags: { name: string; value: string }[];
  };
  related: {
    usedInScreens?: string[];
    usedInComponents?: string[];
    usedInActions?: string[];
    usedInMiddleware?: string[];
    usedInLayouts?: string[];
    usedModules?: string[];
    usedInModules?: string[];
    dbTables?: string[];
  };
  testCoverage: {
    hasTest: boolean;
    totalTests: number;
    coverageScore: number;
    byCategory: Record<string, DetailTestCase[]>;
    recommendations: string[];
  };
  inputSchema?: {
    name: string;
    parameters: ZodParameter[];
  };
  outputSchema?: {
    type: string;
    successType?: string;
    errorType?: string;
  };
  errorCodes?: {
    code: string;
    description: string;
    status?: number;
  }[];
  authLevel?: "none" | "authenticated" | "member" | "admin";
  rateLimit?: string;
  csrfProtection?: boolean;
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

export interface DetailsJson {
  details: Record<string, DetailJsonItem>;
  generatedAt: string;
}

// ===== JSDoc パース結果 =====

export interface ParsedJSDoc {
  description: string;
  params: { name: string; type?: string; description: string }[];
  returns?: string;
  throws?: string[];
  examples: string[];
  tags: { name: string; value: string }[];
}

// ===== HTML生成データ =====

export interface DetailHTMLData {
  type: "screen" | "component" | "action" | "module" | "table";
  name: string;
  moduleName: string;
  description: string;
  filePath: string;
  route?: string;
  code: string;
  jsDoc: string;
  testCases: CategorizedTestCase[];
  testAnalysis: TestCoverageAnalysis;
  related: { type: string; items: string[]; linkType: string; sourcePath?: string }[];
  projectName: string;
  /** アクション種別 (action用) */
  actionType?: ActionType;
}

// ===== モジュールページ =====

export interface ModulePageData {
  type: "screen" | "component" | "action" | "module" | "table";
  moduleName: string;
  moduleDescription?: string;
  items: (Screen | Component | Action | Table)[];
  types?: TypeItem[];
  utilities?: UtilityItem[];
  testCases?: CategorizedTestCase[];
  projectName: string;
}

// ===== DetailsContext（グローバル状態の置き換え） =====

/**
 * 詳細ページ生成の共有コンテキスト
 *
 * 以前のグローバル変数（allTestCases, detailsJsonItems, existingElements）を
 * パラメータとして渡すためのオブジェクト
 */
export interface DetailsContext {
  /** テストケース一覧 (test-cases.json から読み込み) */
  allTestCases: ShirokumaTestCase[];
  /** JSON出力用の詳細データ */
  detailsJsonItems: Record<string, DetailJsonItem>;
  /** 存在する要素のマップ（リンク生成時に使用） */
  existingElements: {
    screens: Map<string, string>;      // fullKey -> module
    components: Map<string, string>;   // fullKey -> module
    actions: Map<string, string>;      // fullKey -> module
    modules: Map<string, string>;      // fullKey -> module
    tables: Map<string, string>;       // fullKey -> module
  };
}
