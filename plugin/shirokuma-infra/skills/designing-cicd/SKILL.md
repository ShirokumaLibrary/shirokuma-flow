---
name: designing-cicd
description: CI/CD パイプラインのアーキテクチャ設計を行う。ワークフロー構成設計・デプロイ戦略選択・環境分離設計・OIDC 認証設計をカバー。Use when 「CI/CD設計」「パイプライン設計」「デプロイ戦略設計」「GitHub Actions設計」「環境分離設計」「デプロイアーキテクチャ」と言われたとき。
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, WebFetch, WebSearch
model: opus
disable-model-invocation: true
---

# CI/CD パイプライン設計

GitHub Actions を使った CI/CD パイプラインのアーキテクチャ設計、デプロイ戦略選択、環境分離設計を行う。

> **スコープ境界:** `coding-cicd` は GitHub Actions ワークフローファイルの実装を担い、本スキルはパイプライン構成の設計判断（何をどう設計するか）を担う。

## スコープ

- **読み手:** 設計の起案をする作業セッションのメインが、SKILL.md と reference を Read で文書として読んで設計に併記する（Skill では起動しない。併用するかの判定は規範 `delegation-and-checks` の「拡張スキルの併用判定」）。
- **スコープ:** 既存ワークフローの読み取り（Read / Grep / Glob / Bash 読み取り専用）、CI/CD 設計ドキュメントの生成（Write/Edit — 設計成果物への書き込み）、Issue 本文への設計セクション追記。
- **スコープ外:** GitHub Actions ワークフローファイルの実装（`coding-cicd` に委任）、CDK コンストラクト設計（`designing-cdk` に委任）、AWS リソース設計（`designing-aws` に委任）

> **設計成果物の書き込みについて**: この skill の観点で書くのは設計 Issue の本文・設計ドキュメント（設計の成果物）で、プロダクションコードは変えない。

## ワークフロー

### 0. 既存 CI/CD 構成確認

**最初に**、プロジェクトの `CLAUDE.md` と既存ファイルを確認:

- 既存の `.github/workflows/` ディレクトリの内容
- デプロイ先（AWS ECS / Lambda / Vercel 等）
- ブランチ戦略（develop / staging / main 等）
- 使用パッケージマネージャーとロックファイル

```bash
ls -la .github/workflows/ 2>/dev/null
cat .github/workflows/*.yml 2>/dev/null | head -50
```

### 1. 設計コンテキスト確認

対象の課題と設計 Issue の本文から設計要件を把握する。設計の起案の段で読む回は、`design-flow` の設計雛形（`reference/templates/design-doc.md`）の Design Brief 節に書いた目的・制約・スコープに沿って、この skill の観点を当てる。

### 2. 設計フレームワーク適用（観点ごとに評価）

各設計観点を評価し、根拠を添えて決定する。各観点の詳細パターン（比較表・テンプレート・チェックリスト）は [reference/patterns/cicd-design-patterns.md](reference/patterns/cicd-design-patterns.md) を必要時に Read する。

| 設計観点 | 判断の骨格 | パターン参照 |
|---------|-----------|-------------|
| パイプライン構成 | CI（lint/test/build）と CD（環境別デプロイ）を分け、ジョブの並列化と依存（`needs:`）を設計 | reference「パイプライン構成設計」 |
| デプロイ戦略 | 高可用性 → Blue/Green・Canary、シンプル → Rolling、DB スキーマ変更 → Recreate（ダウンタイム不可なら 3 段分割で他戦略とも両立） | reference「デプロイ戦略選択」 |
| DB マイグレーション適用 | DB を持つなら 4 軸（実行媒体・打つ位置・失敗時の扱い・ネットワーク）を決めて成果物に残す。持たないなら「該当なし」と明記 | reference「DB マイグレーション適用設計」 |
| 環境分離 | dev/staging/prod を GitHub Environments で分け、prod は manual approval 必須 | reference「環境分離設計」 |
| OIDC 認証 | IAM 長期キーを使わず OIDC フェデレーションで一時クレデンシャルを取得 | reference「OIDC 認証設計」 |

### 3. 設計出力・レビュー

設計出力テンプレート（ワークフロー一覧・CI/CD ジョブ・OIDC ロール・決定事項）とレビューチェックリストは reference を参照して埋める。状態遷移は `design-flow` の段の順序で行う（この skill では打たない）。

## リファレンスドキュメント

| ドキュメント | 内容 | 読むタイミング |
|------------|------|--------------|
| [reference/patterns/cicd-design-patterns.md](reference/patterns/cicd-design-patterns.md) | パイプライン構成・デプロイ戦略・環境分離・OIDC 認証・設計出力テンプレート・レビューチェックリスト | 各設計観点を詳細化する時・成果物を埋める時 |

## 次のステップ

設計の起案の段で併読した回は、`design-flow` の「段の順序」の続き（設計レビュー・承認）へ戻る。この skill は設計レビューと承認を行わない。

この skill だけを読んで設計した回の次のステップ:

```
CI/CD パイプライン設計完了。次のステップ:
-> coding-cicd スキルで GitHub Actions ワークフローを実装
-> フルワークフローが必要な場合は /design-flow を使用
```

## 注意事項

- 横断の決定を ADR に切り出したら、その What の着地は `docs-placement` 第 1 節の基準で判定し、カテゴリは `shirokuma-flow gate vocab --field adr-landing-category` から選ぶ（領域固有のカテゴリは無い）。
- **ワークフローファイルを生成しない** — 設計ドキュメントのみを出力。YAML 実装は `coding-cicd` の責務
- **CDK デプロイ詳細には踏み込まない** — CDK コンストラクト設計が必要な場合は `designing-cdk` に委任
- prod 環境への自動デプロイ（manual approval なし）は設計段階でユーザーに確認する
- GitHub Environments の `environment:` 名は GitHub Settings の環境名と完全一致が必要
