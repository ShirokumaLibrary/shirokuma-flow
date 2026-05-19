/**
 * screenshots コマンド - 画面スクリーンショット自動生成
 *
 * 画面情報を取得する方法:
 * 1. annotations: page.tsx の @screenshot アノテーションからスキャン
 * 2. feature-map: feature-map.json の screens から取得
 * 3. config: 設定ファイルに直接定義された screens から取得
 * 4. both: annotations と feature-map の両方を統合
 *
 * 機能:
 * - 動的ルート ([locale], [orgSlug] 等) を設定値で置換
 * - Playwright スクリプトを自動生成（scripts/screenshots/ に出力）
 * - --run オプションで即時実行
 *
 * 出力先:
 * - スクリプト: scripts/screenshots/capture-screens.playwright.ts
 * - スクリーンショット: docs/portal/screenshots/
 *
 * 注意: E2Eテスト (tests/e2e/) とは別管理
 */
/**
 * コマンドオプション
 */
interface ScreenshotsOptions {
    project: string;
    config: string;
    output?: string;
    run?: boolean;
    verbose?: boolean;
}
/**
 * アカウント設定
 */
export interface AccountConfig {
    /** メールアドレス */
    email: string;
    /** パスワード */
    password: string;
    /** 表示ラベル (例: "管理者", "一般ユーザー") */
    label?: string;
}
/**
 * 動的ルート解決設定（E2Eテストフィクスチャー連携）
 */
export interface DynamicRoutesConfig {
    /** 有効フラグ */
    enabled?: boolean;
    /**
     * データベースヘルパーモジュールへのパス
     * プロジェクトルートからの相対パス
     * 例: "./tests/helpers/database"
     */
    helperModule?: string;
    /**
     * ルートパラメータとメソッドのマッピング
     * キー: ルート内のパラメータ (例: "[categoryId]")
     * 値: ヘルパーメソッド名 (例: "getFirstCategoryId")
     *
     * 注: 指定しない場合は getScreenshotEntityIds() を自動使用
     */
    paramMethods?: Record<string, string>;
    /**
     * テスト環境のデータベースURL
     * 直接PostgreSQL接続する場合に使用（helperModuleより優先度低）
     */
    databaseUrl?: string;
}
/**
 * アプリ別スクリーンショット設定
 */
export interface AppScreenshotsConfig {
    /** ベースURL */
    baseUrl?: string;
    /** 認証設定（nullで認証スキップ） */
    auth?: {
        email?: string;
        password?: string;
        loginPath?: string;
    } | null;
    /** テストファイル出力パス */
    testFile?: string;
    /** 出力ディレクトリ */
    outputDir?: string;
    /** スクリーン単位のルート上書き */
    screenOverrides?: Record<string, string>;
    /** このアプリのスクリーンを含めるかどうか */
    enabled?: boolean;
}
/**
 * Screenshots 設定
 */
export interface ScreenshotsConfig {
    /** 有効フラグ */
    enabled?: boolean;
    /** ソース指定 ('annotations' | 'feature-map' | 'config' | 'both') */
    source?: "annotations" | "feature-map" | "config" | "both";
    /** アノテーションスキャン対象パス */
    scanPaths?: string[];
    /** 直接定義された screens (source: 'config' 用) */
    screens?: Array<{
        name: string;
        route: string;
        description?: string;
        viewport?: {
            width: number;
            height: number;
        };
        auth?: "required" | "none" | "optional";
        waitFor?: string;
        delay?: number;
    }>;
    /** ベースURL (シングルアプリ用) */
    baseUrl?: string;
    /** アプリごとのベースURL (マルチアプリ用) */
    appBaseUrls?: Record<string, string>;
    /** ロケール */
    locale?: string;
    /** 複数アカウント定義 (マルチアカウント対応) */
    accounts?: Record<string, AccountConfig>;
    /** デフォルトアカウント (@screenshotAccount 未指定時に使用) */
    defaultAccount?: string;
    /** 認証設定 (後方互換性のため残す、accounts未定義時に使用) */
    auth?: {
        /** メールアドレス */
        email?: string;
        /** パスワード */
        password?: string;
        /** ログインパス */
        loginPath?: string;
    };
    /** ログインパス (accounts使用時) */
    loginPath?: string;
    /** ビューポートサイズ */
    viewport?: {
        width?: number;
        height?: number;
    };
    /** 出力ディレクトリ */
    outputDir?: string;
    /** テストファイル出力パス */
    testFile?: string;
    /** 動的ルート置換マッピング */
    routeParams?: Record<string, string>;
    /** スクリーン単位のルート上書き (スクリーン名 -> 完全ルート) */
    screenOverrides?: Record<string, string>;
    /**
     * 動的ルート解決設定（E2Eテストフィクスチャー連携）
     * テストDBから実際のエンティティIDを取得してルートを構築
     */
    dynamicRoutes?: DynamicRoutesConfig;
    /**
     * アプリ別設定（マルチアプリ対応）
     * キー: アプリID (例: "admin", "public")
     * 設定されている場合、アプリごとに別々のテストファイルを生成
     */
    apps?: Record<string, AppScreenshotsConfig>;
}
/**
 * スクリーンショットマニフェスト（ポータル表示用）
 */
export interface ScreenshotManifest {
    /** 生成日時 */
    generatedAt: string;
    /** 設定情報 */
    config: {
        baseUrl: string;
        viewport: {
            width: number;
            height: number;
        };
        outputDir: string;
    };
    /** スクリーンショット情報（スクリーン名がキー） */
    screenshots: Record<string, ScreenshotEntry>;
}
/**
 * 個別スクリーンショット情報
 */
export interface ScreenshotEntry {
    /** スクリーン名 */
    name: string;
    /** ファイル名（相対パス） */
    fileName: string;
    /** ルート */
    route: string;
    /** 説明 */
    description?: string;
    /** ソースファイルパス */
    sourcePath?: string;
    /** アカウント（マルチアカウント時） */
    account?: string;
    /** ビューポート */
    viewport?: {
        width: number;
        height: number;
    };
}
/**
 * screenshots コマンド
 */
export declare function screenshotsCommand(options: ScreenshotsOptions): Promise<number>;
export {};
//# sourceMappingURL=screenshots.d.ts.map