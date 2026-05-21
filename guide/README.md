# shirokuma-flow ユーザーマニュアル

shirokuma-flow は、**AI 駆動の開発ワークフロー管理 CLI** です。

GitHub Projects / Issues / Discussions と Claude Code スキルを統合し、計画→実装→レビュー→リリースの開発サイクルを一元管理します。TypeScript プロジェクト向けのドキュメント自動生成は別バイナリ（`shirokuma-portal`）で同梱しています。

## このマニュアルの対象読者

- shirokuma-flow をこれから導入するユーザー
- Claude Code と組み合わせてプロジェクト管理を行いたい開発者
- 各機能の具体的な使い方を知りたい人

## 目次

### チュートリアル

- [Getting Started](getting-started.md) — インストールから初回セットアップまで
- [入門ワークフローガイド](workflows/getting-started-workflow.md) — 最初の Issue 作成から PR マージまでを体験
- [Next.js クイックスタート](quickstart-nextjs.md) — 新規 Next.js プロジェクトで Issue 駆動開発を始める

### ワークフローガイド（AI への指示方法）

- [ワークフロー概要](workflows/README.md) — AI への指示の基本
- [ライフサイクル全体像](workflows/lifecycle-overview.md) — シーケンス図とコマンド対応表（俯瞰図）
- [Issue 管理](workflows/issue-management.md) — Issue の作成・管理を AI に指示する
- [実装](workflows/implementation.md) — 機能の実装・バグ修正を AI に依頼する
- [レビューと PR](workflows/review-and-pr.md) — コードレビュー・PR 作成を AI に依頼する
- [セッション管理](workflows/session-management.md) — 作業セッションの開始・終了を AI に指示する
- [ドキュメントと検証](workflows/documentation.md) — ドキュメント生成・コード品質チェック

### リファレンス

- [CLI クイックリファレンス](reference/cli-quick-reference.md) — 全コマンド一覧（バイナリ別）
- [設定ファイルリファレンス](config.md) — `.shirokuma/config.yaml` の全設定項目

### ガイド

- [プラグイン管理](plugins.md) — スキル・ルール・フックのインストールと更新
- [トラブルシューティング](troubleshooting.md) — よくある問題と対処法

### コンセプト（設計と背景）

- [アーキテクチャ](concepts/architecture.md) — 3 層アーキテクチャと設計思想
- [GitHub 連携の仕組み](concepts/github-integration.md) — GitHub API 統合の設計と背景

## shirokuma-flow でできること

### 1. AI 協働支援

Claude Code のスキル・ルールをバンドルし、AI との協働作業を標準化します。

- **スキル**: 実装、レビュー、コミット、PR 作成などの作業パターン
- **ルール**: ブランチ運用、コミットスタイル、GitHub 連携などの規約
- **フック**: 破壊的コマンドの自動ブロック

**日常ワークフロー（スキルを使った場合）:**

```
/starting-session              会話初期化（デフォルトルール読み込み）/show-dashboard で状態確認
  ↓
/issue-flow              Issue 作成 → 次のアクション候補を提示
  （または直接 /implement-flow #42）
  ↓
/prepare-flow                  計画策定（未計画 Issue のみ）
  ↓
/design-flow                   設計（設計フェーズが必要な場合のみ）
  ↓
実装                           code-issue が自動委任
  ↓
/commit-issue                  コミット・プッシュ
  ↓
/open-pr-issue                 PR 作成
  ↓
作業サマリーを Issue コメントに自動投稿、Status を Review に更新（submit checkpoint 経由）
```

詳しくは [ワークフローガイド](workflows/README.md) と [プラグイン管理](plugins.md) を参照してください。

### 2. GitHub 連携

GitHub Projects V2 と統合し、Issue / PR / Discussion の管理を 1 コマンドで行います。

| コマンド | 機能 |
|---------|------|
| `issue` | Issue の CRUD + Projects フィールド統合（list, pull, push, add, comment, close, search, branch, link, sub-list, ...） |
| `pr` | Pull Request 管理（create, list, show, comments, reply, resolve, merge, edit, close） |
| `project` | Projects V2 の管理（list, get, fields, create, update, delete, add-issue, workflows, setup） |
| `discussion` | Discussions / ADR 管理（list, show, search, add, categories, templates, adr） |
| `status` | Issue ステータス管理（transition, approve, update-batch, get, allowed, history） |
| `repo` | リポジトリ情報・ラベル・リポジトリペア |

### 3. 作業フェーズ移行（Checkpoint）

ステータス遷移とアサインとコメントを 1 コマンドにまとめた checkpoint コマンドを提供します。

| コマンド | 機能 |
|---------|------|
| `begin <N>` | 作業開始（status: In progress + 自己アサイン） |
| `submit <N> [--comment FILE]` | レビュー提出（status: Review、コメント任意） |
| `block <N> --reason <text>` | ブロック宣言（理由は Issue コメントとして記録） |
| `resume <N>` | ブロック解除して In progress へ |

### 4. 横断ユーティリティ

| コマンド | 機能 |
|---------|------|
| `dashboard` | アクティブ Issue + PR + git 状態を一括取得（`--team` で担当者別） |
| `preflight` | セッション終了前のデータを一括取得 |
| `integrity` | Issue 状態と Project Status の整合性チェック（`--fix` で自動修正、`--setup` で GitHub 設定検証） |

### 5. ドキュメント自動生成（`shirokuma-portal`）

コードからドキュメントを自動生成します。`shirokuma-portal` バイナリ（別パッケージ）で提供されます。

| コマンド | 生成物 |
|---------|-------|
| `generate typedoc` | TypeDoc API ドキュメント |
| `generate schema` | Drizzle ORM → DBML / SVG ER 図 |
| `generate deps` | 依存関係グラフ |
| `generate test-cases` | テストケース一覧 |
| `generate coverage` | テストカバレッジレポート |
| `generate feature-map` | 機能階層マップ（画面→コンポーネント→アクション→テーブル） |
| `generate portal` | ポータルサイト（HTML） |
| `generate overview` | プロジェクト概要 |
| `generate screenshots` | Playwright スクリーンショット |
| `generate search-index` | 全文検索インデックス |
| `generate link-docs` | API ⇄ テストの双方向リンク |
| `generate details` | 各要素の詳細ページ |
| `generate impact` | 変更影響分析 |
| `generate api-tools` | MCP ツールドキュメント |
| `generate i18n` | i18n 翻訳ドキュメント |
| `generate packages` | モノレポ共有パッケージ |
| `generate` | 設定で有効になっている全コマンド |

### 6. コード品質検証（`shirokuma-flow lint` / `shirokuma-lint`）

コード・ドキュメント・テストの構造を機械的にチェックします。

| コマンド | 検証内容 |
|---------|---------|
| `lint all` | 一括実行 |
| `lint tests` | `@testdoc` コメントの品質 |
| `lint coverage` | 実装ファイルとテストの対応 |
| `lint docs` | ドキュメント構造（OVERVIEW.md 等） |
| `lint code` | コードアノテーション・JSDoc タグ必須性 |
| `lint annotations` | アノテーション整合性 |
| `lint structure` | プロジェクト構造・命名規則 |
| `lint workflow` | AI ワークフロー規約 |
| `lint security` | 依存パッケージの脆弱性チェック |

### 7. 管理・ユーティリティ

| コマンド | 機能 |
|---------|------|
| `init` | 設定ファイルの初期化 + スキル/ルール/安全フックのインストール |
| `update` / `update-skills` | スキル・ルール・フック更新 + キャッシュ同期 |
| `plugin-install-local` | ローカルの `plugin/` をグローバルキャッシュへ |
| `repo pairs` | Private/Public リポジトリペア管理 |
| `git` | Git 状態管理（check, commit-push） |
| `skills` / `rules` / `skill` | スキル管理（routing, inject, validate, package, eval, optimize, benchmark） |
| `hooks` | Hooks 評価 |

別バイナリで提供されるユーティリティ:

| バイナリ | 機能 |
|---------|------|
| `shirokuma-md` | LLM 最適化 Markdown 結合・lint（`build`, `lint`, `validate`, `analyze`, `extract`, `batch-extract` 等） |
| `shirokuma-context` | 外部ドキュメント（llms.txt / GitHub）のローカル取得（`fetch`, `search`, `list`, `remove`, `detect`, `manifest`） |
| `shirokuma-codemap` | コードマップ抽出（`build`） |

## 必要な環境

| 要件 | バージョン |
|------|-----------|
| Node.js | 20.0.0 以上 |
| pnpm | 推奨（npm / yarn も可） |
| GitHub CLI (`gh`) または `GITHUB_TOKEN` | GitHub 連携を使う場合に必要（`GITHUB_TOKEN` 推奨、`gh` CLI はフォールバック） |
| Claude Code | AI 協働機能を使う場合に必要 |

## クイックスタート

```bash
# 1. インストール（ワンライナー推奨）
curl -fsSL https://raw.githubusercontent.com/ShirokumaLibrary/shirokuma-flow/main/install.sh | bash

# 2. プロジェクトの初期化（スキル・ルールも一緒に）
cd your-project
shirokuma-flow init --with-skills --with-rules --lang ja

# 3. Claude Code と連携
#    新しいセッションを開始 → /implement-flow #42
```

詳しいセットアップ手順は [Getting Started](getting-started.md) を参照してください。
