/**
 * lint-docs 用型定義
 *
 * 手動ドキュメントの検証に使用する型
 */

/**
 * ドキュメント検証の問題種別
 */
export type DocIssueSeverity = "error" | "warning" | "info";

/**
 * 検出された問題
 */
export interface DocIssue {
  /** 問題種別 */
  type: DocIssueSeverity;
  /** 問題メッセージ */
  message: string;
  /** ファイルパス */
  file: string;
  /** 行番号（オプション） */
  line?: number;
  /** ルールID */
  rule?: string;
}

/**
 * 検証結果
 */
export interface DocValidationResult {
  /** 検証が成功したか */
  valid: boolean;
  /** エラー一覧 */
  errors: DocIssue[];
  /** 警告一覧 */
  warnings: DocIssue[];
  /** 情報一覧 */
  infos: DocIssue[];
}

/**
 * セクション検証ルール
 */
export interface SectionRule {
  /** 正規表現パターン */
  pattern: string;
  /** セクション説明 */
  description: string;
  /** 必須かどうか */
  required: boolean;
}

/**
 * フロントマターフィールドルール
 */
export interface FrontmatterFieldRule {
  /** フィールド名 */
  name: string;
  /** 許容値リスト（オプション） */
  values?: string[];
  /** 日付フォーマット（オプション） */
  format?: string;
}

/**
 * フロントマター検証ルール
 */
export interface FrontmatterRule {
  /** フロントマターが必須か */
  required: boolean;
  /** フィールドルール */
  fields: FrontmatterFieldRule[];
}

/**
 * ドキュメント長さルール
 */
export interface LengthRule {
  /** 最小行数 */
  minLength?: number;
  /** 最大行数 */
  maxLength?: number;
}

/**
 * ファイルパターン検証ルール
 */
export interface FilePatternRule {
  /** ファイルパターン（正規表現） */
  pattern: string;
  /** 最小ファイル数 */
  minCount?: number;
  /** 最大ファイル数 */
  maxCount?: number;
}

/**
 * 単一ファイル検証設定
 */
export interface FileValidationConfig {
  /** ファイルパス */
  file: string;
  /** ファイルの説明 */
  description: string;
  /** セクションルール */
  sections?: SectionRule[];
  /** 最小行数 */
  minLength?: number;
  /** 最大行数 */
  maxLength?: number;
  /** フロントマタールール */
  frontmatter?: FrontmatterRule;
}

/**
 * ファイルパターン検証設定
 */
export interface FilePatternValidationConfig {
  /** ファイルパターン（glob） */
  filePattern: string;
  /** ファイルの説明 */
  description: string;
  /** 最小ファイル数 */
  minCount?: number;
  /** セクションルール */
  sections?: SectionRule[];
  /** フロントマタールール */
  frontmatter?: FrontmatterRule;
}

/**
 * リンク検証設定
 */
export interface LinkValidationConfig {
  /** 有効か */
  enabled: boolean;
  /** 内部リンクをチェックするか */
  checkInternal: boolean;
  /** 外部リンクをチェックするか */
  checkExternal: boolean;
}

/**
 * フォーマット検証設定
 */
export interface FormattingConfig {
  /** 最大行長 */
  maxLineLength?: number;
  /** 見出し前に空行が必要か */
  requireBlankLineBeforeHeading?: boolean;
}

/**
 * lint-docs 設定
 */
export interface LintDocsConfig {
  /** 有効か */
  enabled: boolean;
  /** strictモード */
  strict: boolean;
  /** 必須ドキュメント設定 */
  required: Array<FileValidationConfig | FilePatternValidationConfig>;
  /** リンク検証設定 */
  validateLinks?: LinkValidationConfig;
  /** フォーマット検証設定 */
  formatting?: FormattingConfig;
}

/**
 * ファイル検証結果
 */
export interface FileValidationReport {
  /** ファイルパス */
  file: string;
  /** ファイルの説明 */
  description: string;
  /** 検証結果 */
  result: DocValidationResult;
}

/**
 * パターン検証結果
 */
export interface PatternValidationReport {
  /** パターン */
  pattern: string;
  /** パターンの説明 */
  description: string;
  /** マッチしたファイル */
  matchedFiles: string[];
  /** ファイル別検証結果 */
  fileResults: FileValidationReport[];
  /** 全体の検証結果 */
  result: DocValidationResult;
}

/**
 * lint-docs レポート
 */
export interface LintDocsReport {
  /** ファイル検証結果 */
  fileResults: FileValidationReport[];
  /** パターン検証結果 */
  patternResults: PatternValidationReport[];
  /** サマリー */
  summary: {
    /** 総ファイル数 */
    totalFiles: number;
    /** 検証済みファイル数 */
    validatedFiles: number;
    /** エラー数 */
    errorCount: number;
    /** 警告数 */
    warningCount: number;
    /** 情報数 */
    infoCount: number;
  };
  /** 合格したか */
  passed: boolean;
}

/**
 * FileValidationConfig かどうかを判定
 */
export function isFileConfig(
  config: FileValidationConfig | FilePatternValidationConfig
): config is FileValidationConfig {
  return "file" in config;
}

/**
 * FilePatternValidationConfig かどうかを判定
 */
export function isPatternConfig(
  config: FileValidationConfig | FilePatternValidationConfig
): config is FilePatternValidationConfig {
  return "filePattern" in config;
}
