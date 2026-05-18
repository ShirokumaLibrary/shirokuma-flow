# @shirokuma-library/flow

AI 駆動の開発ワークフロー管理 CLI。GitHub Projects / Issues / Discussions と Claude Code スキルを統合し、計画 → 実装 → レビュー → リリースの開発サイクルを一元管理する。

## 機能

- **Issue / PR / Discussion / Project**: GitHub 管理コマンド群（`issue`, `pr`, `discussion`, `project`）。1 コマンドで Projects V2 フィールドまで含めて取得
- **Checkpoint**: `begin` / `submit` / `block` / `resume` で `status transition` + `issue assign` + `issue comment` を 1 操作にまとめる
- **横断ユーティリティ**: `dashboard`（アクティブ Issue + PR + git 状態）、`preflight`（セッション終了前データ）、`integrity`（Issue 状態と Project Status の整合性チェック）
- **プラグイン管理**: `init` / `update` でスキル・ルール・フックをマーケットプレース経由でインストール・更新
- **構造 lint**: `lint` サブコマンドで `tests / coverage / docs / code / annotations / structure / workflow / security` の機械チェック

## インストール

```bash
# ワンライナーインストーラ（推奨）
curl -fsSL https://raw.githubusercontent.com/ShirokumaLibrary/shirokuma-flow/main/install.sh | bash

# または npm
npm install -g @shirokuma-library/flow
```

ドキュメント生成系・Markdown 管理・コードマップ抽出・外部ドキュメント取得は別パッケージとして配布されている。必要に応じて個別にインストールする:

```bash
npm install -g @shirokuma-library/portal      # shirokuma-portal
npm install -g @shirokuma-library/lint        # shirokuma-lint
npm install -g @shirokuma-library/markdown    # shirokuma-md
npm install -g @shirokuma-library/codemap     # shirokuma-codemap
npm install -g @shirokuma-library/context     # shirokuma-context
```

## 使用方法

```bash
# プロジェクト初期化（設定ファイル + スキル + ルール一括インストール）
shirokuma-flow init --with-skills --with-rules --lang ja

# セッション開始時のダッシュボード
shirokuma-flow dashboard

# Issue を取得・着手・提出
shirokuma-flow issue pull 42
shirokuma-flow begin 42
shirokuma-flow submit 42

# 全コマンド一覧
shirokuma-flow --help
```

## ドキュメント

- [Getting Started](https://github.com/ShirokumaLibrary/shirokuma-flow/blob/main/guide/getting-started.md)
- [CLI クイックリファレンス](https://github.com/ShirokumaLibrary/shirokuma-flow/blob/main/guide/reference/cli-quick-reference.md)
- [GitHub 連携の仕組み](https://github.com/ShirokumaLibrary/shirokuma-flow/blob/main/guide/concepts/github-integration.md)
