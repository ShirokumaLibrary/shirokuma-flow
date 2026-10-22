# AWS SDK / LocalStack 実装パターン

coding-aws の SDK クライアント設定・環境別エンドポイント切替・サービス別操作・AWS CLI セットアップ・エラーハンドリングの詳細パターン集。SKILL.md 本文の判断骨格を補う実装リファレンス。

## SDK クライアント設定: 環境別エンドポイント切替（LocalStack vs 本番）

ローカル（LocalStack）と本番の切り替えは、`isLocal` フラグでエンドポイント・クレデンシャル・path style を分岐する。

```typescript
import { S3Client } from '@aws-sdk/client-s3';

const isLocal = process.env.NODE_ENV === 'development';

export const s3Client = new S3Client({
  region: process.env.AWS_REGION, // 既定のリージョンを持たない（環境変数にも共有設定の profile にも region が無いときは SDK がエラーにする）
  ...(isLocal && {
    endpoint: process.env.AWS_ENDPOINT_URL ?? 'http://localhost:4566',
    credentials: {
      accessKeyId: 'test',
      secretAccessKey: 'test',
    },
    forcePathStyle: true,  // LocalStack 必須
  }),
});
```

要点:
- エンドポイント・クレデンシャルは `AWS_ENDPOINT_URL` 環境変数パターンで切り替える（コードに条件をハードコードしない）。
- `forcePathStyle: true` は LocalStack で S3 を使う場合に必須。
- リージョンは `process.env.AWS_REGION` から取得（ハードコードしない）。SDK v3 は `AWS_DEFAULT_REGION` を読まないので、`.env` には `AWS_REGION` を置く（`coding-infra` の LocalStack の `.env` の雛形は両方を置く）。

### 接続と要求のタイムアウトを明示し、例外として返るかを確かめる

```typescript
import { NodeHttpHandler } from '@smithy/node-http-handler';

export const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  requestHandler: new NodeHttpHandler({
    connectionTimeout: 3_000,      // 接続を張るまで
    requestTimeout: 10_000,        // 要求と応答の全体
    throwOnRequestTimeout: true,   // これが無いと requestTimeout は警告を出すだけで、要求は待ち続ける
  }),
});
```

- `@smithy/node-http-handler` は SDK が間接に入れる依存なので、厳密に解決するパッケージマネージャ（pnpm の既定など）では `package.json` に直接の依存として足す（足さないと import が解決できない）。
- **何を防ぐか**: 既定はどちらのタイムアウトも 0（無効）で、相手が接続を受けたまま応答しないと要求が終わらない。要求を待つ処理（リクエストの処理・キューの消費）が詰まり、上流のタイムアウトが先に切れて原因が見えなくなる。
- **例外として返るかを確かめる**: タイムアウトを書いただけでは足りない。受け付けるだけで応答しないサーバ（`net.createServer(() => {})` を手元で立てる）へ向けて要求を送り、`TimeoutError` で reject されることをテストで確かめる。`requestTimeout` だけを付けた形は警告を 1 行出して待ち続ける。
- 追試状況: 実測（`@smithy/node-http-handler` 4.12.1。応答しないサーバへの要求は、`throwOnRequestTimeout` 無しでは 5 秒たっても終わらず、付けると 1 秒で `TimeoutError`）。版で既定が変わりうるので、使う版で上のテストを回す。

## サービス別実装パターン（SDK v3 コマンド）

### S3 操作

| 操作 | SDK コマンド | 用途 |
|-----|------------|------|
| ファイルアップロード | `PutObjectCommand` | 画像・ドキュメントのアップロード |
| ファイル取得 | `GetObjectCommand` | ファイルダウンロード |
| 署名付き URL 生成 | `getSignedUrl + GetObjectCommand` | 一時ダウンロード URL |
| バケット一覧 | `ListBucketsCommand` | 管理操作 |
| オブジェクト削除 | `DeleteObjectCommand` | クリーンアップ |

### SES メール送信

| 操作 | SDK コマンド | 用途 |
|-----|------------|------|
| メール送信 | `SendEmailCommand` | トランザクションメール |
| テンプレートメール | `SendTemplatedEmailCommand` | 動的コンテンツメール |

### SQS メッセージング

| 操作 | SDK コマンド | 用途 |
|-----|------------|------|
| メッセージ送信 | `SendMessageCommand` | キューへのエンキュー |
| メッセージ受信 | `ReceiveMessageCommand` | キューからのデキュー |
| メッセージ削除 | `DeleteMessageCommand` | 処理完了後の削除 |

### SNS 通知

| 操作 | SDK コマンド | 用途 |
|-----|------------|------|
| 通知発行 | `PublishCommand` | トピックへの発行 |
| サブスクライブ | `SubscribeCommand` | エンドポイント登録 |

### Cognito 認証

| 操作 | SDK コマンド | 用途 |
|-----|------------|------|
| ユーザー登録 | `SignUpCommand` | セルフサービス登録 |
| 認証 | `InitiateAuthCommand` | ログイン |
| トークン更新 | `InitiateAuthCommand (REFRESH_TOKEN)` | セッション延長 |

## AWS CLI セットアップガイダンス

コンソール操作または CLI ベースのサービス設定が必要な場合のパターン。

### IAM ロール設定

```bash
# OIDC プロバイダーの作成（GitHub Actions 用）
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list {thumbprint}

# IAM ロールの作成
aws iam create-role \
  --role-name {role-name} \
  --assume-role-policy-document file://trust-policy.json
```

### S3 バケット設定

```bash
# バケット作成
aws s3api create-bucket \
  --bucket {bucket-name} \
  --region {region} \
  --create-bucket-configuration LocationConstraint={region}

# バケットの暗号化設定
aws s3api put-bucket-encryption \
  --bucket {bucket-name} \
  --server-side-encryption-configuration '{
    "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]
  }'

# パブリックアクセスブロック
aws s3api put-public-access-block \
  --bucket {bucket-name} \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

## エラーハンドリングパターン

SDK 例外型で分岐し、リトライ可能性（スロットリング等）を判別する。

```typescript
import { S3ServiceException } from '@aws-sdk/client-s3';

try {
  await s3Client.send(new GetObjectCommand({ Bucket, Key }));
} catch (error) {
  if (error instanceof S3ServiceException) {
    if (error.name === 'NoSuchKey') {
      throw new NotFoundError(`Object not found: ${Key}`);
    }
    if (error.$retryable) {
      // リトライ可能なエラー（スロットリング等）
      throw new RetryableError(error.message);
    }
  }
  throw error;
}
```

## 検証コマンド

```bash
# TypeScript 型チェック
npx tsc --noEmit

# ローカル（LocalStack）での動作確認
aws --endpoint-url=http://localhost:4566 s3 ls

# 単体テスト（mock あり）
pnpm test {service}.test.ts
```

## クイックコマンド

```bash
# LocalStack 操作
aws --endpoint-url=http://localhost:4566 s3 ls
aws --endpoint-url=http://localhost:4566 sqs list-queues
aws --endpoint-url=http://localhost:4566 sns list-topics

# 本番 AWS 操作
aws s3 ls --region {region}
aws iam list-roles --query 'Roles[?contains(RoleName, `github`)]'
aws sts get-caller-identity  # 現在の認証情報確認
```
