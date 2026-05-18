/**
 * test-cases 型定義
 *
 * テストケース一覧生成に使用する全てのインターフェースと型
 */

/**
 * コマンドオプション
 */
export interface TestCasesOptions {
  project: string;
  config: string;
  output?: string;
  verbose?: boolean;
}

/**
 * BDD アノテーション
 */
export interface BddAnnotation {
  /** 前提条件 (@given) */
  given?: string;
  /** 操作/イベント (@when) */
  when?: string;
  /** 期待結果 (@then) */
  then?: string;
  /** 追加条件 (@and) - 複数可 */
  and?: string[];
}

/**
 * テストカテゴリ
 */
export type TestCategory = "happy-path" | "auth" | "error-handling" | "validation" | "edge-case" | "integration" | "other";

/**
 * テストドキュメントコメント情報
 */
export interface TestDocComment {
  /** 日本語説明 (@testdoc) */
  testdoc?: string;
  /** テスト目的 (@testPurpose) */
  purpose?: string;
  /** 前提条件 (@precondition) */
  precondition?: string;
  /** 期待結果 (@testExpect) */
  expected?: string;
  /** テストカテゴリ (@testCategory) */
  category?: TestCategory;
  /** BDD アノテーション */
  bdd?: BddAnnotation;
  /** 関連アプリケーション (@app) - admin, public など */
  app?: string;
  /** スキップ理由 (@skip-reason) */
  skipReason?: string;
}

/**
 * ファイルレベルのドキュメント情報
 */
export interface FileDocComment {
  /** ファイル説明 (@testFileDoc) */
  description?: string;
  /** 関連モジュール名 (@module) */
  module?: string;
  /** カバレッジ範囲 (@coverage) */
  coverage?: string;
  /** 関連アプリケーション (@app) - admin, public など */
  app?: string;
}

/**
 * describe ブロックのドキュメント情報
 */
export interface DescribeDoc {
  /** describe 名 (ネストパス) */
  name: string;
  /** 日本語説明 (@testGroupDoc) */
  testdoc?: string;
  /** テスト目的 (@purpose) */
  purpose?: string;
  /** 優先度 (@priority) */
  priority?: "high" | "medium" | "low";
}

/**
 * テストケース情報
 */
export interface TestCase {
  /** ファイルパス (相対) */
  file: string;
  /** describe ブロック名 (ネスト対応) */
  describe: string;
  /** it/test の名前 (英語) */
  it: string;
  /** 行番号 */
  line: number;
  /** テストフレームワーク */
  framework: "jest" | "playwright";
  // === 拡張フィールド ===
  /** 日本語説明 (@testdoc) */
  description?: string;
  /** テスト目的 (@testPurpose) */
  purpose?: string;
  /** 前提条件 (@precondition) */
  precondition?: string;
  /** 期待結果 (@testExpect) */
  expected?: string;
  /** テストカテゴリ (@testCategory) */
  category?: TestCategory;
  /** BDD アノテーション (@given/@when/@then/@and) */
  bdd?: BddAnnotation;
  /** describe ブロックのドキュメント情報 */
  describeDocs?: DescribeDoc[];
  /** 対応するソースファイル (link-docs で使用) */
  sourceFile?: string;
  /** 関連アプリケーション (@app) - admin, public など */
  app?: string;
  /** スキップされているか (it.skip / test.skip) */
  skipped?: boolean;
  /** スキップ理由 (@skip-reason) */
  skipReason?: string;
}

/**
 * モジュール情報
 */
export interface ModuleInfo {
  /** モジュールタイプ (action, component, screen) */
  type: "action" | "component" | "screen" | "unknown";
  /** モジュール名 */
  name: string;
  /** 詳細ページへのパス */
  detailPath: string;
}

/**
 * ファイル統計情報
 */
export interface FileStats {
  file: string;
  framework: "jest" | "playwright";
  describes: number;
  tests: number;
  /** 関連モジュール情報 */
  module?: ModuleInfo;
  /** ファイルレベルのドキュメント */
  fileDoc?: FileDocComment;
  /** カテゴリ別テスト数 */
  categoryStats?: Record<TestCategory, number>;
}

/**
 * 統計サマリー
 */
export interface TestSummary {
  totalFiles: number;
  totalTests: number;
  jestFiles: number;
  jestTests: number;
  playwrightFiles: number;
  playwrightTests: number;
  fileStats: FileStats[];
}
