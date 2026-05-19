---
paths:
  - ".claude/skills/**/*.md"
# スコープ注記: このルールは意図的に 'scope: default' ではなく 'paths'（スキルファイルスコープ）を使用している。
# 根拠: 出力先の決定はスキルの作成・編集時にのみ関係する。
# グローバルにロード（scope: default）するとスキル以外のコンテキストでノイズになる。
# .claude/skills/**/*.md の読み書き時（スキルコンテキスト）が正しいロードポイントである。
---

# 出力先ルール

## 概要

Claude Code のスキルは2種類の出力を生成する。それぞれを適切な出力先にルーティングする。

## 出力タイプ

| タイプ | 出力先 | 寿命 |
|--------|--------|------|
| **作業レポート**（レビュー、lint結果） | GitHub Discussions (Reports) | 一時的 |
| **最終ドキュメント**（API、アーキテクチャ） | shirokuma-flow ポータル | 永続的 |

## 作業レポート → Discussions

**用途**: レビューレポート、実装進捗、lint 結果

```bash
shirokuma-flow discussion add /tmp/shirokuma-flow/report.md
```

**特徴**: 作業セッション中に作成、人間の確認用、定期的にクリーンアップ可能

## 最終ドキュメント → ポータル

**用途**: 完成した機能ドキュメント、API リファレンス、アーキテクチャ図

```bash
shirokuma-flow generate portal -p . -o docs/portal
```

**特徴**: 作業完了後に作成、永続的なプロジェクトドキュメント、コードアノテーションから自動生成

## ローカルログからの移行

**旧パターン**（非推奨）:
```
logs/reports/YYYY-MM-DD-*.md
logs/reviews/YYYY-MM-DD-*.md
```

**新パターン**:
```
作業レポート → GitHub Discussions (Reports)
最終ドキュメント → shirokuma-flow ポータル
```

## スキル更新時の対応

スキルを更新する際、ローカルログ参照を置換：

| 旧 | 新 |
|----|-----|
| `logs/reports/ に保存` | `Reports カテゴリに Discussion を作成` |
| `logs/reviews/ に保存` | `Reports カテゴリに Discussion を作成` |
| レポートファイルパス出力 | Discussion URL 出力 |

## PR レビュー → PR コメント

PR を対象としたレビュー結果は、PR コメントに直接投稿する。

```bash
shirokuma-flow issue comment {PR#} /tmp/shirokuma-flow/{PR#}-review-summary.md
```

| 条件 | 出力先 |
|------|--------|
| PR レビュー（通常） | PR コメント（サマリー） |
| PR レビュー（error 5件以上） | PR コメント + Discussion（詳細） |
| ファイル/ディレクトリレビュー | Discussion (Reports) |

## Reports カテゴリの用途

| 用途 | 例 |
|------|-----|
| 包括的レビューレポート | プロジェクト全体のセキュリティ監査 |
| 調査・リサーチ結果 | ベストプラクティス調査、技術比較 |
| 自己レビューフィードバック | 自動レビューループからのパターン蓄積 |


**Reports カテゴリに保存しないもの**: PR 固有のレビュー結果（→ PR コメントに投稿）

## 調査・設計成果物の記録先（#2251）

調査・設計フェーズで AI が生成する中間成果物（処理フロー詳細、副作用マトリクス、理想設計書、ギャップ分析等）は、消去法で Issue コメントに投稿すると時系列で埋もれて構造化・検索・更新が困難になる。成果物の性質に応じて記録先を選び分ける。

### 記録先マッピング

| 成果物タイプ | 記録先 | 根拠 |
|------------|--------|------|
| 処理フロー詳細・副作用マトリクス・ギャップ分析 | **Discussion (Reports)** | 構造化された参照リソース。検索可能で URL 参照しやすい |
| ベストプラクティス調査・技術選定比較 | **Discussion (Research)** | `researching-best-practices` の既定出力先。後で再利用される調査ナレッジ |
| 理想設計書・アーキテクチャ提案 | **Discussion (Knowledge)** または ADR (`write-adr`) | 永続的に参照され、後続で更新される可能性が高い |
| 計画 | **計画 Issue（子 Issue）の本文** | `plan-issue` が `計画: {タイトル}` の子 Issue として永続化。親 Issue 本文の `## 計画` セクションは後方互換扱い |
| 要件・意思決定 | **Discussion / ADR** | `requirements-flow` の責務。Issue 本文の特定セクションは規約として持たない |
| 一時的な作業メモ・確認ログ | **Issue コメント** | 時系列でよく、参照頻度が低い情報 |
| 最終的な API リファレンス・アーキテクチャドキュメント | **`docs/` 配下のファイル** または **shirokuma-flow ポータル** | リポジトリに永続化。コードと一緒にバージョン管理 |

### 判定フロー

1. **永続的に参照されるか？** → Yes: Discussion (Knowledge) または `docs/` / ADR を選択
2. **ベストプラクティス調査結果か？** → Yes: Discussion (Research)
3. **構造化された参照リソースか？** → Yes: Discussion (Reports)
4. **計画か？** → Yes: `plan-issue` 経由で計画 Issue（子 Issue）を作成
5. **要件・意思決定か？** → Yes: `requirements-flow` 経由で Discussion / ADR
6. **時系列で残る一時情報か？** → Yes: Issue コメント

判定がいずれにも該当しない場合は **Discussion (Reports)** をデフォルトとする。Issue コメントは「他に該当先がない」場合のフォールバック扱い。

### 過去事例

#1910 系の調査タスクでは、処理フロー詳細・副作用マトリクスを Issue コメントに投稿した結果、時系列で埋もれて再利用が困難になった。これは積極的な設計判断ではなく「コード変更なし」の消去法で残った選択であり、本ルールにより再発を防ぐ。

### 関連スキル

- `analyze-issue`（plan/requirements/design/research の各ロール）の出力
- `researching-best-practices` の調査結果（Discussion (Research) を既定とする）
- `designing-generic`（`shirokuma-skills` 標準）と `designing-nextjs` / `designing-shadcn-ui` / `designing-drizzle`（`shirokuma-nextjs` plugin）等の設計スキルの成果物

これらのスキルは本ルールに従い、生成する成果物の性質に応じて記録先を選択する。

## ルール

- **ローカルファイルなし**: レポートをリポジトリに保存しない
- **ブラウザフレンドリー**: GitHub Discussions で人間が簡単にレビュー
- **明確な分離**: 一時的（Discussions）vs 永続的（ポータル）
- **PR レビュー → PR コメント**: PR 対象のレビューは PR に直接投稿
- **調査・設計成果物は Issue コメントに偏らない**: 上記マッピングに従って記録先を選ぶ
