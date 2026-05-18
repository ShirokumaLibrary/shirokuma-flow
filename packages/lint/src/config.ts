/**
 * 設定ファイル読み込みユーティリティ
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { isEnoent } from "./exit-code.js";
import { t, setLocaleFromConfig } from "./i18n.js";

type WorkflowIssueSeverity = "error" | "warning" | "info";

/**
 * 設定ファイルの正規パス（プロジェクトルートからの相対）。
 */
export const CONFIG_FILE = ".shirokuma/config.yaml";

/**
 * 設定ファイルの候補パス（探索順、優先度の高い順）。
 */
export const CONFIG_FILE_CANDIDATES = [".shirokuma/config.yaml"] as const;

// ========================================
// Generic Application Type System
// ========================================

/**
 * Application type - determines document structure
 */
export type AppType = "web" | "api" | "cli" | "library";

/**
 * API protocol type
 */
export type ApiProtocol = "mcp" | "rest" | "graphql" | "grpc";

/**
 * Section type for applications
 */
export type SectionType =
  | "overview"
  | "featureMap"
  | "dbSchema"
  | "testCases"
  | "tools"       // API tools (MCP, REST, GraphQL, etc.)
  | "endpoints"   // REST API endpoints
  | "commands"    // CLI commands
  | "modules";    // Library modules

/**
 * Application configuration
 */
export interface ApplicationConfig {
  /** Unique identifier */
  id: string;
  /** Application type */
  type: AppType;
  /** Display name */
  name: string;
  /** Description */
  description?: string;
  /** Source directory (e.g., "apps/web", "apps/mcp") */
  source?: string;
  /** Icon name (lucide-react compatible) */
  icon?: string;
  /** Theme color */
  color?: string;
  /** API protocol (for type: "api") */
  protocol?: ApiProtocol;
  /** Tools file path (for api type) */
  toolsFile?: string;
  /** Section definitions */
  sections?: Array<{
    type: SectionType;
    label?: string;
    icon?: string;
    filter?: {
      paths?: string[];
    };
  }>;
  /** Database tables used by this app */
  dbTables?: string[];
  /** Test file patterns */
  tests?: {
    match: string[];
  };
}

/**
 * スキーマソース設定（複数DB対応）
 *
 * DB名はpathから自動取得:
 * - packages/database/src/schema -> "database"
 * - packages/analytics-db/src/schema -> "analytics-db"
 */
export interface SchemaSourceConfig {
  /** スキーマディレクトリパス（必須） */
  path: string;
  /** 説明（オプション） */
  description?: string;
}

/**
 * Package configuration for monorepo shared packages
 *
 * Allows documenting packages under packages/ directory
 * with their modules, types, and exports.
 */
export interface PackageConfig {
  /** Package name (e.g., "database", "shared") */
  name: string;
  /** Path to package directory (e.g., "packages/database") */
  path: string;
  /** Package prefix/scope (e.g., "@repo/database") */
  prefix: string;
  /** Package description */
  description?: string;
  /** Entry point files to scan (e.g., ["src/index.ts"]) */
  entryPoints?: string[];
  /** Icon name (lucide-react compatible) */
  icon?: string;
  /** Theme color */
  color?: string;
}

/**
 * ドキュメントソース設定（個別ソース）
 */
export interface DocsSourceConfig {
  /** ソース識別名 */
  name: string;
  /**
   * llms.txt の URL または GitHub リポジトリ URL。
   * プリセット名だけで登録した場合、fetch 時にプリセット meta から自動補完されるため省略可能。
   */
  url?: string;
  /** 出力ディレクトリ（デフォルト: .shirokuma/contexts/{name}/） */
  outputDir?: string;
  /**
   * リンク形式
   * - 'md': .md 拡張子付き URL をそのまま使用
   * - 'clean': 拡張子なし URL に .md を付与して取得
   */
  linkFormat?: "md" | "clean";
  /** llms-full.txt の URL（fetchStrategy: 'full-split' 用） */
  fullUrl?: string;
  /**
   * fetch 戦略
   * - 'individual': llms.txt のリンクから個別に取得（デフォルト）
   * - 'full-split': llms-full.txt を分割して取得
   * - その他: strategies/{name}.ts から動的ロード（サイト固有戦略）
   */
  fetchStrategy?: "individual" | "full-split" | (string & {});
  /** full-split 時の分割パターン（正規表現文字列） */
  splitPattern?: string;
  /** GitHub リポジトリ内のドキュメントディレクトリパス（サイト固有戦略用）。複数指定可 */
  repoPath?: string | string[];
  /** 取得対象ブランチ（サイト固有戦略用、デフォルト: 'main'） */
  branch?: string;
}

/**
 * context コマンド設定（外部ライブラリ docs の保存先）
 *
 * #2280 で `.shirokuma/docs/` → `.shirokuma/contexts/` に rename。
 * 将来的に #2279 の整理で docs / md コマンドが分離される際に、
 * このスキーマも `context` コマンド側に移動予定。
 */
export interface ContextsConfig {
  /** デフォルト出力ディレクトリ（デフォルト: .shirokuma/contexts/） */
  outputDir?: string;
}

/**
 * shirokuma-flow 設定
 */
export interface ShirokumaConfig {
  /** CLI locale (en | ja) - determines CLI output language */
  locale?: "en" | "ja";

  /** プロジェクト情報 */
  project: {
    /** プロジェクト名 */
    name: string;
    /** プロジェクト説明 */
    description?: string;
    /** プロジェクトURL */
    url?: string;
    /** プロジェクトバージョン */
    version?: string;
    /** リポジトリURL */
    repository?: string;
  };

  /** 出力設定 */
  output: {
    /** メイン出力ディレクトリ */
    dir: string;
    /** ポータル出力ディレクトリ */
    portal?: string;
    /** 生成ファイル出力ディレクトリ */
    generated?: string;
  };

  /** TypeDoc 設定 */
  typedoc?: {
    /** エントリーポイント */
    entryPoints?: string[];
    /** tsconfig パス */
    tsconfig?: string;
    /** 出力ディレクトリ */
    out?: string;
    /** プラグイン */
    plugin?: string[];
    /** 除外パターン */
    exclude?: string[];
  };

  /** スキーマ生成設定 */
  schema?: {
    /** スキーマソース（複数DB対応） */
    sources: SchemaSourceConfig[];
    /** スキーマファイルパターン（共通設定） */
    pattern?: string;
  };

  /** 依存関係グラフ設定 */
  deps?: {
    /** 含めるパス */
    include?: string[];
    /** 除外パス */
    exclude?: string[];
    /** 出力ディレクトリ */
    output?: string;
    /** 出力フォーマット (svg, json) */
    formats?: ("svg" | "json")[];
  };

  /** テストケース設定 */
  testCases?: {
    /** Jest 設定 */
    jest?: {
      /** 設定ファイル */
      config?: string;
      /** テストマッチパターン */
      testMatch?: string[];
    };
    /** Playwright 設定 */
    playwright?: {
      /** 設定ファイル */
      config?: string;
      /** テストディレクトリ */
      testDir?: string;
    };
    /** 出力ディレクトリ (オーバーライド用) */
    output?: string;
    /** BDD アノテーション設定 */
    bddAnnotations?: {
      /** BDD アノテーションを有効にする (デフォルト: true) */
      enabled?: boolean;
      /** サポートするタグ (デフォルト: ["given", "when", "then", "and"]) */
      tags?: string[];
    };
  };

  /** ポータル設定 */
  portal?: {
    /** サイトタイトル */
    title?: string;
    /** 追加リンク */
    links?: Array<{
      name: string;
      url: string;
      description?: string;
    }>;
    /** 開発ツールリンク */
    devTools?: Array<{
      name: string;
      url: string;
      description?: string;
    }>;
  };

  /** アプリケーション設定 (マルチアプリ対応) */
  applications?: {
    /** 共通セクション */
    shared?: {
      sections?: Array<{
        /** セクションタイプ */
        type: "overview" | "dbSchema" | "testCases";
        /** 表示ラベル */
        label?: string;
        /** アイコン名 (lucide互換) */
        icon?: string;
      }>;
    };
    /** アプリケーション定義 */
    apps?: Array<ApplicationConfig>;
  };

  /** パッケージ設定 (モノレポ共有パッケージ対応) */
  packages?: PackageConfig[];

  /** lint-tests 設定 */
  lintTests?: {
    /** 有効にするルール */
    rules?: {
      /** testdoc-required ルール */
      "testdoc-required"?: boolean | "error" | "warning" | "info" | "off";
      /** testdoc-japanese ルール */
      "testdoc-japanese"?: boolean | "error" | "warning" | "info" | "off";
      /** testdoc-min-length ルール */
      "testdoc-min-length"?: boolean | "error" | "warning" | "info" | "off";
      /** duplicate-testdoc ルール */
      "duplicate-testdoc"?: boolean | "error" | "warning" | "info" | "off";
      /** describe-coverage ルール */
      "describe-coverage"?: boolean | "error" | "warning" | "info" | "off";
    };
    /** strictモード（warningもエラーとして扱う） */
    strict?: boolean;
    /** カバレッジ閾値 (%) */
    coverageThreshold?: number;
    /** 無視するパターン */
    ignore?: string[];
  };

  /** lint-coverage 設定 */
  lintCoverage?: {
    /** 有効フラグ */
    enabled?: boolean;
    /** strictモード (missingがあれば失敗) */
    strict?: boolean;
    /** @skip-test に理由が必須か */
    requireSkipReason?: boolean;
    /** 規約マッピング */
    conventions?: Array<{
      /** ソースファイルのglobパターン */
      source: string;
      /** テストファイルのglobパターン */
      test: string;
    }>;
    /** 除外パターン */
    exclude?: string[];
  };

  /** ADR (Architecture Decision Records) 設定 */
  adr?: {
    /** 有効フラグ */
    enabled?: boolean;
    /** ADR 出力ディレクトリ */
    directory?: string;
    /** テンプレート形式 (現在は madr のみ) */
    template?: "madr";
    /** 言語 */
    language?: "ja" | "en";
  };

  /** カバレッジ可視化設定 */
  coverage?: {
    /** 有効フラグ */
    enabled?: boolean;
    /** Istanbul coverage-summary.json のパス */
    source?: string;
    /** 閾値設定 */
    thresholds?: {
      lines?: number;
      branches?: number;
      functions?: number;
      statements?: number;
    };
    /** 閾値未満で失敗する (CI用) */
    failUnder?: boolean;
  };

  /** 検索機能設定 */
  search?: {
    /** 検索機能の有効/無効 (デフォルト: true) */
    enabled?: boolean;
    /** 検索エンジン (flexsearch のみサポート) */
    engine?: "flexsearch";
    /** インデックス出力パス */
    indexOutput?: string;
    /** 検索対象に含めるパターン */
    include?: string[];
    /** 検索対象から除外するパターン */
    exclude?: string[];
  };

  /** API-テスト関連付け設定 */
  linkDocs?: {
    /** 有効フラグ (デフォルト: true) */
    enabled?: boolean;
    /** カバレッジ率を表示するか (デフォルト: true) */
    showCoverage?: boolean;
    /** API ドキュメントのパス */
    apiDocsPath?: string;
    /** テストケース HTML のパス */
    testCasesPath?: string;
    /** 出力ファイル名 (デフォルト: linked-docs.html) */
    outputFile?: string;
  };

  /** Feature Map 設定 */
  featureMap?: {
    /** 有効フラグ (デフォルト: true) */
    enabled?: boolean;
    /** 含めるパターン */
    include?: string[];
    /** 除外パターン */
    exclude?: string[];
    /** 外部ドキュメントリンク設定 */
    externalDocs?: Array<{
      /** 設定名 (識別用) */
      name: string;
      /** マッチングパターン (正規表現) */
      pattern: string;
      /** URL テンプレート ({name}, {kebab-name}, {lower-name} が使用可能) */
      urlTemplate: string;
      /** リンクラベル */
      label: string;
      /** 対象タイプ (component, action, table, all) */
      type?: "component" | "action" | "table" | "all";
    }>;
    /** Storybook 設定 */
    storybook?: {
      /** 有効フラグ */
      enabled?: boolean;
      /** Storybook URL */
      url?: string;
      /** パステンプレート ({name}, {kebab-name}, {lower-name} が使用可能) */
      pathTemplate?: string;
      /** リンクラベル */
      label?: string;
    };
  };

  /** Overview 設定 */
  overview?: {
    /** 有効フラグ (デフォルト: true) */
    enabled?: boolean;
    /** 詳細説明 Markdown ファイルパス */
    file?: string;
    /** アーキテクチャ層 */
    layers?: Array<{
      /** 層名 */
      name: string;
      /** 説明 */
      description: string;
      /** アイコン名 (lucide互換) */
      icon?: string;
      /** 色 (blue, green, purple, orange, pink, cyan) */
      color?: string;
    }>;
    /** 機能サマリー */
    features?: Array<{
      /** 機能名 */
      name: string;
      /** 説明 */
      description: string;
      /** ステータス (stable, beta, planned) */
      status?: "stable" | "beta" | "planned";
      /** 優先度 (core, standard, optional) */
      priority?: "core" | "standard" | "optional";
    }>;
    /** 技術スタック */
    techStack?: Array<{
      /** カテゴリ名 */
      category: string;
      /** 技術リスト */
      items: string[];
    }>;
    /** クイックコマンド */
    quickLinks?: Array<{
      /** 表示テキスト */
      text: string;
      /** コマンド */
      command: string;
    }>;
  };

  /** スクリーンショット生成設定 */
  screenshots?: {
    /** 有効フラグ (デフォルト: true) */
    enabled?: boolean;
    /** ソース指定 ('annotations' | 'feature-map' | 'config' | 'both') デフォルト: 'feature-map' */
    source?: "annotations" | "feature-map" | "config" | "both";
    /** アノテーションスキャン対象パス (source: 'annotations' または 'both' 用) */
    scanPaths?: string[];
    /** 直接定義された screens (source: 'config' 用) */
    screens?: Array<{
      name: string;
      route: string;
      description?: string;
      viewport?: { width: number; height: number };
      auth?: "required" | "none" | "optional";
      waitFor?: string;
      delay?: number;
    }>;
    /** ベースURL */
    baseUrl?: string;
    /** ロケール */
    locale?: string;
    /** 複数アカウント定義 (マルチアカウント対応) */
    accounts?: Record<string, {
      /** メールアドレス */
      email: string;
      /** パスワード */
      password: string;
      /** 表示ラベル */
      label?: string;
    }>;
    /** デフォルトアカウント (@screenshotAccount 未指定時に使用) */
    defaultAccount?: string;
    /** ログインパス (accounts使用時) */
    loginPath?: string;
    /** 認証設定 (後方互換性のため残す) */
    auth?: {
      /** メールアドレス */
      email?: string;
      /** パスワード */
      password?: string;
      /** ログインパス */
      loginPath?: string;
    };
    /** ビューポートサイズ */
    viewport?: {
      /** 幅 */
      width?: number;
      /** 高さ */
      height?: number;
    };
    /** 出力ディレクトリ */
    outputDir?: string;
    /** テストファイル出力パス */
    testFile?: string;
    /** 動的ルート置換マッピング */
    routeParams?: Record<string, string>;
    /** スクリーン単位のルート上書き (スクリーン名 -> 完全ルートまたはURL) */
    screenOverrides?: Record<string, string>;
    /**
     * 動的ルート解決設定（E2Eテストフィクスチャー連携）
     * テストDBから実際のエンティティIDを取得してルートを構築
     */
    dynamicRoutes?: {
      /** 有効フラグ */
      enabled?: boolean;
      /** データベースヘルパーモジュールへのパス（例: "./tests/helpers/database"） */
      helperModule?: string;
      /** ルートパラメータとメソッドのマッピング */
      paramMethods?: Record<string, string>;
      /** テスト環境のデータベースURL（直接接続する場合） */
      databaseUrl?: string;
    };
    /**
     * アプリ別設定（マルチアプリ対応）
     * キー: アプリID (例: "admin", "public")
     * 設定されている場合、アプリごとに別々のテストファイルを生成
     */
    apps?: Record<string, {
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
      /** このアプリを有効にするかどうか */
      enabled?: boolean;
    }>;
  };

  /** lint-code 設定 */
  lintCode?: {
    /** 有効フラグ */
    enabled?: boolean;
    /** strictモード (エラー時に exit code 1) */
    strict?: boolean;
    /** Server Actions 検証設定 */
    serverActions?: {
      /** ファイルパターン (glob) */
      filePattern?: string;
      /** 除外パターン */
      excludePattern?: string;
      /** モジュールヘッダー必須タグ */
      requiredFileHeader?: string[];
      /** 関数必須タグ */
      requiredFunctionTags?: string[];
      /** セクション区切りコメントを必須とするか */
      sectionSeparators?: boolean;
    };
  };

  /** lint-docs 設定 */
  lintDocs?: {
    /** 有効フラグ */
    enabled?: boolean;
    /** strictモード (エラー時に exit code 1) */
    strict?: boolean;
    /** 必須ドキュメント設定 */
    required?: Array<{
      /** ファイルパス (単一ファイル) */
      file?: string;
      /** ファイルパターン (glob) */
      filePattern?: string;
      /** ドキュメントの説明 */
      description: string;
      /** 最小ファイル数 (filePattern 用) */
      minCount?: number;
      /** セクションルール */
      sections?: Array<{
        /** 正規表現パターン */
        pattern: string;
        /** セクション説明 */
        description: string;
        /** 必須か */
        required: boolean;
      }>;
      /** 最小行数 */
      minLength?: number;
      /** 最大行数 */
      maxLength?: number;
      /** フロントマタールール */
      frontmatter?: {
        /** フロントマターが必須か */
        required: boolean;
        /** フィールドルール */
        fields: Array<{
          /** フィールド名 */
          name: string;
          /** 許容値リスト */
          values?: string[];
          /** 日付フォーマット */
          format?: string;
        }>;
      };
    }>;
    /** リンク検証設定 */
    validateLinks?: {
      /** 有効か */
      enabled: boolean;
      /** 内部リンクをチェックするか */
      checkInternal: boolean;
      /** 外部リンクをチェックするか */
      checkExternal: boolean;
    };
    /** フォーマット検証設定 */
    formatting?: {
      /** 最大行長 */
      maxLineLength?: number;
      /** 見出し前に空行が必要か */
      requireBlankLineBeforeHeading?: boolean;
    };
  };

  /** lint-annotations 設定 */
  lintAnnotations?: {
    /** 有効フラグ */
    enabled?: boolean;
    /** strictモード (エラー時に exit code 1) */
    strict?: boolean;
    /** ルール設定 */
    rules?: {
      /** @usedComponents 整合性チェック */
      "usedComponents-match"?: {
        severity?: WorkflowIssueSeverity;
        checkOrder?: boolean;
        excludeHooks?: boolean;
      };
      /** @screen 必須チェック */
      "screen-required"?: {
        severity?: WorkflowIssueSeverity;
        paths?: string[];
        exclude?: string[];
      };
      /** @component 必須チェック */
      "component-required"?: {
        severity?: WorkflowIssueSeverity;
        paths?: string[];
        exclude?: string[];
      };
    };
    /** グローバル除外パターン */
    exclude?: string[];
  };

  /** Public/Private repo pair management */
  repoPairs?: Record<string, {
    /** Private repository (owner/name) */
    private: string;
    /** Public repository (owner/name) */
    public: string;
    /** Files/directories to exclude from public release */
    exclude?: string[];
    /** Default branch name (defaults to "main") */
    defaultBranch?: string;
    /** Source directory within private repo (release only this subdirectory) */
    sourceDir?: string;
  }>;

  /** プラグイン設定 */
  plugins?: {
    /** リリースチャンネル（未指定時は現行動作: HEAD からインストール） */
    channel?: "stable" | "rc" | "beta" | "alpha";
  };

  /** Hooks 設定（破壊的コマンド保護ルール） */
  hooks?: {
    /** 許可するルール ID のリスト（デフォルト全ブロック、指定 ID のみ許可） */
    allow?: string[];
  };

  /** context（外部ライブラリ docs 保存先）設定 #2280 */
  contexts?: ContextsConfig;

  /** スキルルーティング設定 */
  skills?: {
    routing?: {
      designing?: {
        /** 追加スキル（キー → スキル名） */
        add?: Record<string, string>;
        /** 除外するスキル名 */
        exclude?: string[];
      };
      coding?: {
        /** 追加スキル（キー → スキル名） */
        add?: Record<string, string>;
        /** 除外するスキル名 */
        exclude?: string[];
      };
      reviewing?: {
        /** 追加スキル（キー → スキル名） */
        add?: Record<string, string>;
        /** 除外するスキル名 */
        exclude?: string[];
      };
    };
  };

  /** Cross-repository references (alias → owner/repo) */
  crossRepos?: Record<string, string>;

  /** lint-workflow 設定 */
  lintWorkflow?: {
    /** 有効フラグ */
    enabled?: boolean;
    /** strictモード (エラー時に exit code 1) */
    strict?: boolean;
    /** ルール設定 */
    rules?: {
      /** Issue フィールド完全性チェック */
      "issue-fields"?: {
        severity?: WorkflowIssueSeverity;
        enabled?: boolean;
      };
      /** ブランチ命名規則チェック */
      "branch-naming"?: {
        severity?: WorkflowIssueSeverity;
        enabled?: boolean;
        prefixes?: string[];
      };
      /** 保護ブランチチェック */
      "main-protection"?: {
        severity?: WorkflowIssueSeverity;
        enabled?: boolean;
        branches?: string[];
      };
      /** コミットメッセージ形式チェック */
      "commit-format"?: {
        severity?: WorkflowIssueSeverity;
        enabled?: boolean;
        types?: string[];
      };
      /** Co-Authored-By 署名チェック */
      "co-authored-by"?: {
        severity?: WorkflowIssueSeverity;
        enabled?: boolean;
      };
      /** CLAUDE.md 行数上限チェック（ADR-v3-021） */
      "claude-md-budget"?: {
        severity?: WorkflowIssueSeverity;
        enabled?: boolean;
        /** 最大行数（デフォルト: 150） */
        maxLines?: number;
      };
      /** CLAUDE.md と index ファイルの整合性チェック（ADR-v3-021） */
      "claude-md-index-drift"?: {
        severity?: WorkflowIssueSeverity;
        enabled?: boolean;
        /** index ファイルが配置されるディレクトリ（デフォルト: .shirokuma/rules/shirokuma-flow） */
        indexDir?: string;
      };
    };
  };

  /** lint-structure 設定 */
  lintStructure?: {
    /** 有効フラグ */
    enabled?: boolean;
    /** strictモード (エラー時に exit code 1) */
    strict?: boolean;
    /** 除外するアプリ (MCPサーバー等Next.js構造不要なアプリ) */
    excludeApps?: string[];
    /** ルール設定 */
    rules?: {
      /** 必須ディレクトリ */
      "dir-required"?: {
        severity: "error" | "warning" | "info";
        apps?: string[];
        packages?: Record<string, string[]>;
      };
      /** 必須ファイル */
      "file-required"?: {
        severity: "error" | "warning" | "info";
        apps?: string[];
        packages?: Record<string, string[]>;
      };
      /** lib/ 直下ファイル禁止 */
      "lib-no-root-files"?: {
        severity: "error" | "warning" | "info";
        enabled: boolean;
      };
      /** lib/ サブディレクトリに index.ts 必須 */
      "lib-has-index"?: {
        severity: "error" | "warning" | "info";
        enabled: boolean;
      };
      /** 推奨ディレクトリ */
      "dir-recommended"?: {
        severity: "error" | "warning" | "info";
        apps?: string[];
      };
      /** 命名規則 */
      "naming-convention"?: {
        severity: "error" | "warning" | "info";
        enabled: boolean;
        rules?: {
          domainDirs?: "PascalCase" | "camelCase" | "kebab-case";
          components?: "PascalCase" | "camelCase";
          actions?: "PascalCase" | "camelCase";
          routeGroups?: "lowercase" | "PascalCase";
        };
      };
      /** アプリ間インポート禁止 */
      "no-cross-app-import"?: {
        severity: "error" | "warning" | "info";
        enabled: boolean;
      };
      /** components/ ドメイン別グループ化 */
      "components-domain-grouping"?: {
        severity: "error" | "warning" | "info";
        enabled: boolean;
        systemDirs?: string[];
      };
    };
  };
}

/**
 * デフォルト設定
 */
export const defaultConfig: ShirokumaConfig = {
  project: {
    name: "Project",
    description: "",
  },
  output: {
    dir: "./docs",
    portal: "./docs/portal",
    generated: "./docs/generated",
  },
  typedoc: {
    entryPoints: ["./src"],
    tsconfig: "./tsconfig.json",
    exclude: ["**/node_modules/**", "**/*.test.ts", "**/*.spec.ts"],
  },
  schema: {
    sources: [
      { path: "./packages/database/src/schema" },
    ],
    pattern: "*.ts",
  },
  deps: {
    include: ["src", "lib", "app"],
    exclude: ["node_modules", ".next", "dist"],
    output: undefined,
    formats: ["svg", "json"],
  },
  testCases: {
    jest: {
      config: "./jest.config.ts",
      testMatch: ["**/__tests__/**/*.test.{ts,tsx}", "**/*.test.{ts,tsx}"],
    },
    playwright: {
      config: "./playwright.config.ts",
      testDir: "./tests/e2e",
    },
    output: undefined,
    bddAnnotations: {
      enabled: true,
      tags: ["given", "when", "then", "and"],
    },
  },
  portal: {
    title: "ドキュメントポータル",
    links: [],
    devTools: [],
  },
  packages: [],
  lintTests: {
    rules: {
      "testdoc-required": "warning",
      "testdoc-japanese": "warning",
      "testdoc-min-length": "info",
      "duplicate-testdoc": "error",
      "describe-coverage": "info",
    },
    strict: false,
    coverageThreshold: 0,
    ignore: [],
  },
  adr: {
    enabled: true,
    directory: "docs/adr",
    template: "madr",
    language: "ja",
  },
  search: {
    enabled: true,
    engine: "flexsearch",
    indexOutput: undefined,
    include: ["docs/**/*.md", "README.md", "CLAUDE.md"],
    exclude: ["**/node_modules/**"],
  },
  linkDocs: {
    enabled: true,
    showCoverage: true,
    apiDocsPath: "docs/generated/api",
    testCasesPath: "docs/portal/test-cases.html",
    outputFile: "linked-docs.html",
  },
  featureMap: {
    enabled: true,
    include: [
      "apps/*/app/**/*.tsx",
      "apps/*/components/**/*.tsx",
      "apps/*/lib/actions/**/*.ts",
      "packages/*/src/schema/**/*.ts",
    ],
    exclude: [
      "**/node_modules/**",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
    ],
  },
  overview: {
    enabled: true,
    file: undefined,
    layers: [],
    features: [],
    techStack: [],
    quickLinks: [],
  },
  screenshots: {
    enabled: true,
    source: "feature-map",
    scanPaths: ["apps/*/app/**/*page.tsx"],
    screens: [],
    baseUrl: "https://localhost:3000",
    locale: "ja",
    auth: {
      email: "admin@example.com",
      password: "Admin@Test2024!",
      loginPath: "/login",
    },
    viewport: {
      width: 1280,
      height: 720,
    },
    outputDir: "docs/portal/screenshots",
    testFile: "tests/e2e/screenshots.generated.spec.ts",
    routeParams: {
      "[locale]": "ja",
      "[orgSlug]": "test-org",
      "[projectSlug]": "test-project",
      "[sessionId]": "test-session",
      "[entityId]": "test-entity",
    },
    screenOverrides: {},
    dynamicRoutes: {
      enabled: false,
      helperModule: "./tests/helpers/database",
      paramMethods: {},
      databaseUrl: "",
    },
  },
  lintDocs: {
    enabled: false,
    strict: false,
    required: [],
    validateLinks: {
      enabled: true,
      checkInternal: true,
      checkExternal: false,
    },
    formatting: {
      maxLineLength: 120,
      requireBlankLineBeforeHeading: true,
    },
  },
  lintAnnotations: {
    enabled: true,
    strict: false,
    rules: {
      "usedComponents-match": {
        severity: "warning",
        checkOrder: false,
        excludeHooks: true,
      },
      "screen-required": {
        severity: "warning",
        paths: ["apps/*/app/**/page.tsx"],
        exclude: ["**/not-found.tsx", "**/error.tsx", "**/loading.tsx"],
      },
      "component-required": {
        severity: "info",
        paths: ["apps/*/components/**/*.tsx"],
        exclude: ["**/components/ui/**", "**/providers/**"],
      },
    },
    exclude: ["**/node_modules/**", "**/__tests__/**"],
  },
  lintStructure: {
    enabled: false,
    strict: true,
    rules: {
      "dir-required": {
        severity: "error",
        apps: [
          "app",
          "app/[locale]",
          "components",
          "components/ui",
          "lib",
          "lib/actions",
          "lib/auth",
          "messages",
        ],
        packages: {
          database: ["src/schema", "src"],
        },
      },
      "file-required": {
        severity: "error",
        apps: ["middleware.ts", "next.config.ts", "package.json"],
        packages: {
          database: ["src/schema/index.ts", "src/index.ts", "drizzle.config.ts"],
        },
      },
      "lib-no-root-files": {
        severity: "error",
        enabled: true,
      },
      "lib-has-index": {
        severity: "warning",
        enabled: true,
      },
      "dir-recommended": {
        severity: "info",
        apps: ["types", "hooks", "lib/security", "lib/utils"],
      },
      "naming-convention": {
        severity: "warning",
        enabled: true,
        rules: {
          domainDirs: "PascalCase",
          components: "PascalCase",
          actions: "camelCase",
          routeGroups: "lowercase",
        },
      },
      "no-cross-app-import": {
        severity: "error",
        enabled: true,
      },
      "components-domain-grouping": {
        severity: "warning",
        enabled: true,
        systemDirs: ["ui", "layout", "common", "providers", "__tests__"],
      },
    },
  },
};

/**
 * 設定ファイルを読み込む
 */
export function loadConfig(
  projectPath: string,
  configFile: string
): ShirokumaConfig {
  const configPath = resolve(projectPath, configFile);

  let content: string;
  try {
    content = readFileSync(configPath, "utf-8");
  } catch (error) {
    if (isEnoent(error)) {
      console.warn(t("config.notFound", { path: configPath }));
      console.warn(t("config.usingDefaults"));
      return defaultConfig;
    }
    console.error(t("config.loadFailed", { error: String(error) }));
    return defaultConfig;
  }

  try {
    const userConfig = parseYaml(content) as Partial<ShirokumaConfig>;
    const merged = mergeConfig(defaultConfig, userConfig);
    if (merged.locale) {
      setLocaleFromConfig(merged.locale);
    }
    return merged;
  } catch (error) {
    console.error(t("config.loadFailed", { error: String(error) }));
    return defaultConfig;
  }
}

/**
 * 設定をマージ
 */
function mergeConfig(
  base: ShirokumaConfig,
  override: Partial<ShirokumaConfig>
): ShirokumaConfig {
  return {
    locale: override.locale ?? base.locale,
    project: { ...base.project, ...override.project },
    output: { ...base.output, ...override.output },
    typedoc: { ...base.typedoc, ...override.typedoc },
    schema: override.schema ?? base.schema,
    deps: { ...base.deps, ...override.deps },
    testCases: {
      jest: { ...base.testCases?.jest, ...override.testCases?.jest },
      playwright: { ...base.testCases?.playwright, ...override.testCases?.playwright },
      output: override.testCases?.output ?? base.testCases?.output,
      bddAnnotations: {
        enabled: override.testCases?.bddAnnotations?.enabled ?? base.testCases?.bddAnnotations?.enabled ?? true,
        tags: override.testCases?.bddAnnotations?.tags ?? base.testCases?.bddAnnotations?.tags ?? ["given", "when", "then", "and"],
      },
    },
    portal: { ...base.portal, ...override.portal },
    packages: override.packages ?? base.packages ?? [],
    lintTests: {
      rules: { ...base.lintTests?.rules, ...override.lintTests?.rules },
      strict: override.lintTests?.strict ?? base.lintTests?.strict,
      coverageThreshold: override.lintTests?.coverageThreshold ?? base.lintTests?.coverageThreshold,
      ignore: override.lintTests?.ignore ?? base.lintTests?.ignore,
    },
    lintCoverage: override.lintCoverage
      ? {
          enabled: override.lintCoverage.enabled ?? base.lintCoverage?.enabled,
          strict: override.lintCoverage.strict ?? base.lintCoverage?.strict,
          requireSkipReason: override.lintCoverage.requireSkipReason ?? base.lintCoverage?.requireSkipReason,
          conventions: override.lintCoverage.conventions ?? base.lintCoverage?.conventions,
          exclude: override.lintCoverage.exclude ?? base.lintCoverage?.exclude,
        }
      : base.lintCoverage,
    adr: override.adr
      ? {
          enabled: override.adr.enabled ?? base.adr?.enabled,
          directory: override.adr.directory ?? base.adr?.directory,
          template: override.adr.template ?? base.adr?.template,
          language: override.adr.language ?? base.adr?.language,
        }
      : base.adr,
    coverage: override.coverage
      ? {
          enabled: override.coverage.enabled ?? base.coverage?.enabled,
          source: override.coverage.source ?? base.coverage?.source,
          thresholds: {
            ...base.coverage?.thresholds,
            ...override.coverage.thresholds,
          },
          failUnder: override.coverage.failUnder ?? base.coverage?.failUnder,
        }
      : base.coverage,
    search: override.search
      ? {
          enabled: override.search.enabled ?? base.search?.enabled ?? true,
          engine: override.search.engine ?? base.search?.engine ?? "flexsearch",
          indexOutput: override.search.indexOutput ?? base.search?.indexOutput,
          include: override.search.include ?? base.search?.include,
          exclude: override.search.exclude ?? base.search?.exclude,
        }
      : base.search,
    linkDocs: override.linkDocs
      ? {
          enabled: override.linkDocs.enabled ?? base.linkDocs?.enabled ?? true,
          showCoverage: override.linkDocs.showCoverage ?? base.linkDocs?.showCoverage ?? true,
          apiDocsPath: override.linkDocs.apiDocsPath ?? base.linkDocs?.apiDocsPath,
          testCasesPath: override.linkDocs.testCasesPath ?? base.linkDocs?.testCasesPath,
          outputFile: override.linkDocs.outputFile ?? base.linkDocs?.outputFile,
        }
      : base.linkDocs,
    featureMap: override.featureMap
      ? {
          enabled: override.featureMap.enabled ?? base.featureMap?.enabled ?? true,
          include: override.featureMap.include ?? base.featureMap?.include,
          exclude: override.featureMap.exclude ?? base.featureMap?.exclude,
          externalDocs: override.featureMap.externalDocs ?? base.featureMap?.externalDocs,
          storybook: override.featureMap.storybook ?? base.featureMap?.storybook,
        }
      : base.featureMap,
    overview: override.overview
      ? {
          enabled: override.overview.enabled ?? base.overview?.enabled ?? true,
          file: override.overview.file ?? base.overview?.file,
          layers: override.overview.layers ?? base.overview?.layers ?? [],
          features: override.overview.features ?? base.overview?.features ?? [],
          techStack: override.overview.techStack ?? base.overview?.techStack ?? [],
          quickLinks: override.overview.quickLinks ?? base.overview?.quickLinks ?? [],
        }
      : base.overview,
    screenshots: override.screenshots
      ? {
          enabled: override.screenshots.enabled ?? base.screenshots?.enabled ?? true,
          source: override.screenshots.source ?? base.screenshots?.source ?? "feature-map",
          scanPaths: override.screenshots.scanPaths ?? base.screenshots?.scanPaths,
          screens: override.screenshots.screens ?? base.screenshots?.screens,
          baseUrl: override.screenshots.baseUrl ?? base.screenshots?.baseUrl,
          locale: override.screenshots.locale ?? base.screenshots?.locale,
          accounts: override.screenshots.accounts ?? base.screenshots?.accounts,
          defaultAccount: override.screenshots.defaultAccount ?? base.screenshots?.defaultAccount,
          loginPath: override.screenshots.loginPath ?? override.screenshots.auth?.loginPath ?? base.screenshots?.loginPath,
          auth: {
            email: override.screenshots.auth?.email ?? base.screenshots?.auth?.email,
            password: override.screenshots.auth?.password ?? base.screenshots?.auth?.password,
            loginPath: override.screenshots.auth?.loginPath ?? base.screenshots?.auth?.loginPath,
          },
          viewport: {
            width: override.screenshots.viewport?.width ?? base.screenshots?.viewport?.width,
            height: override.screenshots.viewport?.height ?? base.screenshots?.viewport?.height,
          },
          outputDir: override.screenshots.outputDir ?? base.screenshots?.outputDir,
          testFile: override.screenshots.testFile ?? base.screenshots?.testFile,
          routeParams: { ...base.screenshots?.routeParams, ...override.screenshots.routeParams },
          screenOverrides: { ...base.screenshots?.screenOverrides, ...override.screenshots.screenOverrides },
          dynamicRoutes: {
            enabled: override.screenshots.dynamicRoutes?.enabled ?? base.screenshots?.dynamicRoutes?.enabled ?? false,
            helperModule: override.screenshots.dynamicRoutes?.helperModule ?? base.screenshots?.dynamicRoutes?.helperModule ?? "./tests/helpers/database",
            paramMethods: { ...base.screenshots?.dynamicRoutes?.paramMethods, ...override.screenshots.dynamicRoutes?.paramMethods },
            databaseUrl: override.screenshots.dynamicRoutes?.databaseUrl ?? base.screenshots?.dynamicRoutes?.databaseUrl ?? "",
          },
          apps: override.screenshots.apps ?? base.screenshots?.apps,
        }
      : base.screenshots,
    lintCode: override.lintCode
      ? {
          enabled: override.lintCode.enabled ?? base.lintCode?.enabled ?? false,
          strict: override.lintCode.strict ?? base.lintCode?.strict ?? false,
          serverActions: override.lintCode.serverActions ?? base.lintCode?.serverActions,
        }
      : base.lintCode,
    applications: override.applications
      ? {
          shared: override.applications.shared ?? base.applications?.shared,
          apps: override.applications.apps ?? base.applications?.apps,
        }
      : base.applications,
    lintDocs: override.lintDocs
      ? {
          enabled: override.lintDocs.enabled ?? base.lintDocs?.enabled ?? false,
          strict: override.lintDocs.strict ?? base.lintDocs?.strict ?? false,
          required: override.lintDocs.required ?? base.lintDocs?.required ?? [],
          validateLinks: override.lintDocs.validateLinks ?? base.lintDocs?.validateLinks,
          formatting: override.lintDocs.formatting ?? base.lintDocs?.formatting,
        }
      : base.lintDocs,
    lintAnnotations: override.lintAnnotations
      ? {
          enabled: override.lintAnnotations.enabled ?? base.lintAnnotations?.enabled ?? true,
          strict: override.lintAnnotations.strict ?? base.lintAnnotations?.strict ?? false,
          rules: {
            "usedComponents-match": {
              ...base.lintAnnotations?.rules?.["usedComponents-match"],
              ...override.lintAnnotations.rules?.["usedComponents-match"],
            },
            "screen-required": {
              ...base.lintAnnotations?.rules?.["screen-required"],
              ...override.lintAnnotations.rules?.["screen-required"],
            },
            "component-required": {
              ...base.lintAnnotations?.rules?.["component-required"],
              ...override.lintAnnotations.rules?.["component-required"],
            },
          },
          exclude: override.lintAnnotations.exclude ?? base.lintAnnotations?.exclude,
        }
      : base.lintAnnotations,
    plugins: override.plugins
      ? {
          channel: override.plugins.channel ?? base.plugins?.channel,
        }
      : base.plugins,
    hooks: override.hooks
      ? {
          allow: override.hooks.allow ?? base.hooks?.allow,
        }
      : base.hooks,
    skills: override.skills
      ? {
          routing: {
            designing: {
              add: { ...base.skills?.routing?.designing?.add, ...override.skills?.routing?.designing?.add },
              exclude: override.skills?.routing?.designing?.exclude ?? base.skills?.routing?.designing?.exclude,
            },
            coding: {
              add: { ...base.skills?.routing?.coding?.add, ...override.skills?.routing?.coding?.add },
              exclude: override.skills?.routing?.coding?.exclude ?? base.skills?.routing?.coding?.exclude,
            },
            reviewing: {
              add: { ...base.skills?.routing?.reviewing?.add, ...override.skills?.routing?.reviewing?.add },
              exclude: override.skills?.routing?.reviewing?.exclude ?? base.skills?.routing?.reviewing?.exclude,
            },
          },
        }
      : base.skills,
    repoPairs: override.repoPairs ?? base.repoPairs,
    crossRepos: override.crossRepos ?? base.crossRepos,
    contexts: override.contexts
      ? {
          outputDir: override.contexts.outputDir ?? base.contexts?.outputDir,
        }
      : base.contexts,
    lintWorkflow: override.lintWorkflow
      ? {
          enabled: override.lintWorkflow.enabled ?? base.lintWorkflow?.enabled ?? true,
          strict: override.lintWorkflow.strict ?? base.lintWorkflow?.strict ?? false,
          rules: {
            "issue-fields": {
              ...base.lintWorkflow?.rules?.["issue-fields"],
              ...override.lintWorkflow.rules?.["issue-fields"],
            },
            "branch-naming": {
              ...base.lintWorkflow?.rules?.["branch-naming"],
              ...override.lintWorkflow.rules?.["branch-naming"],
            },
            "main-protection": {
              ...base.lintWorkflow?.rules?.["main-protection"],
              ...override.lintWorkflow.rules?.["main-protection"],
            },
            "commit-format": {
              ...base.lintWorkflow?.rules?.["commit-format"],
              ...override.lintWorkflow.rules?.["commit-format"],
            },
            "co-authored-by": {
              ...base.lintWorkflow?.rules?.["co-authored-by"],
              ...override.lintWorkflow.rules?.["co-authored-by"],
            },
            "claude-md-budget": {
              ...base.lintWorkflow?.rules?.["claude-md-budget"],
              ...override.lintWorkflow.rules?.["claude-md-budget"],
            },
            "claude-md-index-drift": {
              ...base.lintWorkflow?.rules?.["claude-md-index-drift"],
              ...override.lintWorkflow.rules?.["claude-md-index-drift"],
            },
          },
        }
      : base.lintWorkflow,
    lintStructure: override.lintStructure
      ? {
          enabled: override.lintStructure.enabled ?? base.lintStructure?.enabled ?? false,
          strict: override.lintStructure.strict ?? base.lintStructure?.strict ?? true,
          excludeApps: override.lintStructure.excludeApps ?? base.lintStructure?.excludeApps,
          rules: override.lintStructure.rules ?? base.lintStructure?.rules,
        }
      : base.lintStructure,
  };
}

/**
 * パスを解決 (プロジェクトルートからの相対パス)
 */
export function resolvePath(projectPath: string, relativePath: string): string {
  if (relativePath.startsWith("/")) {
    return relativePath;
  }
  return resolve(projectPath, relativePath);
}

/**
 * 出力パスを取得
 */
export function getOutputPath(
  config: ShirokumaConfig,
  projectPath: string,
  type: "portal" | "generated" | "base"
): string {
  const outputDir = resolvePath(projectPath, config.output.dir);

  switch (type) {
    case "portal":
      return config.output.portal
        ? resolvePath(projectPath, config.output.portal)
        : resolve(outputDir, "portal");
    case "generated":
      return config.output.generated
        ? resolvePath(projectPath, config.output.generated)
        : resolve(outputDir, "generated");
    case "base":
    default:
      return outputDir;
  }
}
