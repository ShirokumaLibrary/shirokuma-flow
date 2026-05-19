/**
 * lint-code 用型定義
 *
 * TypeScript コード（Server Actions等）の検証に使用する型
 */
/**
 * コード検証の問題種別
 */
export type CodeIssueSeverity = "error" | "warning" | "info";
/**
 * 検出された問題
 */
export interface CodeIssue {
    /** 問題種別 */
    type: CodeIssueSeverity;
    /** 問題メッセージ */
    message: string;
    /** ファイルパス */
    file: string;
    /** 行番号（オプション） */
    line?: number;
    /** ルールID */
    rule: string;
    /** 関数名（オプション） */
    functionName?: string;
}
/**
 * 検証結果
 */
export interface CodeValidationResult {
    /** 検証が成功したか */
    valid: boolean;
    /** エラー一覧 */
    errors: CodeIssue[];
    /** 警告一覧 */
    warnings: CodeIssue[];
    /** 情報一覧 */
    infos: CodeIssue[];
}
/**
 * ファイル検証結果
 */
export interface FileCodeValidationReport {
    /** ファイルパス */
    file: string;
    /** ファイルの説明 */
    description: string;
    /** モジュールヘッダーの検証結果 */
    moduleHeader: {
        /** ヘッダーが存在するか */
        exists: boolean;
        /** 検出されたタグ */
        tags: string[];
        /** 不足しているタグ */
        missingTags: string[];
    };
    /** 関数の検証結果 */
    functions: FunctionValidationResult[];
    /** 検証結果 */
    result: CodeValidationResult;
}
/**
 * 関数検証結果
 */
export interface FunctionValidationResult {
    /** 関数名 */
    name: string;
    /** 行番号 */
    line: number;
    /** JSDoc が存在するか */
    hasJSDoc: boolean;
    /** 検出されたタグ */
    tags: string[];
    /** 不足しているタグ */
    missingTags: string[];
    /** 問題一覧 */
    issues: CodeIssue[];
}
/**
 * Server Actions lint 設定
 */
export interface ServerActionsLintConfig {
    /** ファイルパターン (glob) */
    filePattern: string;
    /** 除外パターン (glob) */
    excludePattern?: string;
    /** 除外ファイル名リスト */
    excludeFiles?: string[];
    /** モジュールヘッダー必須タグ */
    requiredFileHeader: string[];
    /** 関数必須タグ */
    requiredFunctionTags: string[];
    /** セクション区切りコメントを必須とするか */
    sectionSeparators?: boolean;
}
/**
 * lint-code 設定
 */
export interface LintCodeConfig {
    /** 有効か */
    enabled: boolean;
    /** strictモード */
    strict: boolean;
    /** Server Actions 設定 */
    serverActions?: ServerActionsLintConfig;
}
/**
 * lint-code レポート
 */
export interface LintCodeReport {
    /** ファイル検証結果 */
    fileResults: FileCodeValidationReport[];
    /** サマリー */
    summary: {
        /** 総ファイル数 */
        totalFiles: number;
        /** 検証済みファイル数 */
        validatedFiles: number;
        /** 総関数数 */
        totalFunctions: number;
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
 * 結果をマージ
 */
export declare function mergeCodeResults(...results: CodeValidationResult[]): CodeValidationResult;
//# sourceMappingURL=code-types.d.ts.map