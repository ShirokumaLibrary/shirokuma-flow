/**
 * reference-analyzer.ts - ts-morph を使った自動参照解析
 *
 * コードベースを解析し、以下の使用関係を自動検出する：
 * - Screen → Component: import + JSX使用
 * - Screen → Action: import + 関数呼び出し
 * - Component → Action: import + 関数呼び出し
 * - Module → (逆参照): 上記から逆引き
 */
/**
 * ファイルの使用情報
 */
export interface FileUsage {
    /** ファイルパス（相対） */
    filePath: string;
    /** 使用しているコンポーネント */
    usedComponents: string[];
    /** 使用しているアクション */
    usedActions: string[];
    /** 使用しているモジュール (lib/ 内) - ファイルパスで管理 */
    usedModules: string[];
    /** 使用しているモジュールのファイルパス (lib/ 内) */
    usedModulePaths: string[];
}
/**
 * 逆参照マップ
 */
export interface ReverseReferenceMap {
    /** コンポーネント名 → 使用しているファイルパス[] */
    componentToFiles: Map<string, string[]>;
    /** アクション名 → 使用しているファイルパス[] */
    actionToFiles: Map<string, string[]>;
    /** モジュール名 → 使用しているファイルパス[] */
    moduleToFiles: Map<string, string[]>;
    /** モジュールファイルパス → 使用しているファイルパス[] */
    modulePathToFiles: Map<string, string[]>;
}
/**
 * 参照解析結果
 */
export interface ReferenceAnalysisResult {
    /** ファイルパス → 使用情報 */
    fileUsages: Map<string, FileUsage>;
    /** 逆参照マップ */
    reverseRefs: ReverseReferenceMap;
}
/**
 * 解析オプション
 */
export interface AnalyzerOptions {
    /** プロジェクトルートパス */
    projectPath: string;
    /** tsconfig.json のパス */
    tsConfigPath?: string;
    /** 解析対象ファイル */
    targetFiles: string[];
    /** コンポーネントディレクトリのパターン */
    componentPatterns?: RegExp[];
    /** アクションディレクトリのパターン */
    actionPatterns?: RegExp[];
    /** モジュールディレクトリのパターン */
    modulePatterns?: RegExp[];
    /** verbose ログ */
    verbose?: boolean;
}
/**
 * プロジェクトの参照関係を解析する
 */
export declare function analyzeProjectReferences(options: AnalyzerOptions): ReferenceAnalysisResult;
/**
 * ファイルパスから要素名を抽出
 * 例: "apps/admin/app/[locale]/posts/page.tsx" → "PostsScreen"
 */
export declare function extractElementNameFromPath(filePath: string, type: "screen" | "component" | "action"): string;
/**
 * ファイルパスが Screen ファイルかどうか判定
 */
export declare function isScreenFile(filePath: string): boolean;
/**
 * ファイルパスが Component ファイルかどうか判定
 */
export declare function isComponentFile(filePath: string): boolean;
/**
 * ファイルパスが Action ファイルかどうか判定
 */
export declare function isActionFile(filePath: string): boolean;
/**
 * ファイルパスが Middleware ファイルかどうか判定
 */
export declare function isMiddlewareFile(filePath: string): boolean;
/**
 * ファイルパスが Layout ファイルかどうか判定
 */
export declare function isLayoutFile(filePath: string): boolean;
//# sourceMappingURL=reference-analyzer.d.ts.map