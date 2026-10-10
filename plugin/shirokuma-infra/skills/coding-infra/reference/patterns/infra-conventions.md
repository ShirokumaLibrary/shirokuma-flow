# インフラ命名規則・構成パターン

ローカル開発インフラ（docker-compose）の命名規則と構成パターン。

## 命名規則

### コンテナ名

```
{project}-{service}
```

| 例 | 説明 |
|----|------|
| `myapp-postgres` | PostgreSQL データベース |
| `myapp-valkey` | Valkey（Redis 互換）キャッシュ |
| `myapp-mailpit` | ローカルメールサーバー |

プロジェクト名プレフィックスにより、複数プロジェクトが同一ホストで動作する際のコンテナ名衝突を防ぐ。

### ボリューム名

```
{project}-{service}-data
```

| 例 | 説明 |
|----|------|
| `myapp-postgres-data` | PostgreSQL データ |
| `myapp-valkey-data` | Valkey 永続データ |

### ネットワーク名

```
{project}-network
```

単一のプロジェクトネットワークでサービス間通信を行う。

### 環境変数名

```
{SERVICE}_{PARAM}
```

| 例 | 説明 |
|----|------|
| `POSTGRES_PORT` | PostgreSQL ホスト公開ポート |
| `POSTGRES_USER` | PostgreSQL ユーザー名 |
| `VALKEY_PORT` | Valkey ホスト公開ポート |
| `MAILPIT_SMTP_PORT` | Mailpit SMTP ポート |
| `MAILPIT_HTTP_PORT` | Mailpit Web UI ポート |
| `LOCALSTACK_PORT` | LocalStack 統合エンドポイントポート |
| `LOCALSTACK_SERVICES` | 有効化する AWS サービスのカンマ区切りリスト |

## ポート割り当て

ローカル開発でのデフォルトポート（環境変数で上書き可能）:

| サービス | デフォルトポート | 環境変数 |
|---------|--------------|---------|
| PostgreSQL | 5432 | `POSTGRES_PORT` |
| Valkey / Redis | 6379 | `VALKEY_PORT` |
| Mailpit SMTP | 1025 | `MAILPIT_SMTP_PORT` |
| Mailpit Web UI | 8025 | `MAILPIT_HTTP_PORT` |
| LocalStack | 4566 | `LOCALSTACK_PORT` |

複数プロジェクトを同時に起動する場合は `.env` でポートをずらす（例: `POSTGRES_PORT=5433`）。

## サービス選定基準

| 用途 | 推奨サービス | 理由 |
|------|------------|------|
| リレーショナルDB | PostgreSQL 18 | 推奨技術スタックの既定（上書き可能な出発点） |
| キャッシュ / セッション | Valkey 9 | OSS ライセンス（BSD-3-Clause）。本番に ElastiCache を使うなら、採用前に ElastiCache が対応する Valkey の版を AWS のドキュメントで確かめ、ローカルと版を揃える |
| ローカルメール | Mailpit | 軽量、Web UI 付き |
| AWS サービスエミュレーション | LocalStack Community Edition | 無料、AWS アカウント不要 |

> **Redis は非推奨**: Redis 7.4 以降は RSALv2 / SSPLv1 のデュアル（8.0 から AGPLv3 も選べる）。新規追加は Valkey を使用すること。

## ファイル構成

```
{project}/
├── docker-compose.yml        # メイン compose 定義
├── .env                      # ローカル環境変数（gitignore）
├── .env.example              # 環境変数テンプレート（git 管理）
└── scripts/
    ├── up-all.sh             # 全サービス起動スクリプト
    └── up-plugins.sh         # プラグイン（追加サービス）起動スクリプト
```

## ヘルスチェック要件

本番準拠サービスにはヘルスチェックを設定する。

| サービス | test コマンド |
|---------|-------------|
| PostgreSQL | `["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-postgres}"]` |
| Valkey | `["CMD", "valkey-cli", "ping"]` |
| MySQL | `["CMD", "mysqladmin", "ping", "-h", "localhost"]` |
| Mailpit | `["CMD", "wget", "--spider", "-q", "http://localhost:8025"]` |
| LocalStack | `["CMD", "curl", "-f", "http://localhost:4566/_localstack/health"]` |

ヘルスチェックがあることで `depends_on: condition: service_healthy` が利用可能になる。

## イメージバージョンポリシー

- **`latest` タグ禁止**: バージョンを明示する（例: `postgres:18-alpine`）
- **`-alpine` バリアントを優先**: イメージサイズが小さい
- **メジャーバージョン固定**: マイナーはフロートさせてよい（例: `18-alpine`）
- **更新タイミング**: `docker compose pull` でチーム全体で同期

## .env.example テンプレート

```dotenv
# PostgreSQL
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=app
POSTGRES_PORT=5432

# Valkey
VALKEY_PORT=6379

# Mailpit
MAILPIT_SMTP_PORT=1025
MAILPIT_HTTP_PORT=8025

# LocalStack
LOCALSTACK_PORT=4566
LOCALSTACK_SERVICES=s3,sqs,sns
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_DEFAULT_REGION=us-east-1
```
