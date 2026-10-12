---
name: designing-infra
description: ローカル開発インフラの設計を行う。docker-compose サービス構成設計・マルチステージ Dockerfile 設計・サービス分割方針・ポート割り当て計画をカバー。Use when 「インフラ設計」「docker-compose設計」「ローカル環境設計」「コンテナ設計」「Dockerfile設計」「開発環境設計」と言われたとき。
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, WebFetch, WebSearch
model: opus
---

# ローカル開発インフラ設計

docker-compose サービス構成、Dockerfile 設計、ローカル開発環境の構成方針を設計する。

> **スコープ境界:** `coding-infra` は docker-compose・スクリプトの実装を担い、本スキルは「何をどう構成するか」という設計判断を担う。AWS 本番環境の設計は `designing-aws` が担当する。

## スコープ

- **カテゴリ:** 調査系ワーカー
- **スコープ:** 既存の docker-compose・Dockerfile の読み取り（Read / Grep / Glob / Bash 読み取り専用）、インフラ設計ドキュメントの生成（Write/Edit — 設計成果物への書き込み）、Issue 本文への設計セクション追記。
- **スコープ外:** docker-compose の実装・修正（`coding-infra` に委任）、AWS 本番インフラ設計（`designing-aws` に委任）、CI/CD 設計（`designing-cicd` に委任）

> **設計成果物の書き込みについて**: このスキルが Issue 本文・設計ドキュメントに Write/Edit するのは設計プロセスの成果物であり、プロダクションコードの変更ではない。調査系ワーカーの例外として許可される。

## ワークフロー

### 0. 既存インフラ構成確認

**最初に**、プロジェクトの `CLAUDE.md` と既存ファイルを確認:

- 使用技術スタック（フレームワーク、ランタイム、DB 等）
- 既存 docker-compose.yml の構造とサービス一覧
- 既存 Dockerfile の構造（マルチステージ有無）
- ポート割り当て状況

```bash
cat docker-compose.yml 2>/dev/null || cat compose.yml 2>/dev/null
find . -name "Dockerfile*" | head -10
```

### 1. 設計コンテキスト確認

`design-flow` から委任された場合、Design Brief と要件が渡される。そのまま使用する。

スタンドアロンで起動された場合、Issue 本文と計画セクションから設計要件を把握する。

### 2. 設計フレームワーク適用（観点ごとに評価）

各設計観点を評価し、根拠を添えて決定する。各観点の詳細パターン（分類表・テンプレート・チェックリスト）は [reference/patterns/infra-design-patterns.md](reference/patterns/infra-design-patterns.md) を必要時に Read する。

| 設計観点 | 判断の骨格 | パターン参照 |
|---------|-----------|-------------|
| サービス構成 | サービスを分類し、依存（`depends_on`/`healthcheck`）・ネットワーク・ボリューム・環境変数・ポートを設計 | reference「サービス構成設計」 |
| Dockerfile 設計 | マルチステージ（base/deps/builder/runner）で本番イメージを最小化、ベースイメージは要件で選定 | reference「Dockerfile 設計」 |
| ポート割り当て | 既存ポート割り当てを確認し、競合を避けてホスト↔コンテナをマッピング | reference「サービス構成設計」 |

### 3. 設計出力・レビュー

設計出力テンプレート（サービス構成・ボリューム・Dockerfile・ポート・環境変数・決定事項）とレビューチェックリストは reference を参照して埋める。状態遷移は orchestrator が flow verb で行う。

## リファレンスドキュメント

| ドキュメント | 内容 | 読むタイミング |
|------------|------|--------------|
| [reference/patterns/infra-design-patterns.md](reference/patterns/infra-design-patterns.md) | サービス構成・Dockerfile マルチステージ・設計出力テンプレート・レビューチェックリスト | 各設計観点を詳細化する時・成果物を埋める時 |

## 次のステップ

`design-flow` 経由で呼ばれた場合、制御は自動的にオーケストレーターに戻る。

スタンドアロンで起動された場合:

```
ローカル開発インフラ設計完了。次のステップ:
-> coding-infra スキルで docker-compose を実装
-> フルワークフローが必要な場合は /design-flow を使用
```

## 注意事項

- 横断の決定を ADR に切り出したら、その What の着地は `docs-placement` 第 1 節の基準で判定し、カテゴリは `shirokuma-flow gate vocab --field adr-landing-category` から選ぶ（領域固有のカテゴリは無い）。
- **実装ファイルを生成しない** — 設計ドキュメントのみを出力。docker-compose.yml 等の実装は `coding-infra` の責務
- **AWS 本番設計には踏み込まない** — ローカル↔本番マッピングが必要な場合は `designing-aws` に委任
- ローカル開発環境はポート競合が起きやすい。既存ポート割り当てを確認してから設計する
- docker-compose の `version:` フィールドは v3.8+ で非推奨。`compose-spec` 準拠を推奨
