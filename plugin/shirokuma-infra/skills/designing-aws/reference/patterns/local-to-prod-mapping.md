# ローカル↔本番マッピングテーブル

ローカル開発環境（docker-compose）と本番 AWS サービスの対応表。

## サービスマッピング一覧

| ローカルサービス | イメージ例 | 本番 AWS サービス | 備考 |
|---------------|---------|----------------|------|
| PostgreSQL | `postgres:18` | RDS PostgreSQL / Aurora PostgreSQL | マルチ AZ 推奨 |
| MySQL | `mysql:8` | RDS MySQL / Aurora MySQL | マルチ AZ 推奨 |
| Redis / Valkey | `valkey/valkey:9` | ElastiCache (Valkey エンジン) | クラスターモード検討 |
| S3（LocalStack） | `localstack/localstack:4` | Amazon S3 | バケットポリシー・暗号化必須 |
| SQS（LocalStack） | `localstack/localstack:4` | Amazon SQS | Standard / FIFO 選択 |
| SNS（LocalStack） | `localstack/localstack:4` | Amazon SNS | ファンアウトパターン |
| Mailhog / Mailpit | `mailhog/mailhog` | Amazon SES | 送信者検証・バウンス対応 |
| MinIO | `minio/minio` | Amazon S3 | MinIO と S3 API は互換 |
| Elasticsearch | `elasticsearch:8` | Amazon OpenSearch Service | インデックス設計は移行可能 |
| Minio + nginx | nginx | CloudFront + S3、または CloudFront + アプリのオリジン | 静的アセット配信。**この行は経路を確定しない**——選定と配信属性（Content-Type / 圧縮 / キャッシュ）は `static-asset-delivery.md`（同一 patterns ディレクトリ）が正本 |
| アプリコンテナ（汎用） | カスタム | ECS Fargate / App Runner | ポート・ヘルスチェックパス確認 |
| アプリコンテナ（Next.js） | カスタム | cdk-nextjs（`NextjsGlobalFunctions` ほか 4 構成） | 既定は `nextjs-deploy.md`（同一 patterns ディレクトリ）。next.config の `adapterPath` 追加・`output: "standalone"` 不使用が前提 |
| nginx（リバースプロキシ） | `nginx` | ALB（Application Load Balancer） | パスベースルーティング。**本番で nginx が残るかどうかを明示する**——長時間接続（SSE / ストリーミング）を持つ設計では、残るか否かで対処が変わる（`long-lived-connections.md`〔同一 patterns ディレクトリ〕§3） |
| DynamoDB Local | `amazon/dynamodb-local` | Amazon DynamoDB | テーブル設計の移行がほぼそのまま |
| Lambda（SAM local） | `amazon/aws-sam-cli-emulation-*` | AWS Lambda | ランタイム・メモリ・タイムアウト確認 |
| EventBridge（LocalStack） | `localstack/localstack:4` | Amazon EventBridge | ルール構文互換 |
| Secrets Manager（LocalStack） | `localstack/localstack:4` | AWS Secrets Manager | 認証情報管理 |

> **アプリコンテナ（Next.js）のビルド出力申し送り**: cdk-nextjs を選ぶ場合、本番用 Dockerfile は construct が自前生成し、ローカルの standalone ビルド出力を本番へ持ち出さない（ローカル compose は `target: dev` のまま据え置く）。**汎用コンテナ経路**（cdk-nextjs をデプロイ先にしない構成）を選ぶ場合のみ standalone マルチステージ Dockerfile を本番イメージに使う。デプロイ先の選定と互換契約は `nextjs-deploy.md`（同一 patterns ディレクトリ）。

## ローカル断片合成 → 本番 CDK の動線

ローカル環境構築側では、AWS エミュレーションを**サービス断片**として base compose に `-f` で合成し「使う分だけ」立てる。その断片 1 つが本番 AWS サービス群と 1:1 で対応するので、本マッピング表をたどって対応リソースを CDK で設計する:

| ローカル断片 | 本番 AWS（本表で設計） |
|------------|---------------------|
| localstack | S3 / SQS / SNS / Secrets Manager |
| mailpit | SES |
| valkey | ElastiCache（Valkey エンジン） |

- **動線**: ローカルで合成した断片を洗い出す → 本表で対応リソースを引く → 移行チェックリスト（後述）を満たすよう CDK スタックを設計する。断片を足していなければ本番リソースも不要、が基本（環境が使う分だけ本番に出す）。
- **SDK 切替**: アプリ側は `AWS_ENDPOINT_URL` の有無でローカル（エミュレータ）↔本番（実 AWS）を切り替える。コードは同一で、エンドポイントと認証情報だけ env で差し替える（下記）。

## エンドポイント切り替えパターン

### 環境変数による切り替え（推奨）

```dotenv
# .env.local（ローカル開発）
AWS_ENDPOINT_URL=http://localhost:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_DEFAULT_REGION=us-east-1
DATABASE_URL=postgresql://user:password@localhost:5432/myapp

# .env.production（本番 — エンドポイント上書きなし）
AWS_DEFAULT_REGION={region}
DATABASE_URL={Secrets Manager から注入}
# 認証情報は IAM Task Role で自動提供
```

### SDK 設定パターン

```typescript
// lib/aws-clients.ts
import { S3Client } from "@aws-sdk/client-s3";
import { SQSClient } from "@aws-sdk/client-sqs";

const isLocal = process.env.NODE_ENV === "development" || !!process.env.AWS_ENDPOINT_URL;

const localConfig = isLocal
  ? {
      endpoint: process.env.AWS_ENDPOINT_URL ?? "http://localhost:4566",
      region: process.env.AWS_DEFAULT_REGION ?? "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
      },
      forcePathStyle: true, // S3 に必要
    }
  : {};

export const s3Client = new S3Client(localConfig);
export const sqsClient = new SQSClient(localConfig);
```

> **SDK v3.x**: `AWS_ENDPOINT_URL` 環境変数は AWS SDK v3.x で自動認識される。S3 の `forcePathStyle` は LocalStack 使用時のみ必要なため、環境変数で制御する。

### Next.js Server Actions / API Routes でのパターン

```typescript
// lib/s3.ts — 環境に依存しないクライアント
import { S3Client } from "@aws-sdk/client-s3";

export function getS3Client(): S3Client {
  if (process.env.NODE_ENV === "development") {
    return new S3Client({
      endpoint: process.env.AWS_ENDPOINT_URL ?? "http://localhost:4566",
      region: "us-east-1",
      forcePathStyle: true,
      credentials: { accessKeyId: "test", secretAccessKey: "test" },
    });
  }
  // 本番: IAM Task Role が自動的に認証情報を提供
  return new S3Client({ region: process.env.AWS_DEFAULT_REGION });
}
```

## サービス別移行チェックリスト

### PostgreSQL → RDS PostgreSQL

- [ ] `max_connections` 設定（RDS デフォルト: インスタンスタイプに依存）
- [ ] SSL 接続が必要（RDS はデフォルト SSL 強制可能）
- [ ] バックアップ保持期間の設定（デフォルト 7 日）
- [ ] マルチ AZ 有効化（本番推奨）
- [ ] パラメータグループのカスタマイズ

### Redis → ElastiCache (Valkey)

- [ ] クラスターモード vs スタンドアロンの選択
- [ ] 自動フェイルオーバーの設定（マルチ AZ）
- [ ] セキュリティグループで ECS タスクからのアクセスのみ許可
- [ ] TLS 有効化（転送中暗号化）

### SQS（LocalStack）→ Amazon SQS

- [ ] Standard Queue（順序不問）vs FIFO Queue（順序保証）の選択
- [ ] 可視性タイムアウトの設定（処理時間の 1.5 倍を目安）
- [ ] DLQ（デッドレターキュー）の設定（maxReceiveCount: 3 を推奨）
- [ ] メッセージ保持期間（デフォルト 4 日、最大 14 日）

### S3（LocalStack/MinIO）→ Amazon S3

- [ ] パブリックアクセスブロックの設定（全て有効を推奨）
- [ ] バケット暗号化（SSE-S3 または SSE-KMS）
- [ ] CORS 設定（フロントエンドからの直接アップロード時）
- [ ] ライフサイクルポリシー（期限切れファイルの削除、Glacier への移行）
- [ ] バージョニングの設定（本番バケットは有効推奨）

### メール（Mailhog/Mailpit）→ Amazon SES

- [ ] 送信者ドメインの検証（DNS TXT レコード）
- [ ] サンドボックスモードからの脱出リクエスト（本番利用時）
- [ ] バウンス・苦情通知の設定（SNS 経由）
- [ ] 送信制限の確認（デフォルト: 1 日 200 通）

## コスト概算（ap-northeast-1、2024年時点）

| サービス | 最小構成 | 月額概算 |
|---------|---------|---------|
| RDS PostgreSQL t4g.micro（Single AZ） | 開発・ステージング向け | ~$15 |
| RDS PostgreSQL t4g.small（Multi AZ） | 本番小規模 | ~$60 |
| ElastiCache Valkey cache.t4g.micro | 小規模キャッシュ | ~$15 |
| ECS Fargate（0.25vCPU / 0.5GB × 2タスク） | 最小構成 | ~$15 |
| ALB（最小トラフィック） | — | ~$20 |
| NAT Gateway | 各 AZ 1つ | ~$45/AZ |

> 上記は参考値。実際のコストは AWS Pricing Calculator で試算すること。
