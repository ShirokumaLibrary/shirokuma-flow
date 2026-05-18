# shirokuma-flow

AI 駆動の開発ワークフロー管理 CLI。GitHub Projects / Issues / Discussions と Claude Code スキルを統合し、計画→実装→レビュー→リリースの開発サイクルを一元管理する。TypeScript プロジェクト向けのドキュメント自動生成も別バイナリ（`shirokuma-portal`）として同梱。

[English](README.en.md)

## インストール

```bash
# stable (推奨)
curl -fsSL https://raw.githubusercontent.com/ShirokumaLibrary/shirokuma-flow/main/install.sh | bash

# prerelease (alpha / beta, 早期検証用)
curl -fsSL https://raw.githubusercontent.com/ShirokumaLibrary/shirokuma-flow/main/install.sh | bash -s -- --prerelease
```

`~/.local/bin/shirokuma-flow` が作成される。生成系 (`shirokuma-portal`) や lint (`shirokuma-lint`) は別パッケージで、必要に応じて追加する。インストール方法の詳細（npm/pnpm、前提条件、GitHub 認証）は [Getting Started](guide/getting-started.md) を参照。

### プラグインチャネル切替

CLI install 後にプラグインの配信チャネルを切り替える:

```bash
# prerelease (ShirokumaDevelopment/shirokuma-plugins) に切替
shirokuma-flow plugin install --prerelease

# stable (ShirokumaLibrary/shirokuma-plugins) に戻す
shirokuma-flow plugin install

# プレビュー
shirokuma-flow plugin install --prerelease --dry-run
```

内部で `claude plugin marketplace remove` → `add` の 2 ステップを実行し、片方しか登録されない状態を保証する。詳細・手動切替は [プラグイン管理ガイド](guide/plugins.md#チャネル切替stable--prerelease) を参照。

## はじめかた

> **前提**: Node.js 20.0.0 以上 + git リポジトリ + GitHub リモート。

```bash
# 1. 初期化（スキル + ルール + 安全フックを一括）
cd /path/to/your/project
shirokuma-flow init --with-skills --with-rules --lang ja

# 2. .shirokuma/config.yaml を編集（プロジェクト名・パス）

# 3. GitHub Project セットアップ（Claude Code から）
#    /setting-up-project

# 4. Claude Code セッションで作業を依頼
#    /implement-flow #42
```

詳細は [Getting Started](guide/getting-started.md)。最初の Issue 作成から PR マージまでは [入門ワークフローガイド](guide/workflows/getting-started-workflow.md)。

## 機能概要

| カテゴリ | 主なコマンド | 役割 |
|---------|-------------|------|
| GitHub 管理 | `issue`, `pr`, `discussion`, `project`, `status` | Issue / PR / Discussion / Projects V2 を 1 コマンドで操作 |
| Checkpoint | `begin`, `submit`, `block`, `resume` | 作業フェーズ移行（status 遷移 + assign + comment）を集約 |
| 横断ユーティリティ | `dashboard`, `preflight`, `integrity` | 状態俯瞰・終了前チェック・整合性検証 |
| Claude Code スキル | 30+ | `implement-flow`, `prepare-flow`, `design-flow`, `review-flow`, `commit-issue`, `open-pr-issue`, ... |
| Claude Code ルール | 18+ | Git, GitHub, ワークフロー, shirokuma-flow 規約 |
| ドキュメント生成 | `shirokuma-portal generate ...` | typedoc / schema / deps / portal / test-cases / feature-map / coverage / 他 |
| 検証 | `shirokuma-flow lint ...` / `shirokuma-lint ...` | tests / coverage / docs / code / annotations / structure / workflow / security |
| 管理・ユーティリティ | `init`, `update`, `repo pairs`, `git`, `hooks`, `skills`, `rules`, `skill` | プロジェクト初期化・プラグイン管理・Git 補助 |

全コマンドは [CLI クイックリファレンス](guide/reference/cli-quick-reference.md)、スキル・ルールは [プラグイン管理](guide/plugins.md)。

## バイナリ構成

shirokuma-flow は複数のバイナリに分かれている。`install.sh` は `shirokuma-flow` のみを入れる。生成系・lint 系は使うときに別途取得する。

| バイナリ | パッケージ | 用途 |
|---------|-----------|------|
| `shirokuma-flow` | `@shirokuma-library/shirokuma-flow` | GitHub ワークフロー管理（CLI のメイン） |
| `shirokuma-portal` | `@shirokuma-library/portal` | ドキュメント生成 |
| `shirokuma-lint` | `@shirokuma-library/lint` | コード・ドキュメント・テストの構造 lint |
| `shirokuma-md` | `@shirokuma-library/markdown` | LLM 最適化 Markdown 結合・lint |
| `shirokuma-codemap` | `@shirokuma-library/codemap` | コードマップ抽出（AI 用システム概要） |
| `shirokuma-context` | `@shirokuma-library/context` | 外部ドキュメントのローカル取得 |

## 動作要件

- **Node.js**: 20.0.0 以上
- **Claude Code**: スキル・ルール連携に必要
- **GITHUB_TOKEN**: GitHub コマンドに必要（`gh auth login` でも可）

## セキュリティに関する注記

shirokuma-flow は **Private リポジトリでの利用を推奨** する。GitHub Issues / PR / Discussions の本文を AI エージェントがそのまま処理するため、外部ユーザーが編集可能な Public リポジトリではプロンプトインジェクションのリスクがある。Public で使う場合は信頼できないコンテンツを含む可能性を考慮すること。

## ドキュメント

| ガイド | 内容 |
|--------|------|
| [Getting Started](guide/getting-started.md) | インストール・初期化・GitHub セットアップ |
| [入門ワークフローガイド](guide/workflows/getting-started-workflow.md) | 最初の Issue 作成から PR マージまで |
| [ワークフローガイド](guide/workflows/README.md) | AI への指示方法（Issue / 実装 / レビュー / セッション / ドキュメント） |
| [CLI クイックリファレンス](guide/reference/cli-quick-reference.md) | 全コマンド一覧（バイナリ別） |
| [設定ファイルリファレンス](guide/config.md) | `.shirokuma/config.yaml` の全項目 |
| [プラグイン管理](guide/plugins.md) | スキル・ルール・フックの管理 |
| [トラブルシューティング](guide/troubleshooting.md) | よくある問題と対処法 |

## ライセンス

Apache License 2.0 (詳細は [LICENSE](LICENSE) / [NOTICE](NOTICE))

サードパーティライセンスは [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
