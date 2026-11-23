---
name: designing-infra
description: ローカル開発インフラの設計を行う。docker-compose サービス構成設計・マルチステージ Dockerfile 設計・サービス分割方針・ポート割り当て計画をカバー。Use when 「インフラ設計」「docker-compose設計」「ローカル環境設計」「コンテナ設計」「Dockerfile設計」「開発環境設計」と言われたとき。
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, WebFetch, WebSearch
model: opus
disable-model-invocation: true
---

# ローカル開発インフラ設計

docker-compose サービス構成、Dockerfile 設計、ローカル開発環境の構成方針を設計する。

> **スコープ境界:** `coding-infra` は docker-compose・スクリプトの実装を担い、本スキルは「何をどう構成するか」という設計判断を担う。AWS 本番環境の設計は `designing-aws` が担当する。

## スコープ

- **読み手:** 設計の起案をする作業セッションのメインが、SKILL.md と reference を Read で文書として読んで設計に併記する（Skill では起動しない。併用するかの判定は規範 `delegation-and-checks` の「拡張スキルの併用判定」）。
- **スコープ:** 既存の docker-compose・Dockerfile の読み取り（Read / Grep / Glob / Bash 読み取り専用）、インフラ設計ドキュメントの生成（Write/Edit — 設計成果物への書き込み）、Issue 本文への設計セクション追記。
- **スコープ外:** docker-compose の実装・修正（`coding-infra` に委任）、AWS 本番インフラ設計（`designing-aws` に委任）、CI/CD 設計（`designing-cicd` に委任）

> **設計成果物の書き込みについて**: この skill の観点で書くのは設計 Issue の本文・設計ドキュメント（設計の成果物）で、プロダクションコードは変えない。

## ワークフロー

### 0. 既存インフラ構成確認

**最初に**、プロジェクトの `CLAUDE.md` と既存ファイルを確認:

- 使用技術スタック（フレームワーク、ランタイム、DB 等）
- 既存 compose（base と断片）の構造とサービス一覧
- 既存 Dockerfile の構造（マルチステージ有無）
- ポート割り当て状況

```bash
find . -maxdepth 3 \( -name 'compose*.y*ml' -o -name 'docker-compose*.y*ml' \) -not -path '*/node_modules/*'  # 置き場は決め打ちしない。候補の名前は coding-infra の reference/patterns/infra-conventions.md「compose の置き場とファイル名」節
find . -name "Dockerfile*" | head -10
```

### 1. 設計コンテキスト確認

対象の課題と設計 Issue の本文から設計要件を把握する。設計の起案の段で読む回は、`design-flow` の設計雛形（`reference/templates/design-doc.md`）の Design Brief 節に書いた目的・制約・スコープに沿って、この skill の観点を当てる。

### 2. 設計フレームワーク適用（観点ごとに評価）

各設計観点を評価し、根拠を添えて決定する。各観点の詳細パターン（分類表・テンプレート・チェックリスト）は [reference/patterns/infra-design-patterns.md](reference/patterns/infra-design-patterns.md) を必要時に Read する。

| 設計観点 | 判断の骨格 | パターン参照 |
|---------|-----------|-------------|
| サービス構成 | サービスを分類し、依存（`depends_on`/`healthcheck`）・ネットワーク・ボリューム・環境変数・ポートを設計 | reference「サービス構成設計」 |
| Dockerfile 設計 | マルチステージ（base/deps/builder/runner）で本番イメージを最小化、ベースイメージは要件で選定 | reference「Dockerfile 設計」 |
| ポート割り当て | 既存ポート割り当てを確認し、競合を避けてホスト↔コンテナをマッピング | reference「サービス構成設計」 |

### 3. 設計出力・レビュー

設計出力テンプレート（サービス構成・ボリューム・Dockerfile・ポート・環境変数・決定事項）とレビューチェックリストは reference を参照して埋める。状態遷移は `design-flow` の段の順序で行う（この skill では打たない）。

## リファレンスドキュメント

| ドキュメント | 内容 | 読むタイミング |
|------------|------|--------------|
| [reference/patterns/infra-design-patterns.md](reference/patterns/infra-design-patterns.md) | サービス構成・Dockerfile マルチステージ・設計出力テンプレート・レビューチェックリスト | 各設計観点を詳細化する時・成果物を埋める時 |

## 次のステップ

設計の起案の段で併読した回は、`design-flow` の「段の順序」の続き（設計レビュー・承認）へ戻る。この skill は設計レビューと承認を行わない。

この skill だけを読んで設計した回の次のステップ:

```
ローカル開発インフラ設計完了。次のステップ:
-> coding-infra スキルで docker-compose を実装
-> フルワークフローが必要な場合は /design-flow を使用
```

## 注意事項

- 横断の決定を ADR に切り出したら、その What の着地は `docs-placement` 第 1 節の基準で判定し、カテゴリは `shirokuma-flow gate vocab --field adr-landing-category` から選ぶ（領域固有のカテゴリは無い）。
- **実装ファイルを生成しない** — 設計ドキュメントのみを出力。compose 等の実装は `coding-infra` の責務
- **AWS 本番設計には踏み込まない** — ローカル↔本番マッピングが必要な場合は `designing-aws` に委任
- ローカル開発環境はポート競合が起きやすい。既存ポート割り当てを確認してから設計する
- docker-compose の `version:` フィールドは v3.8+ で非推奨。`compose-spec` 準拠を推奨
