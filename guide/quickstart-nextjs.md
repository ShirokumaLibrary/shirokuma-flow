# Next.js クイックスタート

このチュートリアルでは、新規 Next.js プロジェクトをゼロから作成し、shirokuma-flow + Claude Code で Issue 駆動の開発を始めるまでを体験する。

## 前提条件

- [Getting Started](getting-started.md) の手順が完了している（shirokuma-flow インストール済み）
- Next.js の基礎知識がある
- Claude Code がインストール済み

## 1. プロジェクトを作成する

### 方法 A: shirokuma-flow でスキャフォールドする（推奨）

モノレポ構造（`apps/web`, `packages/database` 等）を自動生成する:

```bash
mkdir my-project && cd my-project
shirokuma-flow init --nextjs --with-nextjs --with-skills --with-rules --lang ja
```

`git init` も同時に実行される。`--with-nextjs` で `shirokuma-nextjs` プラグインのスキル（`coding-nextjs`, `designing-nextjs`, `designing-shadcn-ui`, `designing-drizzle` など）も追加される。

### 方法 B: create-next-app から始める

```bash
npx create-next-app@latest my-project --typescript --tailwind --app
cd my-project
shirokuma-flow init --with-nextjs --with-skills --with-rules --lang ja
```

### 推奨技術スタック

shirokuma-flow のスキル・ルールは以下のスタックを想定している（必須ではない）:

| カテゴリ | テクノロジー |
|----------|-------------|
| フロントエンド | Next.js / React / TypeScript |
| データベース | PostgreSQL + Drizzle ORM |
| 認証 | Better Auth |
| i18n | next-intl |
| スタイリング | Tailwind CSS + shadcn/ui |
| テスト | Jest + Playwright |

## 2. 設定ファイルを編集する

`.shirokuma/config.yaml` をプロジェクトに合わせて編集する:

```yaml
project:
  name: "my-project"
  description: "プロジェクトの説明"
  version: "0.1.0"
  repository: "https://github.com/your-org/my-project"

output:
  generated: "docs/generated"

testCases:
  jest:
    testMatch: ["**/__tests__/**/*.test.ts"]

github:
  discussionsCategory: "Knowledge"
```

全設定項目は [設定ファイルリファレンス](config.md) を参照。

## 3. GitHub をセットアップする

### リポジトリを作成する

```bash
# --nextjs でスキャフォールドした場合（git init 済み）
git add .
git commit -m "chore: initial commit"
gh repo create your-org/my-project --private --push

# 既存プロジェクトの場合
git init
git add .
git commit -m "chore: initial commit"
gh repo create your-org/my-project --private --push
```

### GitHub Projects V2 をセットアップする

Claude Code を起動し、`setting-up-project` スキルでプロジェクトを初期化する:

```
/setting-up-project
```

以下のフィールドが自動作成される:

| フィールド | 選択肢 |
|-----------|--------|
| Status | Backlog / ToDo / In progress / Blocked / Review / Done |
| Priority | Critical / High / Medium / Low |
| Type | Feature / Bug / Chore / Docs / Research / Evolution |
| Size | XS / S / M / L / XL |

CLI から手動でセットアップする場合:

```bash
shirokuma-flow project setup --lang ja
shirokuma-flow project setup-metrics    # メトリクス用 Text フィールドも追加
shirokuma-flow integrity --setup        # 設定状況を検証
```

### Discussion カテゴリを作成する

GitHub リポジトリの Settings > Features > Discussions を有効にし、以下のカテゴリを作成する:

| カテゴリ | 用途 |
|---------|------|
| ADR | アーキテクチャ決定記録 |
| Knowledge | 確認されたパターン・解決策 |
| Research | 調査事項 |

## 4. 開発を開始する

### セッションを開始する

Claude Code で作業セッションを開始する:

```
/starting-session
```

プロジェクトのデフォルトルールが読み込まれる。アクティブな Issue や PR を確認する場合は `/show-dashboard`（`showing-github` スキル）を実行する。

### Issue を作成して作業する

`/create-item-flow` で Issue を作成し、そのまま作業を開始する:

```
/create-item-flow 認証ページの実装
```

Issue が作成され、自動的に `/implement-flow` に引き継がれる。以下が順次実行される:

1. **計画**: `prepare-flow` が Issue の要件を分析し、実装計画を策定（未計画の場合）
2. **承認**: 計画を確認してユーザーが承認
3. **作業開始**: `begin` checkpoint で Status: In progress + 自己アサイン + ブランチ作成
4. **実装**: テストファースト（TDD）で機能を実装
5. **コミット**: 変更をコミット・プッシュ
6. **PR 作成**: プルリクエストを自動作成
7. **レビュー提出**: `submit` checkpoint で Status: Review に更新

既存の Issue に取り組む場合は Issue 番号を直接指定する:

```
/implement-flow #42
```

### 次の会話でコンテキストを継続する

次回同じ Issue の続きから始める場合:

```
/starting-session #N
```

前回 `implement-flow` が Issue コメントに投稿した作業サマリーを参照しながら作業を継続できる。

## 次のステップ

- AI への指示方法を知る → [ワークフローガイド](workflows/README.md)
- スキルとルールの詳細 → [プラグイン管理](plugins.md)
- 全コマンド一覧 → [CLI クイックリファレンス](reference/cli-quick-reference.md)
- 設定の全項目 → [設定ファイルリファレンス](config.md)
- 設計の背景を知る → [アーキテクチャ](concepts/architecture.md)
- 問題が起きたら → [トラブルシューティング](troubleshooting.md)
