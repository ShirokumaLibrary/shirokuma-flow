# 設定ファイルリファレンス

`.shirokuma/config.yaml` の全設定項目を定義する。

## ファイルの場所

設定ファイルはプロジェクトルートに配置する。`shirokuma-flow init` で雛形が生成される。

```
your-project/
└── .shirokuma/config.yaml
```

コマンド実行時に `-c` オプションで別のパスを指定する:

```bash
shirokuma-portal generate -c path/to/config.yaml
shirokuma-flow lint all -c path/to/config.yaml
```

> `shirokuma-md` は別パッケージで、独自の設定ファイル `shirokuma-md.config.yaml` を使用する。詳細は [shirokuma-md の設定](#shirokuma-md-の設定) を参照。

---

## project — プロジェクト基本情報

```yaml
project:
  name: "MyProject"
  description: "プロジェクトの説明"
  version: "1.0.0"
  repository: "https://github.com/org/repo"
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `name` | string | はい | プロジェクト名 |
| `description` | string | いいえ | プロジェクトの説明 |
| `version` | string | いいえ | 現在のバージョン |
| `repository` | string | はい | リポジトリ URL |

---

## output — 出力先ディレクトリ

```yaml
output:
  portal: "docs/portal"
  generated: "docs/generated"
  schema: "docs/schema"
```

| フィールド | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `portal` | string | `docs/portal` | ポータル HTML の出力先 |
| `generated` | string | `docs/generated` | 生成ドキュメントの出力先 |
| `schema` | string | `docs/schema` | スキーマドキュメントの出力先 |

---

## typedoc — API ドキュメント

```yaml
typedoc:
  entryPoints: ["apps/web/lib"]
  exclude: ["**/*.test.ts"]
```

| フィールド | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `entryPoints` | string[] | — | TypeDoc の解析対象ディレクトリ |
| `exclude` | string[] | — | 除外するファイルパターン |

---

## schema — ER 図

```yaml
schema:
  sources:
    - path: packages/database/src/schema
    - path: packages/analytics-db/src/schema
      description: Analytics database
```

| フィールド | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `sources[].path` | string | — | Drizzle ORM スキーマのパス |
| `sources[].description` | string | — | スキーマの説明（任意） |

---

## testCases — テストケース抽出

```yaml
testCases:
  jest:
    testMatch: ["**/__tests__/**/*.test.ts"]
  playwright:
    testDir: "./tests/e2e"
```

| フィールド | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `jest.testMatch` | string[] | — | Jest テストファイルのパターン |
| `playwright.testDir` | string | — | Playwright テストのディレクトリ |

---

## lintTests — テストコメント品質

```yaml
lintTests:
  strict: false
  rules:
    testdoc-required: { severity: "warning" }
    testdoc-japanese: { severity: "warning" }
    duplicate-testdoc: { severity: "error" }
```

| フィールド | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `strict` | boolean | `false` | strict モードを有効にする |
| `rules.<name>.severity` | enum | — | ルールの severity を指定する（`error` / `warning` / `off`） |

---

## lintCoverage — 実装-テスト対応

```yaml
lintCoverage:
  enabled: true
  strict: true
  conventions:
    - source: "apps/web/lib/actions/*.ts"
      test: "apps/web/__tests__/lib/actions/*.test.ts"
  exclude:
    - "apps/web/components/ui/**"
    - "**/types.ts"
```

| フィールド | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `enabled` | boolean | `true` | 有効/無効 |
| `strict` | boolean | `true` | strict モード（このコマンドのみデフォルト `true`） |
| `conventions[].source` | string | — | ソースファイルのパターン |
| `conventions[].test` | string | — | テストファイルのパターン |
| `exclude` | string[] | — | チェック対象外のパターン |

---

## lintDocs — ドキュメント構造検証

```yaml
lintDocs:
  enabled: true
  strict: false
  required:
    - file: "docs/OVERVIEW.md"
      description: "Project overview"
      sections:
        - pattern: "^# .+"
          description: "Main title"
          required: true
        - pattern: "^## (概要|Overview)"
          description: "Tool overview"
          required: true
      minLength: 100
      maxLength: 1000
  validateLinks:
    enabled: true
    checkInternal: true
    checkExternal: false
  formatting:
    maxLineLength: 120
    requireBlankLineBeforeHeading: true
```

| フィールド | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `enabled` | boolean | `true` | 有効/無効 |
| `strict` | boolean | `false` | strict モードを有効にする |
| `required[].file` | string | — | 必須ドキュメントのパス |
| `required[].description` | string | — | ドキュメントの説明 |
| `required[].sections[].pattern` | string | — | 必須セクションの正規表現パターン |
| `required[].sections[].required` | boolean | `false` | セクションが必須かどうか |
| `required[].minLength` | number | — | 最小文字数 |
| `required[].maxLength` | number | — | 最大文字数 |
| `validateLinks.enabled` | boolean | `false` | リンク検証を有効にする |
| `validateLinks.checkInternal` | boolean | `true` | 内部リンクをチェックする |
| `validateLinks.checkExternal` | boolean | `false` | 外部リンクをチェックする |
| `formatting.maxLineLength` | number | `120` | 1行の最大文字数 |
| `formatting.requireBlankLineBeforeHeading` | boolean | `true` | 見出し前に空行を要求する |

---

## lintCode — コード構造検証

```yaml
lintCode:
  enabled: true
  strict: false
  serverActions:
    enabled: true
```

| フィールド | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `enabled` | boolean | `true` | 有効/無効 |
| `strict` | boolean | `false` | strict モードを有効にする |
| `serverActions.enabled` | boolean | `true` | Server Actions のチェックを有効にする |

---

## lintAnnotations — アノテーション整合性検証

```yaml
lintAnnotations:
  enabled: true
  strict: false
  rules:
    missing-component-ref: { severity: "warning" }
    invalid-screen-path: { severity: "error" }
```

| フィールド | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `enabled` | boolean | `true` | 有効/無効 |
| `strict` | boolean | `false` | strict モードを有効にする |
| `rules.<name>.severity` | enum | — | ルールの severity を指定する（`error` / `warning` / `off`） |

---

## lintStructure — プロジェクト構造検証

```yaml
lintStructure:
  enabled: true
  strict: false
  excludeApps: []
  rules:
    naming-convention: { severity: "warning" }
    directory-structure: { severity: "warning" }
```

| フィールド | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `enabled` | boolean | `true` | 有効/無効 |
| `strict` | boolean | `false` | strict モードを有効にする |
| `excludeApps` | string[] | `[]` | チェック対象外のアプリ |
| `rules.<name>.severity` | enum | — | ルールの severity を指定する |

---

## lintWorkflow — AI ワークフロー規約検証

```yaml
lintWorkflow:
  enabled: true
  strict: false
  rules:
    issue-fields: { severity: "warning" }
    branch-naming: { severity: "warning" }
    commit-format: { severity: "warning" }
  prefixes:
    - feat
    - fix
    - chore
    - docs
```

| フィールド | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `enabled` | boolean | `true` | 有効/無効 |
| `strict` | boolean | `false` | strict モードを有効にする |
| `rules.<name>.severity` | enum | — | ルールの severity を指定する |
| `prefixes` | string[] | `[feat, fix, chore, docs]` | 許可するブランチプレフィックス |

---

## featureMap — 機能階層マップ

```yaml
featureMap:
  enabled: true
  include:
    - "apps/web/app/**/*.tsx"
    - "apps/web/components/**/*.tsx"
    - "apps/web/lib/actions/**/*.ts"
  externalDocs:
    - name: "shadcn-ui"
      pattern: "^(Button|Card|...)$"
      urlTemplate: "https://ui.shadcn.com/docs/components/{kebab-name}"
```

| フィールド | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `enabled` | boolean | `false` | 有効/無効 |
| `include` | string[] | — | 解析対象のファイルパターン |
| `externalDocs[].name` | string | — | 外部ドキュメント名 |
| `externalDocs[].pattern` | string | — | コンポーネント名のマッチパターン |
| `externalDocs[].urlTemplate` | string | — | URL テンプレート |

---

## screenshots — スクリーンショット

```yaml
screenshots:
  enabled: true
  source: "annotations"
  accounts:
    admin:
      email: "admin@example.com"
      password: "Admin@Test2024!"
    user:
      email: "user@example.com"
      password: "User@Test2024!"
```

| フィールド | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `enabled` | boolean | `false` | 有効/無効 |
| `source` | string | `annotations` | テスト生成元 |
| `accounts.<name>.email` | string | — | テスト用アカウントのメールアドレス |
| `accounts.<name>.password` | string | — | テスト用アカウントのパスワード |

---

## overview — プロジェクト概要

```yaml
overview:
  enabled: true
  file: "docs/OVERVIEW.md"
  layers:
    - name: "Presentation"
      description: "Next.js + React"
      icon: "monitor"
  features:
    - name: "UserAuth"
      status: "stable"
      priority: "core"
```

| フィールド | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `enabled` | boolean | `false` | 有効/無効 |
| `file` | string | `docs/OVERVIEW.md` | 概要ファイルのパス |
| `layers[].name` | string | — | アーキテクチャレイヤー名 |
| `layers[].description` | string | — | レイヤーの説明 |
| `layers[].icon` | string | — | アイコン名 |
| `features[].name` | string | — | 機能名 |
| `features[].status` | string | — | 機能の状態 |
| `features[].priority` | string | — | 機能の優先度 |

---

## metrics — 開発メトリクス

ステータス遷移時に Projects V2 の Text フィールドへ ISO 8601 タイムスタンプを自動記録する。

```yaml
metrics:
  enabled: true
```

| フィールド | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `enabled` | boolean | `false` | メトリクス記録を有効にする |
| `staleThresholdDays` | number | `14` | In Progress が stale と見なされる日数 |

### statusToDateMapping のデフォルト値

| Status | 記録先フィールド |
|--------|----------------|
| `In Progress` | `Start at` |
| `Review` | `Review at` |
| `Done` | `End at` |
| `Done` | `End at` |

デフォルト値をそのまま使う場合は `enabled: true` だけで動作する。フィールド名をカスタマイズする場合のみ `statusToDateMapping` を指定する。

---

## github — GitHub 連携

```yaml
github:
  discussionsCategory: "Knowledge"
  listLimit: 20
  defaultStatus: "In progress"
  labels:
    feature: "feature"
    bug: "bug"
    chore: "chore"
    docs: "docs"
    research: "research"
```

| フィールド | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `discussionsCategory` | string | `Knowledge` | デフォルトで参照する Discussion カテゴリ名 |
| `listLimit` | number | `20` | Issue/Discussion の取得件数上限 |
| `defaultStatus` | string | `In progress` | Issue 作成時のデフォルト Status |
| `labels.<type>` | string | 下記参照 | Issue Type に対応するラベル名 |

labels のデフォルト値: `feature`, `bug`, `chore`, `docs`, `research`（各 Type と同名）。

---

## hooks — フック設定

破壊的コマンドの許可設定。デフォルトでは全コマンドがブロックされる。

```yaml
hooks:
  allow:
    - pr-merge
    # - force-push
    # - hard-reset
```

| フィールド | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `allow` | string[] | `[]` | ブロックを解除するルール ID のリスト |

利用可能なルール ID: `pr-merge`, `force-push`, `hard-reset`, `discard-worktree`, `clean-untracked`, `force-delete-branch`

---

## crossRepos — クロスリポジトリ

```yaml
crossRepos:
  frontend:
    owner: "my-org"
    repo: "frontend-app"
  backend:
    owner: "my-org"
    repo: "backend-api"
```

| フィールド | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `<alias>.owner` | string | — | リポジトリオーナー |
| `<alias>.repo` | string | — | リポジトリ名 |

`--repo <alias>` でクロスリポジトリ操作に使用する:

```bash
shirokuma-flow issue list --repo frontend
```

---

## repoPairs — リポジトリペア

Private → Public の公開リリース管理に使用する。

```yaml
repoPairs:
  main:
    private: "MyOrg/my-project"
    public: "MyPublicOrg/my-project"
    exclude:
      - ".env*"
      - "internal/"
```

| フィールド | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `<alias>.private` | string | — | Private リポジトリ（`owner/name` 形式） |
| `<alias>.public` | string | — | Public リポジトリ（`owner/name` 形式） |
| `<alias>.exclude` | string[] | — | リリース時の除外パターン |

---

## shirokuma-md の設定

`shirokuma-md` バイナリ（LLM 最適化 Markdown 管理、`@shirokuma-library/markdown`）は `.shirokuma/config.yaml` とは**別の設定ファイル** `shirokuma-md.config.yaml` を使用する。

```yaml
# shirokuma-md.config.yaml
output: "docs/combined.md"
include:
  - "docs/**/*.md"
exclude:
  - "node_modules/**"
```

詳しくは `shirokuma-md md --help` を参照。

---

## 設定パターン

### パターン 1: ドキュメント生成のみ（GitHub 連携なし）

```yaml
project:
  name: "MyApp"
  repository: "https://github.com/org/my-app"

output:
  generated: "docs/generated"

testCases:
  jest:
    testMatch: ["**/__tests__/**/*.test.ts"]

lintTests:
  rules:
    testdoc-required: { severity: "warning" }
```

### パターン 2: GitHub 連携あり（基本）

```yaml
project:
  name: "MyApp"
  repository: "https://github.com/org/my-app"

output:
  generated: "docs/generated"

testCases:
  jest:
    testMatch: ["**/__tests__/**/*.test.ts"]

github:
  discussionsCategory: "Knowledge"

metrics:
  enabled: true
```

### パターン 3: フロントエンド開発フル装備

```yaml
project:
  name: "MyApp"
  description: "Next.js フロントエンドアプリ"
  version: "1.0.0"
  repository: "https://github.com/org/my-app"

output:
  portal: "docs/portal"
  generated: "docs/generated"
  schema: "docs/schema"

testCases:
  jest:
    testMatch: ["**/__tests__/**/*.test.ts"]
  playwright:
    testDir: "./tests/e2e"

featureMap:
  enabled: true
  include:
    - "apps/web/app/**/*.tsx"
    - "apps/web/components/**/*.tsx"

schema:
  sources:
    - path: packages/database/src/schema

screenshots:
  enabled: true
  source: "annotations"
  accounts:
    admin:
      email: "admin@example.com"
      password: "Admin@Test2024!"

github:
  discussionsCategory: "Knowledge"

metrics:
  enabled: true
```

## 関連ドキュメント

- [CLI クイックリファレンス](reference/cli-quick-reference.md) — 全コマンドの構文
- [ワークフローガイド](workflows/README.md) — AI への指示方法
- [プラグイン管理](plugins.md) — スキル・ルールのインストールと更新
