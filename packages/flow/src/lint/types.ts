/**
 * Lint Types - テストドキュメントのlint用型定義
 */

/**
 * 問題の重大度
 */
export type Severity = "error" | "warning" | "info";

/**
 * BDD アノテーション
 *
 * Given-When-Then 形式のテスト記述をサポート
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
 * 重大度の順序 (小さいほど重大)
 */
export const severityOrder: Record<Severity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

/**
 * 日本語を含むかどうか判定
 *
 * ひらがな、カタカナ、漢字を検出
 */
export function containsJapanese(text: string): boolean {
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
  return japaneseRegex.test(text);
}

/**
 * Lintで検出された問題
 */
export interface LintIssue {
  /** ルールID */
  rule: string;
  /** 重大度 */
  severity: Severity;
  /** 問題メッセージ */
  message: string;
  /** ファイルパス */
  file: string;
  /** 行番号 */
  line: number;
  /** テスト名 */
  testName: string;
}

/**
 * ファイル単位のlint結果
 */
export interface LintResult {
  /** ファイルパス */
  file: string;
  /** テストフレームワーク */
  framework: "jest" | "playwright";
  /** 総テスト数 */
  totalTests: number;
  /** @testdocがあるテスト数 */
  testsWithTestdoc: number;
  /** 検出された問題 */
  issues: LintIssue[];
}

/**
 * Lintレポート全体
 */
export interface LintReport {
  /** ファイル別結果 */
  results: LintResult[];
  /** サマリー */
  summary: {
    /** 総ファイル数 */
    totalFiles: number;
    /** 総テスト数 */
    totalTests: number;
    /** @testdocがあるテスト数 */
    testsWithTestdoc: number;
    /** カバレッジ率 (%) */
    coverage: number;
    /** エラー数 */
    errorCount: number;
    /** 警告数 */
    warningCount: number;
    /** 情報数 */
    infoCount: number;
  };
  /** 合格したかどうか */
  passed: boolean;
}

/**
 * Lint用のテストケース情報
 */
export interface TestCaseForLint {
  /** ファイルパス (相対) */
  file: string;
  /** describe ブロック名 (ネスト対応) */
  describe: string;
  /** it/test の名前 */
  it: string;
  /** 行番号 */
  line: number;
  /** テストフレームワーク */
  framework: "jest" | "playwright";
  /** @testdoc の内容 */
  description?: string;
  /** @purpose の内容 */
  purpose?: string;
  /** @precondition の内容 */
  precondition?: string;
  /** @expected の内容 */
  expected?: string;
  /** BDD アノテーション (@given/@when/@then/@and) */
  bdd?: BddAnnotation;
  /** スキップされているか (it.skip / test.skip) */
  skipped?: boolean;
  /** スキップ理由 (@skip-reason) */
  skipReason?: string;
}

/**
 * Lintルールのインターフェース
 */
export interface LintRule {
  /** ルールID */
  id: string;
  /** デフォルトの重大度 */
  severity: Severity;
  /** ルールの説明 */
  description: string;
  /**
   * テストケースをチェックする
   *
   * @param testCase チェック対象のテストケース
   * @param allTestCases 全テストケース（重複検出などに使用）
   * @returns 検出された問題の配列
   */
  check(testCase: TestCaseForLint, allTestCases: TestCaseForLint[]): LintIssue[];
}

/**
 * Lintオプション
 */
export interface LintOptions {
  /** strictモード（warningもエラーとして扱う） */
  strict: boolean;
  /** カバレッジ閾値 (%) */
  coverageThreshold: number;
  /** 有効にするルール */
  enabledRules: string[];
}

/**
 * 出力フォーマット
 */
export type OutputFormat = "terminal" | "json" | "summary";
