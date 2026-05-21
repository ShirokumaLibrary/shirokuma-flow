# 実装

機能の実装・バグ修正・リファクタリングを AI に依頼する方法。

## このページでわかること

- 実装を依頼する際の指示の出し方
- 計画→（設計）→実装→コミット→PR の自動フロー
- TDD（テストファースト）の流れ
- 4 フェーズライフサイクル（Designing / Preparing / Working / Requirements）

## よくある指示パターン

### Issue を指定して実装する

**指示例:** `#42 に取り組んで`

**結果:** Claude Code が以下を自動的に順次実行する:

1. **計画策定**: `prepare-flow` が Issue の要件を分析し、実装計画を Issue 本文に書く（未計画の場合）
2. **設計**（必要な場合）: `design-flow` がアーキテクチャを詳細化する（`analyze-issue` の判定で起動）
3. **計画承認**: ユーザーが計画を確認して承認する
4. **作業開始**: `begin` checkpoint で Status を In progress に遷移、自己アサイン、フィーチャーブランチ作成
5. **TDD 実装**: テストを先に書き、実装を追加（`code-issue` に委任）
6. **コミット・プッシュ**: `commit-issue` が変更を自動コミット
7. **PR 作成**: `open-pr-issue` がプルリクエストを自動作成
8. **レビュー提出**: `submit` checkpoint で Status を Review に更新（作業サマリーを Issue コメントに投稿）

### 計画なしで直接実装する

計画が既に Issue 本文に書かれている場合は、計画策定をスキップして実装に進む。

**指示例:** `#42 の計画は承認済みなので実装して`

### 設計フェーズを明示する

**指示例:** `#42 の設計から始めて`

**結果:** `/design-flow #42` が起動し、アーキテクチャ設計とレビューを行う。設計確定後に `/prepare-flow` → `/implement-flow` に進む。

### UI デザインを依頼する

**指示例:** `印象的なランディングページをデザインして`

**結果:** `designing-shadcn-ui` スキルが起動し、shadcn/ui を使った独自デザインの UI を作成する。

```
/designing-shadcn-ui
```

### バグ修正を依頼する

**指示例:** `#15 のバグを修正して`

**結果:** Issue の内容を分析し、TDD でバグを再現するテストを書いてから修正する。

### 複数の小さい Issue をまとめて処理する

**指示例:** `#101 #102 #103 をまとめてやって`

**結果:** バッチモードが起動し、1 ブランチ・1 PR で複数の Issue を処理する（XS/S サイズの関連 Issue のみ対象）。

## 指示のコツ

- **要件を具体的に**: 「認証ページを作って」より「メール/パスワードのログインフォームを作って」の方が良い結果になる
- **制約を伝える**: 「shadcn/ui の Button を使って」「既存の auth.ts を修正して」など、制約を伝えると意図通りの実装になる
- **Issue に要件を書いておく**: Issue 本文に要件や背景が書いてあると、計画の精度が上がる

## 4 フェーズライフサイクル

shirokuma-flow の開発フローは 4 つのフェーズオーケストレーターで構成される。

| フェーズ | スキル | 責務 | 委任先 |
|---------|--------|------|-------|
| Designing | `design-flow` | 設計ルーティング・設計レビュー（必要な場合のみ） | `design-worker`, `review-worker` |
| Preparing | `prepare-flow` | 計画策定・計画レビュー | `plan-worker`, `review-worker` |
| Working | `implement-flow` | 実装・コミット・PR | `coding-worker`, `commit-worker`, `pr-worker` |
| Requirements（独立） | `requirements-flow` | 要件定義・ADR 作成・仕様策定（Issue 操作なし） | `requirements-worker` |

通常フロー:

- **設計が必要**: `issue-flow` → `/design-flow` → `/prepare-flow` → `/implement-flow`
- **設計不要 + サイズ M+**: `issue-flow` → `/prepare-flow` → `/implement-flow`
- **設計不要 + サイズ XS/S かつ要件明確**: `issue-flow` → `/implement-flow`（直接）

## 自動フローの全体像

```
## 起点
/issue-flow              Issue 作成 → 自動で次へ
  （または直接 /implement-flow #42）

## 計画フェーズ（未計画の場合）
prepare-flow                   計画策定
  └→ design-flow               設計（必要な場合のみ）
  ↓ ユーザーが計画を承認

## 実装フェーズ
implement-flow
  ├→ begin checkpoint          Status: In progress + assign + branch
  ├→ code-issue                TDD 実装
  ├→ commit-issue              コミット・プッシュ
  ├→ open-pr-issue             PR 作成
  ├→ 作業サマリー              Issue コメントに技術詳細を投稿
  └→ submit checkpoint         Status: Review に更新

## レビューフェーズ
/review-flow #N                レビューコメントへの対応（修正・返信・解決）
```

- `issue-flow` で Issue を作成すると、自動的に `implement-flow` にチェーンする
- `implement-flow` が未計画を検出した場合、計画フェーズが自動で起動する
- 計画済み Issue では実装フェーズから開始される
- レビューフェーズはレビューコメントが付いた後にユーザーが起動する
- チェーン完了時の作業サマリーは、次回の会話で Issue のコンテキストとして参照される

## 関連

- [Issue 管理](issue-management.md) — Issue の作成・管理
- [レビューと PR](review-and-pr.md) — レビューと PR の詳細
- [セッション管理](session-management.md) — checkpoint コマンド (`begin`, `submit`, `block`, `resume`)
- [CLI クイックリファレンス](../reference/cli-quick-reference.md) — コマンド一覧
