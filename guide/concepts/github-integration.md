# GitHub 連携の仕組み

shirokuma-flow が GitHub API をどのように統合し、AI 駆動の開発ワークフローに最適化しているかを説明する。

## 背景

AI と協働する開発では、GitHub から情報を取得するたびにコンテキストウィンドウを消費する。標準的な `gh` CLI では以下の問題が発生する:

- **複数コマンド呼び出し**: Issue 一覧の取得と Projects フィールドの取得が別コマンド。AI が 3〜4 回 CLI を呼ぶとそれだけでコンテキストが埋まる
- **GraphQL の複雑さ**: Projects V2 のフィールド取得には GraphQL が必要だが、AI が毎回 GraphQL クエリを組み立てるのはエラーの原因になる
- **セッション情報の分散**: アクティブ Issue、オープン PR、git 状態がそれぞれ異なる API・ソースに散在している

shirokuma-flow はこれらの問題を、独自の GitHub コマンド群で解決する。

## 仕組み

### 1コマンド = 必要な情報をすべて返す

shirokuma-flow の GitHub コマンドは、1 つの目的に必要な情報を内部で GraphQL/REST API を組み合わせて 1 回で返す。

| 場面 | `gh` CLI | shirokuma-flow |
|------|----------|----------------|
| Issue + Projects フィールド | 3〜4 コマンド | `issue pull <N>` 1 回 |
| セッション状態の取得 | 5+ コマンド | `dashboard` 1 回 |
| Issue ステータス更新 + assign + コメント | 3 コマンド | `begin` / `submit` / `block` / `resume` 1 回 |
| Issues + PR + Discussions 検索 | 2 コマンド | `issue search` 1 回 |

例えば `issue list` は、Issues の一覧に加えて Status, Priority, Size, Type の Projects V2 フィールドも同時に返す。`gh issue list` ではこの情報を得るために追加の GraphQL クエリが必要になる。

### Projects V2 フィールド統合

GitHub Projects V2 はフィールド管理に GraphQL API を使用する。shirokuma-flow はこの複雑さを内部に隠蔽する。

```
Issue 取得（GraphQL）
  ↓ 同時に
Project Item 取得 → フィールド定義照合
  ↓
Status / Priority / Size / Type をマージして出力
```

**取得フロー**:

1. GraphQL で Issues と Project Items を 1 クエリで同時取得
2. `getProjectFields()` でプロジェクトのフィールド定義（選択肢名と ID のマッピング）を取得
3. Issue ごとに Project Item のフィールド値を名前解決してマージ
4. JSON 形式で構造化出力

この統合により、AI は `issue pull 42` を 1 回呼ぶだけで Issue の本文、ラベル、ステータス、優先度、サイズをすべて取得できる。

### Dashboard / Preflight / Integrity

セッション管理は責務ごとに 3 つのコマンドに分かれている:

| コマンド | 内容 |
|---------|------|
| `dashboard` | アクティブ Issue + オープン PR + git 状態を 1 回で取得（旧 `session start` 相当） |
| `preflight` | セッション終了前のデータを一括取得（旧 `session preflight` 相当） |
| `integrity [--fix] [--setup]` | Issue 状態と Project Status の整合性チェック・修正・セットアップ検証（旧 `session check` 相当） |

| 情報 | ソース | 取得方法 |
|------|--------|---------|
| Git 状態 | ローカルリポジトリ | simpleGit |
| アクティブ Issue | Issues + Projects V2 | GraphQL |
| オープン PR | Pull Requests | REST API |

ステータスの遷移は **checkpoint コマンド**（`begin` / `submit` / `block` / `resume`）に集約され、`status transition` + `issue assign` + `issue comment` を 1 操作にまとめる。

セッション間のコンテキスト引き継ぎは **Issue 一元化方針**に沿い、`In progress` Issue の本文（計画）と Issue コメント（作業サマリー）が担う。

### クロスリポジトリ操作

shirokuma-flow は 2 つの方式で複数リポジトリを操作する:

**crossRepos（エイリアス方式）**: 別のリポジトリをエイリアスで参照する。`issue list --repo frontend` のように使用する。

```yaml
# .shirokuma/config.yaml
crossRepos:
  frontend: "my-org/frontend-app"
  backend: "my-org/backend-api"
```

**repoPairs（ペア方式）**: 同一プロジェクトの Private/Public リポジトリをペアとして管理する。`--public` フラグで公開リポジトリ側に操作を切り替える。

```yaml
repoPairs:
  main:
    private: "OrgDev/project"
    public: "OrgLib/project"
```

どちらの方式でも、`issue`, `discussion`, `pr`, `project` 等の主要コマンドがそのまま使える。

### Discussions の活用

GitHub Discussions を知識の永続化先として体系的に活用する:

| カテゴリ | 用途 | 作成タイミング |
|---------|------|-------------|
| ADR | アーキテクチャ決定記録 | 設計判断の確定時 |
| Knowledge | 確認されたパターン・解決策 | パターンの定着時 |
| Research | 調査事項 | 調査開始時 |

知識は `Research → ADR（決定がある場合）→ Knowledge → Rule 抽出` のフローで成熟する。Discussion にアイデアを記録し、実装が決まった段階で Issue に変換する。

## 設計判断

### なぜ `gh` CLI のラッパーではないか

shirokuma-flow は `gh` CLI をラップするのではなく、GitHub API（GraphQL / REST）を直接使用する。理由は 3 つある:

1. **Projects V2 フィールドの制約**: `gh` CLI は Issue ビューで Projects フィールドを公開していない。Status, Priority, Size を取得するには GraphQL が必要
2. **1 回の API 呼び出しで完結**: `gh` CLI を複数回呼ぶと各呼び出しが独立した認証・HTTP 接続を行う。直接 API を叩くことで 1 回の GraphQL で完結できる
3. **出力形式の統一**: JSON 形式で構造化出力し、AI がパースしやすい形式に統一する。`gh` CLI の出力は人間向けのテキスト形式が混在する

### 構造化出力と AI パーサビリティ

すべての GitHub コマンドは JSON 形式で出力する。AI が出力をそのまま構造的に解釈できるため、テキストの正規表現パースによるエラーを排除する。

### Issue Types の管理方式

Issue の種別（Feature, Bug, Chore 等）は GitHub Organization の Issue Types 機能で管理する。Projects V2 の SingleSelect フィールドではなく Issue Types を採用した理由:

- GitHub が "Type" をフィールド名として予約しており、カスタム SingleSelect で "Type" を作成できない
- Issue Types は Issue 自体に紐付く（Project に紐付けなくても種別が残る）
- CLI で `--issue-type Feature` と自然に指定できる

## 関連ドキュメント

- [アーキテクチャ](architecture.md) — 3 層アーキテクチャの全体像
- [Issue 管理ワークフロー](../workflows/issue-management.md) — AI への Issue 管理の指示方法
- [セッション管理ワークフロー](../workflows/session-management.md) — セッション管理の指示方法
- [CLI クイックリファレンス](../reference/cli-quick-reference.md) — 全コマンドの構文
- [設定ファイルリファレンス](../config.md) — `github`, `crossRepos`, `repoPairs` の設定項目
