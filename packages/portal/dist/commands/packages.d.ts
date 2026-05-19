/**
 * packages コマンド - モノレポパッケージドキュメント生成
 *
 * packages/ ディレクトリ内の共有パッケージをスキャンし、
 * モジュール、エクスポート、依存関係を解析してドキュメントデータを生成する。
 *
 * @module packages
 */
/**
 * コマンドオプション
 */
interface PackagesOptions {
    project: string;
    config: string;
    output?: string;
    verbose?: boolean;
}
/**
 * パッケージエクスポートアイテム
 */
export interface PackageExportData {
    /** エクスポート名 */
    name: string;
    /** 種類 */
    kind: "function" | "type" | "interface" | "const" | "class" | "enum";
    /** 説明 */
    description?: string;
    /** シグネチャ */
    signature?: string;
}
/**
 * パッケージモジュールデータ
 */
export interface PackageModuleData {
    /** モジュール名 */
    name: string;
    /** パス */
    path: string;
    /** 説明 */
    description?: string;
    /** エクスポート一覧 */
    exports: PackageExportData[];
    /** 依存モジュール */
    dependencies: string[];
}
/**
 * パッケージスキャン結果
 */
export interface PackageScanResult {
    /** パッケージ名 */
    name: string;
    /** パス */
    path: string;
    /** プレフィックス */
    prefix: string;
    /** 説明 */
    description?: string;
    /** アイコン */
    icon?: string;
    /** 色 */
    color?: string;
    /** モジュール一覧 */
    modules: PackageModuleData[];
}
/**
 * パッケージドキュメントデータ
 */
export interface PackagesData {
    /** パッケージ一覧 */
    packages: Array<{
        name: string;
        path: string;
        prefix: string;
        description?: string;
        icon?: string;
        color?: string;
        modules: PackageModuleData[];
        stats: {
            moduleCount: number;
            exportCount: number;
            typeCount: number;
            functionCount: number;
        };
    }>;
    /** サマリー */
    summary: {
        totalPackages: number;
        totalModules: number;
        totalExports: number;
    };
    /** 生成日時 */
    generatedAt: string;
}
/**
 * packages コマンドハンドラ
 */
export declare function packagesCommand(options: PackagesOptions): number;
/**
 * ファイルからモジュール情報をスキャン
 */
export declare function scanPackageModules(content: string, filePath: string): PackageModuleData | null;
/**
 * パッケージデータを構築
 */
export declare function buildPackagesData(scanResults: PackageScanResult[]): PackagesData;
export {};
//# sourceMappingURL=packages.d.ts.map