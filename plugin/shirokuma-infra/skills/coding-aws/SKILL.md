---
name: coding-aws
description: AWS SDK を使ったアプリケーションコードの実装、または AWS サービス設定のセットアップガイダンスを提供する（IaC ではなく SDK コード・コンソール操作・AWS CLI ベースの作業）。Use when 「S3実装」「SES実装」「SNS実装」「SQS実装」「Cognito実装」「IAMロール設定」と言われたとき。
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# AWS コーディング

AWS SDK を使ったアプリケーションコードの実装、または AWS サービス設定・セットアップのガイダンスを提供する。

> **スコープ境界:** IaC（CDK コンストラクト、CloudFormation）は `coding-cdk` の責務。本スキルは SDK を使ったアプリケーションコード実装と、コンソール / AWS CLI ベースのサービス設定に集中する。

## スコープ

- **カテゴリ:** 変更系ワーカー
- **スコープ:** AWS SDK（v3）を使ったアプリケーションコードの実装（Write / Edit）、AWS CLI コマンドによるサービス設定ガイダンス（Bash）、環境別設定の管理。
- **スコープ外:** CDK コンストラクトの実装（`coding-cdk` に委任）、AWS リソース設計（`designing-aws` に委任）、docker-compose 設定（`coding-infra` に委任）

## 開始前に

1. プロジェクトの `CLAUDE.md` で使用 AWS サービスと SDK バージョンを確認
2. 既存の AWS SDK 設定ファイル（`src/lib/aws.ts` 等）を確認
3. `designing-aws` の設計成果物がある場合は読み込む
4. LocalStack エミュレーションが必要か確認（ローカル開発環境の設定）

## ワークフロー（判断の骨格）

具体的な SDK クライアント設定・サービス別コマンド・CLI セットアップ・エラーハンドリングの実装パターンは [reference/patterns/sdk-localstack-patterns.md](reference/patterns/sdk-localstack-patterns.md) を必要時に Read する。

### ステップ 1: 実装計画

進捗トラッカー（全ステップの一覧）を作成し、変更ファイルと確認事項を列挙する。開始時・完了時に状態を更新する。本 skill はタスク管理ツールを使わないので、手順表を応答本文に状態つき（`todo` / `in_progress` / `done`）で残し、更新のたびに書き直す。手順表は省かない。完了報告には、手順表で進めたことを書く。応答本文の手順表は Stop hook の検知に掛からないので、省いても機械では気づかれない。

```markdown
## 実装計画

### 変更ファイル
- [ ] `src/lib/aws-client.ts` - AWS クライアント設定
- [ ] `src/services/{service}.ts` - サービス実装

### 確認事項
- [ ] 環境別エンドポイント切り替え（LocalStack vs 本番）
- [ ] IAM 権限（必要な Action を最小権限で設定）
- [ ] エラーハンドリング（リトライ、タイムアウト）
- [ ] 型安全性（AWS SDK v3 の型定義活用）
```

### ステップ 2: AWS SDK クライアント設定

環境別エンドポイント切替（LocalStack / 本番）を `AWS_ENDPOINT_URL` ベースで実装する。
→ 切替コードパターンは reference の「SDK クライアント設定」節。

### ステップ 3: サービス別実装

対象サービス（S3 / SES / SQS / SNS / Cognito）の SDK v3 コマンドを選定して実装する。
→ サービス別の操作↔コマンド対応表は reference の「サービス別実装パターン」節。

### ステップ 4: AWS CLI セットアップガイダンス

コンソール / CLI ベースのサービス設定（IAM ロール・S3 バケット等）が必要な場合に提供する。
→ CLI コマンド集は reference の「AWS CLI セットアップガイダンス」節。

### ステップ 5: 検証

型チェック・LocalStack 動作確認・単体テストで検証する。
→ 検証/クイックコマンドは reference の「検証コマンド」「クイックコマンド」節。

### ステップ 6: 完了レポート

変更内容をコメントとして Issue に記録する。状態遷移は orchestrator が flow verb で行う。

## リファレンスドキュメント

| ドキュメント | 内容 | 読むタイミング |
|------------|------|--------------|
| [reference/patterns/sdk-localstack-patterns.md](reference/patterns/sdk-localstack-patterns.md) | SDK クライアント設定（LocalStack 切替）・サービス別 SDK コマンド・AWS CLI セットアップ・エラーハンドリング・検証コマンド | 実装の各ステップで具体パターンが必要な時 |

## 注意事項

- **CDK コードは実装しない** — IaC は `coding-cdk` の責務。本スキルは SDK コードとサービス設定に集中
- **IAM アクセスキーをコードに埋め込まない** — 環境変数 / Secrets Manager / OIDC を使用
- **LocalStack エンドポイント切り替えを忘れない** — `AWS_ENDPOINT_URL` 環境変数パターンを使用
- **AWS SDK v3 を使用** — v2（`aws-sdk`）は非推奨。`@aws-sdk/client-*` パッケージを使用
- **リージョンをハードコードしない** — `process.env.AWS_REGION` で環境変数から取得
