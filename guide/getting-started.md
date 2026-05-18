# Getting Started

shirokuma-flow をインストールし、プロジェクトに導入する。

## 前提条件

- Node.js 20.0.0 以上
- `GITHUB_TOKEN` 環境変数（GitHub 連携を使う場合）
- Claude Code 最新版（スキル・ルール機能を使う場合）

## 1. GitHub 認証を設定する

GitHub 連携コマンド（`issue`, `pr`, `discussion`, `project`, `status` など）を使う場合、認証が必要になる。

### 方法 A: `GITHUB_TOKEN` 環境変数を設定する（推奨）

GitHub Personal Access Token を環境変数に設定する。`gh` CLI のインストールは不要:

```bash
export GITHUB_TOKEN="ghp_xxxxx"
```

必要なスコープ: `repo`, `read:project`, `project`

> `read:project` は `dashboard` での Issue 一覧取得、`project` は `project add-issue` でのプロジェクトボードへの追加に必要。このスコープが不足していると Issue 一覧が空になるなど、初見では原因がわかりにくいエラーが発生する。

### 方法 B: `gh auth login` を使う（フォールバック）

GitHub CLI がインストール済みの場合、`gh auth token` の出力をフォールバックとして利用する:

```bash
gh auth login
gh auth refresh -s read:project,project
```

## 2. shirokuma-flow をインストールする

### 方法 A: ワンライナーインストール（推奨）

```bash
curl -fsSL https://raw.githubusercontent.com/ShirokumaLibrary/shirokuma-flow/main/install.sh | bash
```

`~/.local/` にインストールされる。Claude Code ユーザーは `~/.local/bin` が既に PATH に含まれているため、追加設定は不要。

### 方法 B: npm / pnpm でグローバルインストール

```bash
# npm
npm install -g @shirokuma-library/flow

# pnpm
pnpm add -g @shirokuma-library/flow
```

### 方法 C: 関連バイナリを追加で入れる

`shirokuma-flow` 以外のバイナリ（生成・lint 等）を使う場合は、必要なものだけ別途グローバルインストールする:

```bash
npm i -g @shirokuma-library/portal      # shirokuma-portal（ドキュメント生成）
npm i -g @shirokuma-library/lint        # shirokuma-lint（構造 lint）
npm i -g @shirokuma-library/markdown    # shirokuma-md（LLM 最適化 Markdown）
npm i -g @shirokuma-library/context     # shirokuma-context（外部ドキュメント取得）
npm i -g @shirokuma-library/codemap     # shirokuma-codemap（コードマップ）
```

### インストールを確認する

```bash
shirokuma-flow --version
```

## 3. プロジェクトを初期化する

プロジェクトのルートディレクトリで `init` コマンドを実行する。

### 基本的な初期化

設定ファイルのみ生成する:

```bash
cd your-project
shirokuma-flow init
```

### スキル・ルール付きの初期化（Claude Code ユーザー向け）

Claude Code と組み合わせて使う場合は、スキルとルールも一緒にインストールする:

```bash
shirokuma-flow init --with-skills --with-rules --lang ja
```

| オプション | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `--with-skills [skills]` | string | — | スキル + 安全フック（`shirokuma-hooks`）をインストール（カンマ区切りで指定可、または全スキル） |
| `--with-rules` | boolean | `false` | ルールファイルを `.claude/rules/shirokuma/` にデプロイする |
| `--lang <lang>` | enum | — | 言語を設定する（`ja` / `en`） |
| `--channel <channel>` | enum | `stable` | プラグインのリリースチャンネル（`stable` / `rc` / `beta` / `alpha`） |
| `-f, --force` | boolean | `false` | スキル/ルールを強制再デプロイ |
| `--nextjs` | boolean | `false` | Next.js モノレポ構造（`apps/`, `packages/` 等）をスキャフォールド（`--with-nextjs` とは別機能） |
| `--with-nextjs` | boolean | `false` | `shirokuma-nextjs` プラグインをインストール（Next.js 向けスキル追加。ディレクトリ構造は変更しない） |
| `--no-gitignore` | boolean | `false` | `.gitignore` の自動更新をスキップ |

### Next.js プロジェクトの初期化

Next.js プロジェクトで使う場合は、モノレポスキャフォールドと Next.js 専用スキルを一緒にインストールできる:

```bash
# モノレポ構造をスキャフォールドして Next.js スキルも追加
shirokuma-flow init --nextjs --with-nextjs --with-skills --with-rules --lang ja
```

生成されるファイル:

```
your-project/
├── .shirokuma/config.yaml    # 設定ファイル
└── .claude/
    ├── settings.json             # 言語設定
    └── rules/
        └── shirokuma/            # ルールファイル群
```

スキルプラグインと安全フックはグローバルキャッシュ（`~/.claude/plugins/cache/`）にインストールされる。プロジェクトローカルにはコピーされない。

> `--with-skills` と `--with-rules` の両方を指定するのが推奨。ルールはスキルプラグインに同梱されているが、`.claude/rules/` に展開しないと Claude Code に認識されない。

## 4. 設定ファイルを編集する

`.shirokuma/config.yaml` をプロジェクトに合わせて編集する:

```yaml
project:
  name: "MyProject"
  description: "プロジェクトの説明"
  version: "1.0.0"
  repository: "https://github.com/org/repo"

output:
  generated: "docs/generated"

testCases:
  jest:
    testMatch: ["**/__tests__/**/*.test.ts"]
```

全設定項目は [設定ファイルリファレンス](config.md) を参照。

## 5. ドキュメントを生成する（任意）

ドキュメント生成は `shirokuma-portal` バイナリで行う（別パッケージ）。

```bash
npm i -g @shirokuma-library/portal
```

### 全コマンド一括実行

設定ファイルで有効になっているコマンドをまとめて実行する:

```bash
shirokuma-portal generate
```

### 個別コマンドの実行

特定のドキュメントだけ生成する:

```bash
# テストケース一覧を生成
shirokuma-portal generate test-cases -p .

# 依存関係グラフを生成
shirokuma-portal generate deps -p .

# ドキュメントポータルを生成
shirokuma-portal generate portal -p .
```

### 出力構造

```
docs/
├── portal/
│   ├── index.html       # ポータルトップページ
│   ├── viewer.html      # Markdown/DBML/SVG ビューア
│   └── test-cases.html  # テストケース一覧
└── generated/
    ├── api/             # TypeDoc Markdown
    ├── api-html/        # TypeDoc HTML
    ├── schema/
    │   ├── schema.dbml
    │   └── schema-docs.md
    ├── dependencies.svg
    └── test-cases.md
```

## 6. コード品質をチェックする（任意）

ドキュメントやコードの品質をチェックする。`shirokuma-flow lint` または `shirokuma-lint` を使う:

```bash
# テストコメントの品質チェック
shirokuma-flow lint tests -p .

# 実装とテストの対応チェック
shirokuma-flow lint coverage -p .

# ドキュメント構造の検証
shirokuma-flow lint docs -p .
```

## 7. GitHub 連携をセットアップする（任意）

GitHub Projects V2 と連携する場合は、設定ファイルに追加する:

```yaml
github:
  discussionsCategory: "Knowledge"
  listLimit: 20
```

GitHub の Web UI からプロジェクトを作成し、フィールドをセットアップする:

1. [GitHub Projects](https://github.com/orgs/YOUR_ORG/projects) から新しいプロジェクトを作成する（Table レイアウト推奨）
2. フィールドセットアップを実行する:

```bash
shirokuma-flow project setup --lang ja
```

セットアップの詳細は以下を参照:

- 手動設定（Issue Types、Discussion カテゴリ等）の手順 → [Next.js クイックスタート](quickstart-nextjs.md#3-github-をセットアップする)
- Claude Code に委任する場合 → `/setting-up-project` スキル

### セットアップを検証する

```bash
shirokuma-flow integrity --setup
```

Discussion カテゴリ、Project フィールド、ワークフロー自動化の設定状況を確認できる。

## アップグレード

### ステップ 1: CLI を更新する

```bash
# ワンライナーインストーラ（再実行で上書き更新）
curl -fsSL https://raw.githubusercontent.com/ShirokumaLibrary/shirokuma-flow/main/install.sh | bash

# npm の場合
npm update -g @shirokuma-library/flow
```

### ステップ 2: プラグイン・ルール・キャッシュを更新する

プロジェクトディレクトリで実行する:

```bash
cd your-project
shirokuma-flow update
```

### ステップ 3: Claude Code セッションを再起動する

更新後は新しい Claude Code セッションを開始する。キャッシュの読み込みはセッション起動時に行われる。

更新で問題が起きた場合は [トラブルシューティング](troubleshooting.md) を参照。

## 次のステップ

- AI への指示方法を知る → [ワークフローガイド](workflows/README.md)
- Next.js プロジェクトの作成 → [Next.js クイックスタート](quickstart-nextjs.md)
- スキル・ルール・フックの詳細 → [プラグイン管理](plugins.md)
- 全コマンド一覧 → [CLI クイックリファレンス](reference/cli-quick-reference.md)
- 設定の全項目 → [設定ファイルリファレンス](config.md)
- 設計思想を理解する → [アーキテクチャ](concepts/architecture.md)
