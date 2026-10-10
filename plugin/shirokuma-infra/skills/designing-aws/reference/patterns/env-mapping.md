# 環境変数マッピングパターン

ローカル開発（docker-compose / LocalStack）と本番（AWS）の間での環境変数・接続文字列のマッピング戦略。

## 環境変数命名規約

サービスカテゴリごとにプレフィックスを統一し、環境間での差異を明確にする。

| プレフィックス | 対象サービス | 例 |
|-------------|-----------|---|
| `DATABASE_` | RDS / PostgreSQL / MySQL | `DATABASE_URL`, `DATABASE_HOST` |
| `CACHE_` | ElastiCache / Redis / Valkey | `CACHE_URL`, `CACHE_HOST` |
| `MAIL_` | SES / Mailhog / Mailpit | `MAIL_HOST`, `MAIL_FROM` |
| `STORAGE_` | S3 / MinIO / LocalStack S3 | `STORAGE_BUCKET`, `STORAGE_ENDPOINT` |
| `QUEUE_` | SQS / LocalStack SQS | `QUEUE_URL`, `QUEUE_REGION` |
| `AWS_` | AWS SDK 共通設定 | `AWS_REGION`, `AWS_ENDPOINT_URL` |
| `NEXT_PUBLIC_` | ブラウザ公開変数（Next.js） | `NEXT_PUBLIC_APP_URL` |

## サービス別変数マッピングテーブル

### データベース（PostgreSQL / RDS）

| 変数名 | ローカル値（.env.local） | 本番値（.env.production） |
|--------|----------------------|------------------------|
| `DATABASE_URL` | `postgresql://user:password@localhost:5432/myapp` | `{Secrets Manager から注入}` |
| `DATABASE_HOST` | `localhost` | `{RDS エンドポイント}` |
| `DATABASE_PORT` | `5432` | `5432` |
| `DATABASE_SSL` | `false` | `true` |

### キャッシュ（Redis / ElastiCache Valkey）

| 変数名 | ローカル値（.env.local） | 本番値（.env.production） |
|--------|----------------------|------------------------|
| `CACHE_URL` | `redis://localhost:6379` | `rediss://{ElastiCache エンドポイント}:6379` |
| `CACHE_TLS` | `false` | `true` |

> 本番では `rediss://`（TLS 付き）を使用する。ElastiCache Valkey はデフォルトで転送中暗号化をサポート。

### ストレージ（S3 / LocalStack / MinIO）

| 変数名 | ローカル値（.env.local） | 本番値（.env.production） |
|--------|----------------------|------------------------|
| `STORAGE_BUCKET` | `my-bucket` | `my-app-prod-bucket` |
| `STORAGE_ENDPOINT` | `http://localhost:4566` | `（省略 — SDK がデフォルト使用）` |
| `STORAGE_REGION` | `us-east-1` | `{region}` |
| `STORAGE_FORCE_PATH_STYLE` | `true` | `false` |

### メール（Mailhog / SES）

| 変数名 | ローカル値（.env.local） | 本番値（.env.production） |
|--------|----------------------|------------------------|
| `MAIL_HOST` | `localhost` | `email-smtp.{region}.amazonaws.com` |
| `MAIL_PORT` | `1025` | `587` |
| `MAIL_FROM` | `no-reply@localhost` | `no-reply@yourdomain.com` |
| `MAIL_USER` | `（省略）` | `{SES SMTP ユーザー}` |
| `MAIL_PASSWORD` | `（省略）` | `{Secrets Manager から注入}` |

### AWS SDK 共通

| 変数名 | ローカル値（.env.local） | 本番値（.env.production） |
|--------|----------------------|------------------------|
| `AWS_ENDPOINT_URL` | `http://localhost:4566` | `（設定しない — SDK がデフォルト使用）` |
| `AWS_ACCESS_KEY_ID` | `test` | `（設定しない — IAM Task Role を使用）` |
| `AWS_SECRET_ACCESS_KEY` | `test` | `（設定しない — IAM Task Role を使用）` |
| `AWS_DEFAULT_REGION` | `us-east-1` | `{region}` |

> `AWS_ENDPOINT_URL` を本番で未設定にすることで、SDK は自動的に本番エンドポイントを使用する。エンドポイント切り替えの SDK 実装パターンは [local-to-prod-mapping.md](local-to-prod-mapping.md) を参照。

### cdk-nextjs のキャッシュ層変数（construct 自動注入＝モデル不要）

Next.js アプリのデプロイ先に cdk-nextjs を選ぶ場合、ISR / data cache / full route cache 用のキャッシュ層（S3 + DynamoDB）への接続情報は `CDK_NEXTJS_*` 環境変数として **construct が本番で自動注入**する。これらは本表にも `.env.local` にも **モデル化しない**（アプリ・ローカル環境は意識不要）。キャッシュ層の構成とデプロイ先の互換契約は [nextjs-deploy.md](nextjs-deploy.md) を参照。

## `.env` ファイル構成戦略

### ファイル役割の分離

| ファイル | 用途 | Git 管理 |
|---------|------|---------|
| `.env.example` | 必要な変数の一覧（値なし・サンプル値） | **追跡する** |
| `.env.local` | ローカル開発用の実際の値 | **追跡しない**（`.gitignore` に追加） |
| `.env.production` | 本番環境用（シークレットは含まない） | **追跡しない** |
| `.env.test` | テスト環境用 | 状況に応じて判断 |

### `.env.example` テンプレート

```dotenv
# データベース
DATABASE_URL=postgresql://user:password@localhost:5432/myapp

# キャッシュ
CACHE_URL=redis://localhost:6379

# ストレージ
STORAGE_BUCKET=my-bucket
STORAGE_ENDPOINT=http://localhost:4566
STORAGE_REGION=us-east-1
STORAGE_FORCE_PATH_STYLE=true

# メール
MAIL_HOST=localhost
MAIL_PORT=1025
MAIL_FROM=no-reply@localhost

# AWS SDK（ローカル開発時のみ設定）
AWS_ENDPOINT_URL=http://localhost:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_DEFAULT_REGION=us-east-1
```

### Next.js の変数区分

Next.js では変数のスコープを命名で制御する:

| 区分 | 命名ルール | アクセス可能な場所 |
|-----|-----------|----------------|
| サーバーサイドのみ | プレフィックスなし（例: `DATABASE_URL`） | Server Components, Server Actions, API Routes のみ |
| ブラウザ公開 | `NEXT_PUBLIC_` プレフィックス | 全てのコンポーネント（ブラウザに露出） |

> **重要**: `NEXT_PUBLIC_` 変数はビルド時に埋め込まれる。シークレット情報（API キー、DB パスワード等）を `NEXT_PUBLIC_` にしてはならない。

> **秘密以外の含意（運用側）**: 埋め込みは「実行時の環境変数では変えられない」も意味する。**この区分に置いた値を切り替えるには、イメージ / バンドルの作り直しが要る**。静的資産の配信元 URL のように**環境ごとに切り替えたい値**をここへ置くかは設計判断で、判断軸は [static-asset-delivery.md](static-asset-delivery.md)（同一 patterns ディレクトリ）の「受け口の値をどこから渡すか」が正本。ここでは繰り返さない。

```dotenv
# サーバーサイドのみ（ブラウザに公開されない）
DATABASE_URL=postgresql://...
AWS_ENDPOINT_URL=http://localhost:4566

# ブラウザにも公開される
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## シークレット管理パターン

### ローカル開発: `.env.local` に平文で記述

```dotenv
DATABASE_URL=postgresql://user:password@localhost:5432/myapp
```

### 本番: AWS Secrets Manager / SSM Parameter Store から注入

#### パターン A: ECS タスク定義の `secrets` フィールド（推奨）

CDK でシークレットを ECS タスク定義に注入する:

```typescript
// CDK コンストラクト例（実装は coding-cdk スキルが担当）
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { ContainerImage, Secret as EcsSecret } from "aws-cdk-lib/aws-ecs";

const dbSecret = Secret.fromSecretNameV2(this, "DbSecret", "myapp/prod/database");

taskDefinition.addContainer("AppContainer", {
  image: ContainerImage.fromEcrRepository(repo),
  secrets: {
    DATABASE_URL: EcsSecret.fromSecretsManager(dbSecret, "url"),
  },
});
```

> アプリケーションコードは `process.env.DATABASE_URL` で読み取るだけでよい。シークレット取得のロジックは不要。

#### パターン B: SSM Parameter Store からの取得（アプリケーション内）

```typescript
// lib/config.ts — SSM から設定を取得（起動時に1回のみ）
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION });

export async function getConfig() {
  if (process.env.NODE_ENV === "development") {
    return {
      databaseUrl: process.env.DATABASE_URL,
    };
  }

  const { Parameter } = await ssmClient.send(
    new GetParameterCommand({
      Name: "/myapp/prod/database-url",
      WithDecryption: true,
    })
  );

  return {
    databaseUrl: Parameter?.Value,
  };
}
```

> パターン A（ECS `secrets` フィールド）を優先する。アプリケーションがシークレット取得ロジックを持つ必要がなくなり、IAM 権限の管理も簡潔になる。

### シークレット管理の選択基準

| ユースケース | 推奨 | 理由 |
|------------|------|------|
| ECS / App Runner で動作するアプリ | ECS `secrets` フィールド | タスク起動時に自動注入、アプリ変更不要 |
| Lambda 関数 | SSM Parameter Store | コールドスタート時のレイテンシが低い |
| 複数サービスで共有するシークレット | Secrets Manager | バージョン管理・自動ローテーション機能あり |
| 非機密の設定値 | SSM Parameter Store（Standard） | コスト効率が高い |

## 関連パターン

| パターン | ドキュメント | 参照するタイミング |
|---------|------------|----------------|
| SDK 設定（LocalStack エンドポイント切り替え） | [local-to-prod-mapping.md](local-to-prod-mapping.md) | TypeScript コードでの AWS クライアント初期化時 |
| AWS リソース選定全般 | [aws-resource-patterns.md](aws-resource-patterns.md) | RDS / ElastiCache 等のリソース設計時 |
