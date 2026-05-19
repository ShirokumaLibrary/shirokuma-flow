/**
 * lint-annotations 用型定義
 *
 * コードアノテーションの整合性検証に使用する型
 */
/**
 * アノテーション検証の問題種別
 */
export type AnnotationIssueSeverity = "error" | "warning" | "info";
/**
 * 検出された問題
 */
export interface AnnotationIssue {
    /** 問題種別 */
    type: AnnotationIssueSeverity;
    /** 問題メッセージ */
    message: string;
    /** ファイルパス */
    file: string;
    /** 行番号（オプション） */
    line?: number;
    /** ルールID */
    rule: string;
    /** アノテーション種別 */
    annotation?: string;
    /** 不足している項目 */
    missing?: string[];
    /** 余分な項目 */
    extra?: string[];
}
/**
 * @usedComponents 比較結果
 */
export interface UsedComponentsResult {
    /** 検証が成功したか */
    valid: boolean;
    /** アノテーションに記載されているコンポーネント */
    annotated: string[];
    /** インポートされているコンポーネント */
    imported: string[];
    /** 不足（インポートにあるがアノテーションにない） */
    missing: string[];
    /** 余分（アノテーションにあるがインポートにない） */
    extra: string[];
}
/**
 * アノテーション存在チェック結果
 */
export interface AnnotationCheckResult {
    /** 検証が成功したか */
    valid: boolean;
    /** スキップされたか（除外ファイル等） */
    skipped: boolean;
    /** 検出された問題 */
    errors: AnnotationIssue[];
    /** 警告 */
    warnings: AnnotationIssue[];
    /** 情報 */
    infos: AnnotationIssue[];
}
/**
 * ファイル検証結果
 */
export interface FileAnnotationReport {
    /** ファイルパス */
    file: string;
    /** ファイル種別 (screen, component, action) */
    fileType: "screen" | "component" | "action" | "other";
    /** @usedComponents 検証結果 */
    usedComponents?: UsedComponentsResult;
    /** @screen 検証結果 */
    screenCheck?: AnnotationCheckResult;
    /** @component 検証結果 */
    componentCheck?: AnnotationCheckResult;
    /** 総合結果 */
    result: {
        valid: boolean;
        errors: AnnotationIssue[];
        warnings: AnnotationIssue[];
        infos: AnnotationIssue[];
    };
}
/**
 * lint-annotations レポート
 */
export interface LintAnnotationsReport {
    /** ファイル検証結果 */
    fileResults: FileAnnotationReport[];
    /** サマリー */
    summary: {
        /** チェックしたファイル数 */
        filesChecked: number;
        /** 問題のあるファイル数 */
        filesWithIssues: number;
        /** @usedComponents 不一致数 */
        usedComponentsMismatch: number;
        /** @screen 欠落数 */
        missingScreen: number;
        /** @component 欠落数 */
        missingComponent: number;
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
 * lint-annotations 設定
 */
export interface LintAnnotationsConfig {
    /** 有効か */
    enabled: boolean;
    /** strictモード */
    strict: boolean;
    /** ルール設定 */
    rules: {
        /** @usedComponents 整合性チェック */
        "usedComponents-match"?: {
            severity: AnnotationIssueSeverity;
            checkOrder?: boolean;
            excludeHooks?: boolean;
        };
        /** @screen 必須チェック */
        "screen-required"?: {
            severity: AnnotationIssueSeverity;
            paths?: string[];
            exclude?: string[];
        };
        /** @component 必須チェック */
        "component-required"?: {
            severity: AnnotationIssueSeverity;
            paths?: string[];
            exclude?: string[];
        };
    };
    /** グローバル除外パターン */
    exclude?: string[];
}
/**
 * インポート抽出オプション
 */
export interface ExtractImportsOptions {
    /** フック (useSomething) を除外するか */
    excludeHooks?: boolean;
}
/**
 * アノテーションチェックオプション
 */
export interface AnnotationCheckOptions {
    /** 除外パターン */
    exclude?: string[];
}
/**
 * デフォルト設定
 */
export declare const defaultLintAnnotationsConfig: LintAnnotationsConfig;
//# sourceMappingURL=annotation-types.d.ts.map