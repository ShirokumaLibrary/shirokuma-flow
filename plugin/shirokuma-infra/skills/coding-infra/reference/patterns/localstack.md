# LocalStack パターン集

## 概要

LocalStack Community Edition は、ローカル開発向けに AWS サービスをエミュレートする。AWS アカウントや費用は不要。

## ローカル本番相当の統合像

LocalStack は単体で起動するのではなく、**base compose（`docker-compose.yml`＝db＋app の最小構成）に断片で束ねて 1 つの環境を組む**。AWS 依存（S3 / SQS / SNS / Secrets Manager 等）を使うプロジェクトが「ローカルで本番相当のデータ層・メッセージ層を持つ」ための統合像は次の通り:

- **一次方式は `-f` 多重指定**で base に localstack 断片を重ねる。base ファイルは編集せず、起動コマンド側で「使う断片だけ」を選ぶ:

  ```bash
  # base（db＋app）＋ localstack を 1 つの docker compose up に束ねる
  docker compose -f docker-compose.yml -f compose.localstack.yml up -d
  ```

- 断片テンプレ（`compose.localstack.yml`）・`dev-up.sh` の合成引数・top-level `networks:` の扱いは [`docker-compose.md` の「断片合成（service-fragment）」節](docker-compose.md) が正本。本ファイルは localstack 断片の中身（サービス定義・init・エンドポイント設定）を担う。
- この束ね方により、`app`（アプリコンテナ）は本番と同じ AWS SDK コードのまま、エンドポイントだけ LocalStack（`http://localhost:4566`）へ向けて動く（[エンドポイント設定パターン](#エンドポイント設定パターン)）。1 回の `docker compose up` で「本番相当のローカル環境」が立ち上がる。

### コンピュート層（Next.js 本体）は再現しない

統合像に含めるのは **データ層・メッセージ層・シークレット層など AWS マネージドサービスのエミュレーション**であって、**コンピュート層＝Next.js 本体（アプリの実行基盤）は LocalStack で再現しない**。

- cdk-nextjs の既定（`NextjsGlobalFunctions`）は **Lambda Web Adapter 方式**で、本番でも Lambda コンテナイメージが通常の HTTP サーバー（`next start` 相当）をそのまま公開する。ローカルでは**同一コンテナを普通の Web サーバーとして `docker compose` で起動するだけ**でよく、Lambda / API Gateway をエミュレートする必要が無い。
- したがって統合像の `app` サービスは「通常の Web サーバーとして起動した Next.js コンテナ」であり、LocalStack が受け持つのはその周辺の AWS サービス群だけになる。Lambda/API Gateway エミュレーション経路（本ファイルの Lambda 節）は、**汎用（非 Next.js）の Lambda 関数を書く場合にのみ**検討する。
- 詳細と Why は `designing-aws/reference/patterns/nextjs-deploy.md` の「ローカル開発ループには Lambda/API Gateway エミュレーションが不要」節を参照（相互参照）。

## Docker Compose サービス定義

```yaml
localstack:
  image: localstack/localstack:4
  container_name: {project}-localstack
  restart: unless-stopped
  ports:
    - "${LOCALSTACK_PORT:-4566}:4566"   # 統合エンドポイント
  environment:
    - SERVICES=${LOCALSTACK_SERVICES:-s3,sqs,sns}
    - AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-us-east-1}
    - LOCALSTACK_AUTH_TOKEN=${LOCALSTACK_AUTH_TOKEN:-}  # Pro 版のみ
  volumes:
    - localstack-data:/var/lib/localstack
    - ./scripts/localstack/init:/etc/localstack/init/ready.d:ro  # 初期化スクリプト
    - /var/run/docker.sock:/var/run/docker.sock  # 一部サービスで必要
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:4566/_localstack/health"]
    interval: 10s
    timeout: 5s
    retries: 5

volumes:
  localstack-data:
    name: {project}-localstack-data
```

## 初期化スクリプト

`/etc/localstack/init/ready.d/` にシェルスクリプトを置くと、LocalStack 起動後に自動実行される。

### ディレクトリ構成

```text
scripts/
└── localstack/
    └── init/
        └── 01-setup-resources.sh
```

> **注意**: ファイルはアルファベット順に実行される。`01-`, `02-` のような数値プレフィックスで実行順序を制御する。

### 例: S3 バケットと SQS キューの作成

```sh
#!/bin/bash
set -e

ENDPOINT="http://localhost:4566"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"

echo "=== LocalStack 初期化 ==="

# S3 バケット作成
awslocal s3 mb s3://{project}-uploads --region "$REGION"
echo "S3 バケット作成完了: {project}-uploads"

# SQS キュー作成
awslocal sqs create-queue --queue-name {project}-jobs --region "$REGION"
echo "SQS キュー作成完了: {project}-jobs"

echo "=== 初期化完了 ==="
```

### init 実例テンプレ

最小の init 実例を [`../templates/localstack-init.sh.template`](../templates/localstack-init.sh.template) に置く（S3 バケット 1＋SQS キュー 1＋SES 検証 1・足し方はコメント例）。展開時の注意:

- 配置: `./scripts/localstack/init/01-setup-resources.sh` として展開し **`chmod +x`** する（実行権限が無いと走らない）。
- `compose.localstack.yml` がこのディレクトリを `/etc/localstack/init/ready.d/` にマウントし、起動後に `NN-*.sh` をアルファベット順で自動実行する。
- **SERVICES に `ses` を含める**: 既定は `s3,sqs,sns,secretsmanager,ses`。init の `ses verify-email-identity` を使うには `ses` が要る（メール送信本体は mailpit 断片だが identity 検証だけ localstack で行う）。使わないなら SERVICES から削る。

## awslocal CLI vs aws --endpoint-url

LocalStack との通信には 2 つのアプローチがある:

| アプローチ | コマンド | 使いどころ |
|-----------|---------|-----------|
| `awslocal` | `awslocal s3 ls` | ローカル開発（シンプル） |
| `aws --endpoint-url` | `aws s3 ls --endpoint-url http://localhost:4566` | スクリプト（エンドポイントが明示的） |

### awslocal インストール

```bash
pip install awscli-local
```

`awslocal` は `aws` のラッパーで `--endpoint-url` とダミー認証情報を自動設定する。インタラクティブな使用に推奨。

### ダミー認証情報（aws CLI に必要）

```dotenv
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_DEFAULT_REGION=us-east-1
```

LocalStack は任意の認証情報を受け入れる。慣例として `test` / `test` を使用する。

## Community Edition で利用可能なサービス

| サービス | 利用可否 | 備考 |
|---------|---------|------|
| S3 | 可 | フルサポート |
| SQS | 可 | フルサポート |
| SNS | 可 | フルサポート |
| DynamoDB | 可 | フルサポート |
| Lambda | 可 | Docker ソケットが必要。**ARM64 ホストでは関数作成時に `--architectures arm64` の明示が必須**（省略すると x86_64 前提のランタイムイメージが使われ `fork/exec ...: exec format error` で起動タイムアウトする）。Next.js アプリ（cdk-nextjs の Lambda Web Adapter 方式）はこのエミュレーション自体が不要（`designing-aws/reference/patterns/nextjs-deploy.md` 参照） |
| EventBridge | 可 | 基本サポート |
| Secrets Manager | 可 | 基本サポート |
| SSM Parameter Store | 可 | 基本サポート |
| SES | 可 | 基本サポート |
| API Gateway | 一部 | 制限あり |
| RDS | 不可 | Pro 版のみ |
| ElastiCache | 不可 | Pro 版のみ |
| Cognito | 一部 | 機能制限あり |
| ELBv2 / ALB | **不明** | **追試状況: 要確認（未追試）。** 「Community では提供されず有償プラン扱い（`Included in Plans: Base, Ultimate`・`Persistence: Not Supported`）」との**報告があるが、この配布物の作成側では追試していない**（第三者報告の中継・出典ページの取得日は報告者のもの）。出典: https://docs.localstack.cloud/references/coverage/coverage_elbv2/ 。**この行を根拠に「使える／使えない」を決めない**——ALB を前提にする構成（ECS + ALB 等）を組む前に、使用する版の出典ページを自分で開いて可否を確定する |

> 全リスト: https://docs.localstack.cloud/references/coverage/
>
> ⚠️ **この表には取得日が無い**（ELBv2 行を除き、各行の値の**取得元も取得時点も記録されていない**）。LocalStack のカバレッジは版で動くので、**表の可否は「調べ始める入口」であって根拠ではない**。可否が判断を左右する場面では上の coverage ページで使用中の版を確認する。
>
> **倒れる向き**: 表に**行が無いこと**は「使えない」の意味を持たない（未調査と区別できない）＝ fail-silent。逆に**古い「可」が残る**と、版が上がって使えなくなっても表は緑のまま——どちらの向きにも機械的な検知は無い。
>
> **列の読み方**: 「利用可否」列は可否だけを表し、値は `可` / `一部` / `不可` / `不明` の 4 つ。誰がいつ確かめたか（追試状況）は「備考」にあり、その値の意味は `designing-aws/reference/patterns/static-asset-delivery.md` §4「追試状況の書き方」が定める。

## エンドポイント設定パターン

### アプリケーション側設定（ローカル↔本番の切り替え）

```typescript
// lib/aws-config.ts
import { S3Client } from "@aws-sdk/client-s3";

const isLocal = process.env.NODE_ENV === "development";

export const s3Client = new S3Client({
  region: process.env.AWS_DEFAULT_REGION, // 既定のリージョンを持たない（ローカルは .env の値を使う）
  ...(isLocal && {
    endpoint: process.env.AWS_ENDPOINT_URL ?? "http://localhost:4566",
    forcePathStyle: true,  // LocalStack S3 に必要
    credentials: {
      accessKeyId: "test",
      secretAccessKey: "test",
    },
  }),
});
```

### 環境変数パターン

```dotenv
# .env（ローカル開発）
AWS_ENDPOINT_URL=http://localhost:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_DEFAULT_REGION=us-east-1
```

```dotenv
# .env.production（本番 — エンドポイント上書きなし）
AWS_DEFAULT_REGION={region}
# 認証情報は IAM Role / ECS Task Role で注入
```

### Next.js / Node.js SDK v3 パターン

```typescript
// AWS_ENDPOINT_URL が設定されていれば自動的に使用される
const client = new S3Client({
  region: process.env.AWS_DEFAULT_REGION,
  // SDK v3.x は AWS_ENDPOINT_URL 環境変数を自動認識
});
```

> **SDK v3.x**: `AWS_ENDPOINT_URL` 環境変数は自動的に認識される（v3.x 以降）。この環境変数を使用する場合、`endpoint` の明示的な設定は不要。

## ヘルスチェック設定

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:4566/_localstack/health"]
  interval: 10s
  timeout: 5s
  retries: 5
```

### 依存関係設定

```yaml
app:
  depends_on:
    localstack:
      condition: service_healthy
```

## よくある問題と対策

| 問題 | 原因 | 対策 |
|------|------|------|
| 初期化スクリプトが実行されない | マウントパスが間違っている | `/etc/localstack/init/ready.d/` にマウントする |
| 初期化スクリプトが実行されない | 実行権限がない | `chmod +x` を追加するか `awslocal` を直接呼び出す |
| S3 パス形式 URL エラー | `forcePathStyle` 未設定 | SDK 設定で `forcePathStyle: true` を設定する |
| Lambda のコールドスタートが遅い | 初回起動時に Docker イメージをプル | Lambda ランタイムイメージを事前プルする |
| Lambda 呼び出しが `Timeout while starting up lambda environment` で失敗する | ARM64 ホストで `--architectures arm64` を指定していない（既定は x86_64 前提） | 関数作成時に `--architectures arm64` を明示する（実行環境コンテナのログに `exec format error` が出ていれば同じ原因） |
| 再起動後にデータが消える | ボリューム未設定 | `localstack-data` ボリュームをマウントする |
