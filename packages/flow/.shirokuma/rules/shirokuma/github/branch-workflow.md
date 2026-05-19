---
scope: default
category: github
priority: required
---

<!-- managed-by: shirokuma-flow@0.1.0 -->

# ブランチワークフロー

## ブランチモデル

| ブランチ | 役割 | 分岐元 | マージ先 | 永続 | 保護 |
|----------|------|--------|----------|------|------|
| `main` | 本番リリース（タグ付け） | — | — | はい | はい |
| `develop` | 統合（PR デフォルト） | `main`（初期） | `main`（リリース PR） | はい | はい |
| `feat/*`, `fix/*`, `chore/*`, `docs/*` | 日常作業 | `develop` | `develop`（PR） | いいえ | いいえ |
| `hotfix/*` | 緊急本番修正 | `main` | `main`（PR）→ `develop` にチェリーピック | いいえ | いいえ |
| `epic/*` | エピック統合（integration） | `develop` | `develop`（最終 PR） | いいえ | いいえ |
| `release/X.x` | 旧メジャーバージョン保守（必要時のみ） | tag | ブランチ上に留まる（tag） | 条件付き | はい |

**基本原則:**
- `develop` = GitHub 上の**デフォルトブランチ**（PR ターゲット）
- `main` は**本番状態**のみを反映
- フィーチャーブランチは常に `develop` から分岐
- `develop` や `main` への直接コミット禁止

## ベースブランチ検出

日常作業のベースブランチは `develop`。動的に検出する:

```bash
git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@'
```

上記が失敗する場合（shallow clone 等）のフォールバック:

```bash
gh repo view --json defaultBranchRef -q .defaultBranchRef.name
```

## ブランチ命名

### フィーチャーブランチ

```
{type}/{issue-number}-{slug}
```

| Type | 用途 |
|------|------|
| `feat` | 機能追加、機能拡張 |
| `fix` | バグ修正 |
| `chore` | 設定、リファクタ、調査 |
| `docs` | ドキュメント |

**slug ルール:** Issue タイトルから生成、小文字ケバブケース、最大40文字、英語のみ。

**例:**
```
feat/39-branch-workflow-rules
fix/34-cross-repo-project-resolution
chore/27-plugin-directory-structure
docs/32-session-naming-convention
```

### バッチブランチ

```
{type}/{issue-numbers}-batch-{slug}
```

複数の XS/S Issue をまとめて処理する場合に使用。詳細は `batch-workflow` ルール参照。

**type の決定:** 単一 type → その type を使用。混在 → `chore`。

### Integration ブランチ（エピック）

```
epic/{parent-issue-number}-{slug}
```

- `develop` から分岐し、サブ Issue のブランチは integration ブランチから分岐する
- サブ Issue の PR は integration ブランチをベースにする
- 全サブ Issue 完了後、integration ブランチから `develop` への最終 PR を作成

詳細は `epic-workflow` リファレンス参照。

### ホットフィックスブランチ

```
hotfix/{issue-number}-{slug}
```

`main` から分岐。`develop` ではない。緊急本番修正のみに使用。

### リリース保守ブランチ

```
release/{major}.x
```

旧メジャーバージョンにパッチが必要な場合にタグから作成。通常のリリースでは使用しない。

## 日常ワークフロー

1. `develop` から分岐
2. セッション中にコミット
3. ブランチをプッシュし `develop` への PR を作成
4. レビュー → マージ

### 1. ブランチ作成（セッション開始時）

```bash
git checkout develop
git pull origin develop
git checkout -b {type}/{issue-number}-{slug}
```

### 2. 開発（セッション中）

- 説明的なメッセージで頻繁にコミット
- コミットに Issue 番号を参照: `feat: ブランチワークフロールールを追加 (#39)`
- 既存のコミットメッセージ規約に従う

### 3. PR 作成（セッション終了時）

```bash
git push -u origin {branch-name}
shirokuma-flow pr create --from-file /tmp/shirokuma-flow/pr.md
```

- PR タイトル: 簡潔なサマリー（70文字以内）
- Issue リンク: 本文に `Closes #{number}` または `Refs #{number}` を含める
- ステータスは **Review** へ

### 4. レビューとマージ

- ユーザーが GitHub で PR をレビュー
- **AI はユーザーの明示的な指示なしに PR をマージしてはならない** — PreToolUse フックで強制
- スカッシュマージ（推奨）はユーザー承認後のみ
- マージ後にブランチを削除、ステータスは **Done** へ

## ルール

1. **常に `develop` から分岐**（最新化してから。例外: サブ Issue は integration ブランチから分岐）
2. **1 Issue 1ブランチ**（例外: バッチモードは `batch-workflow` ルール、エピックは `epic-workflow` リファレンス参照）
3. **セッション終了前にプッシュ** — プッシュしていない作業は消失リスクあり
4. **マージには PR が必要**（直接プッシュ禁止）
5. **ユーザー承認なしにマージしない**（PreToolUse フックで強制）
6. **マージ後にブランチ削除** — リポジトリを清潔に保つ
7. **日常作業の PR は `develop` へ** — `main` を直接ターゲットにするのはホットフィックスのみ
8. **全リリースにタグ付け** — 全バージョンを `main` 上のタグとして記録

## 破壊的コマンド保護

PreToolUse フックが破壊的コマンドの実行前に**ブロック**する。これは助言ではなく、ツールレベルでの拒否。

### デフォルトブロックコマンド

| Rule ID | ブロック対象 | 理由 |
|---------|-------------|------|
| `pr-merge` | `gh pr merge` / `pr merge` | PR マージにはユーザー承認が必要 |
| `force-push` | `git push --force` / `git push -f` | 強制プッシュはリモート履歴を上書き |
| `hard-reset` | `git reset --hard` | 未コミットの変更をすべて破棄 |
| `discard-worktree` | `git checkout .` / `git restore .` | ワーキングツリーの変更を破棄 |
| `clean-untracked` | `git clean -f` | 未追跡ファイルを削除 |
| `force-delete-branch` | `git branch -D` | ブランチを強制削除 |

### プロジェクトオーバーライド

`.shirokuma/config.yaml` で特定のコマンドを許可できる:

```yaml
hooks:
  allow:
    - pr-merge
    # - force-push
    # - hard-reset
```

### 誤検知防止

フックはパターンマッチ前にクォート文字列を除去する。`--body "..."` 等の引数内のテキストはブロックをトリガーしない。

## 中断ワークフロー

Issue の作業をコンテキストスイッチ、ブロック、優先度変更などで完了せずに中断する場合:

### 手順

```bash
# 1. PR をマージせずにクローズ（理由をコメントとして追加）
shirokuma-flow pr close <pr-number> --body-file - <<'EOF'
中断理由: <理由>
作業途中です。feat/N-slug ブランチから再開可能です。
EOF

# 2. Issue をキャンセル（ステータスを Cancelled に設定）
shirokuma-flow issue cancel <issue-number> --body-file - <<'EOF'
<見送り理由>
EOF

# 3. ローカルをベースブランチに切り替え
git checkout develop
```

ブランチが不要な場合は `pr close` に `--delete-branch` を追加できる。

## エッジケース

| 状況 | アクション |
|------|----------|
| すでにフィーチャーブランチ | 続行、ブランチ作成をスキップ |
| 1セッションに複数 Issue | ブランチを分ける、または関連項目をグループ化 |
| develop に未コミット変更 | スタッシュまたはコミット後にブランチ作成 |
| Issue のブランチが既存 | 既存ブランチに切り替え |
| develop とコンフリクト | PR 前にリベース: `git rebase develop` |
| デフォルトブランチが未変更（`main`のまま） | デフォルトブランチ設定手順参照 |
| 本番で緊急修正が必要 | ホットフィックスワークフローを使用 |
| サブ Issue で integration ブランチが見つからない | `develop` をベースにし警告 |
| 作業をセッション途中で中断する必要がある | 上記の中断ワークフローを使用 |

デフォルトブランチ設定・ホットフィックスワークフロー・リリースワークフロー・保守ブランチの詳細手順は `managing-github-items` スキル実行時に自動ロードされる。
