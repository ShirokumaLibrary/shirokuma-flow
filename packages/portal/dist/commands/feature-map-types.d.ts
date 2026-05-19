/**
 * feature-map 型定義
 *
 * feature-map コマンドで使用するすべてのインターフェースと型を定義。
 * 他の feature-map モジュールはこのファイルから型をインポートする。
 */
import type { AppName } from "../utils/app-inference.js";
import type { ActionType } from "../utils/action-inference.js";
/**
 * コマンドオプション
 */
export interface FeatureMapOptions {
    project: string;
    config: string;
    output?: string;
    verbose?: boolean;
}
/**
 * Screen アイテム
 */
export interface ScreenItem {
    /** 画面名 */
    name: string;
    /** ファイルパス (相対) */
    path: string;
    /** URL ルート */
    route?: string;
    /** 説明 */
    description?: string;
    /** 使用コンポーネント */
    usedComponents: string[];
    /** 使用アクション */
    usedActions: string[];
    /** アプリ名 */
    app?: AppName;
}
/**
 * Component アイテム
 */
export interface ComponentItem {
    /** コンポーネント名 */
    name: string;
    /** ファイルパス (相対) */
    path: string;
    /** 説明 */
    description?: string;
    /** 使用される画面 */
    usedInScreens: string[];
    /** 使用されるコンポーネント */
    usedInComponents: string[];
    /** 使用アクション */
    usedActions: string[];
    /** アプリ名 */
    app?: AppName;
}
/**
 * Action アイテム
 */
export interface ActionItem {
    /** アクション名 */
    name: string;
    /** ファイルパス (相対) */
    path: string;
    /** 説明 */
    description?: string;
    /** 使用される画面 */
    usedInScreens: string[];
    /** 使用されるコンポーネント */
    usedInComponents: string[];
    /** 使用データベーステーブル */
    dbTables: string[];
    /** アプリ名 */
    app?: AppName;
    /** アクション種別 (CRUD/Domain) - ディレクトリから推論 */
    actionType?: ActionType;
}
/**
 * Table アイテム
 */
export interface TableItem {
    /** テーブル名 */
    name: string;
    /** ファイルパス (相対) */
    path: string;
    /** 説明 */
    description?: string;
    /** 使用されるアクション */
    usedInActions: string[];
    /** アプリ名 */
    app?: AppName;
}
/**
 * Module アイテム (lib/ ディレクトリ用)
 */
export interface ModuleItem {
    /** モジュール名 (auth, security, content等) */
    name: string;
    /** ファイルパス (相対) */
    path: string;
    /** 説明 */
    description?: string;
    /** 使用される画面 */
    usedInScreens: string[];
    /** 使用されるコンポーネント */
    usedInComponents: string[];
    /** 使用されるアクション */
    usedInActions: string[];
    /** 使用されるミドルウェア */
    usedInMiddleware: string[];
    /** 使用されるレイアウト */
    usedInLayouts: string[];
    /** このモジュールが使用するモジュール */
    usedModules: string[];
    /** このモジュールを使用するモジュール */
    usedInModules: string[];
    /** アプリ名 */
    app?: AppName;
    /** モジュールカテゴリ (auth, security, content, utils) */
    category?: string;
}
/**
 * Feature グループ
 */
export interface FeatureGroup {
    /** 画面一覧 */
    screens: ScreenItem[];
    /** コンポーネント一覧 */
    components: ComponentItem[];
    /** アクション一覧 */
    actions: ActionItem[];
    /** モジュール一覧 (lib/内) */
    modules: ModuleItem[];
    /** テーブル一覧 */
    tables: TableItem[];
}
/**
 * 型定義アイテム
 */
export interface TypeItem {
    /** 型名 */
    name: string;
    /** 型の種類 (interface, type, enum) */
    kind: "interface" | "type" | "enum";
    /** 説明 */
    description?: string;
    /** フィールド一覧 (interface/type用) */
    fields?: {
        name: string;
        type: string;
        description?: string;
    }[];
    /** 値一覧 (enum用) */
    values?: string[];
    /** ソースコード（JSDoc + 型定義本体） */
    sourceCode?: string;
}
/**
 * ユーティリティアイテム（定数・ヘルパー関数）
 */
export interface UtilityItem {
    /** 名前 */
    name: string;
    /** 種類 (constant, function) */
    kind: "constant" | "function";
    /** 説明 */
    description?: string;
    /** 型/戻り値の型 */
    type?: string;
    /** 値（定数の場合） */
    value?: string;
    /** 引数（関数の場合） */
    params?: {
        name: string;
        type: string;
    }[];
}
/**
 * Feature Map 全体構造
 */
export interface FeatureMap {
    /** 機能別グループ */
    features: {
        [featureName: string]: FeatureGroup;
    };
    /** 未分類アイテム */
    uncategorized: FeatureGroup;
    /** モジュール説明 (モジュール名 → 説明文) */
    moduleDescriptions: Record<string, string>;
    /** モジュール別型定義 (モジュール名 → 型定義リスト) */
    moduleTypes: Record<string, TypeItem[]>;
    /** モジュール別ユーティリティ (モジュール名 → 定数・ヘルパー関数リスト) */
    moduleUtilities: Record<string, UtilityItem[]>;
    /** 検出されたアプリ一覧 */
    apps?: AppName[];
    /** 生成日時 */
    generatedAt: string;
}
/**
 * 解析されたアイテム (内部用)
 */
export interface FeatureMapItem {
    /** アイテムタイプ */
    type: "screen" | "component" | "action" | "module" | "table";
    /** アイテム名 */
    name: string;
    /** ファイルパス */
    path: string;
    /** 機能グループ名 */
    feature?: string;
    /** URL ルート (screen用) */
    route?: string;
    /** 説明 */
    description?: string;
    /** 使用コンポーネント (screen用) */
    usedComponents?: string[];
    /** 使用アクション (screen/component用) */
    usedActions?: string[];
    /** 使用される画面 (component/action/module用) */
    usedInScreens?: string[];
    /** 使用されるコンポーネント (action/module用) */
    usedInComponents?: string[];
    /** 使用データベーステーブル (action用) */
    dbTables?: string[];
    /** 使用されるアクション (table/module用) */
    usedInActions?: string[];
    /** 使用されるミドルウェア (module用) */
    usedInMiddleware?: string[];
    /** 使用されるレイアウト (module用) */
    usedInLayouts?: string[];
    /** このモジュールが使用するモジュール (module用) */
    usedModules?: string[];
    /** このモジュールを使用するモジュール (module用) */
    usedInModules?: string[];
    /** アプリ名 */
    app?: AppName;
    /** アクション種別 (action用) - ディレクトリから推論 */
    actionType?: ActionType;
    /** モジュールカテゴリ (module用) - auth, security, content, utils */
    category?: string;
}
/**
 * 外部ドキュメント設定
 */
export interface ExternalDocConfig {
    name: string;
    pattern: string;
    urlTemplate: string;
    label: string;
    type?: "component" | "action" | "table" | "all";
}
/**
 * Storybook 設定
 */
export interface StorybookConfig {
    enabled: boolean;
    url: string;
    pathTemplate: string;
    label: string;
}
/**
 * Feature Map 設定 (内部用 - 必須フィールド)
 */
export interface ResolvedFeatureMapConfig {
    enabled: boolean;
    include: string[];
    exclude: string[];
    externalDocs: ExternalDocConfig[];
    storybook?: StorybookConfig;
}
/**
 * ファイルヘッダーメタデータ
 */
export interface FileMetadata {
    feature?: string;
    usedInScreens?: string[];
    usedInComponents?: string[];
    dbTables?: string[];
    /** モジュール説明（ファイルヘッダーの @description または先頭行） */
    moduleDescription?: string;
    /** モジュール名（@module タグ） */
    moduleName?: string;
}
/**
 * 解析結果（アイテムとファイルメタデータ）
 */
export interface ParseResult {
    items: FeatureMapItem[];
    metadata: FileMetadata;
    /** 抽出された型定義 */
    types: TypeItem[];
    /** 抽出されたユーティリティ（定数・ヘルパー関数） */
    utilities: UtilityItem[];
}
//# sourceMappingURL=feature-map-types.d.ts.map