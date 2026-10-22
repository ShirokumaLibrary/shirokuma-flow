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

## compose の置き場とファイル名（infra skill 群の定義）

infra skill 群（coding-infra・setting-up-infra とその reference・雛形）のコマンド例と雛形は、次の 2 つで compose を指す。

| 指すもの | 決め方 |
|---|---|
| `{compose-dir}`: base の compose・断片（overlay）・`.env` を置くディレクトリ。コマンド例はすべてここをカレントにして打つ | ①導入先に compose が既にあれば、その置き場を使う ②無ければ導入先が決める。決めていないときの選択肢は「リポジトリ直下」か「インフラ一式をまとめるディレクトリ（名前は導入先が選ぶ。例: `infra/`）」の 2 つ。アプリが 2 本以上ある・IaC や deploy のスクリプトも同じ場所に置くなら後者が向く |
| base ファイル: `{compose-dir}` の base の compose | ①既存があればその名前を使う ②新しく作るなら `compose.yaml`（Compose が既定で探す名前の第一候補。`-f` 無しの `docker compose` で読まれる） |

- **断片の名前**は `compose.<用途>.yml`（例: `compose.localstack.yml`）。重ねるときは `-f` を base → 断片の順に並べる（例: `docker compose -f compose.yaml -f compose.localstack.yml up -d`。base を既存の名前で使うなら先頭の `-f` をその名前にする）。
- **`{compose-dir}` の外から打つとき**は `docker compose --project-directory {compose-dir} -f {compose-dir}/compose.yaml ...` の形にする（相対パスの解決先と `.env` の読み込み先を `{compose-dir}` に揃える。カレントの `.env` を読ませない）。
- **無いことも扱う**: 既存の compose を探すときは `compose.yaml`・`compose.yml`・`docker-compose.yaml`・`docker-compose.yml` と断片（`compose.*.y{a,}ml`・`docker-compose.*.y{a,}ml`）をまとめて探す（新しい名前だけを探すと既存を見落とし、二重に作る）。どれも無ければ setting-up-infra スキルの初期化から始める。

## ファイル構成

```
{compose-dir}/
├── compose.yaml              # base（db＋app）
├── compose.<用途>.yml         # 断片（使う分だけ -f で重ねる）
├── db/init/                  # DB 初期化 SQL
├── .env                      # ローカル環境変数（ignore する）
├── .env.example              # 環境変数テンプレート（追跡する）
└── scripts/dev-up.sh         # 起動＋healthcheck 待ち（{compose-dir} で打つ）
```

### `.env*` の ignore（実値を追跡させない）

```gitignore
.env*
!.env.example
```

- **何を防ぐか**: `.env` だけを列挙すると、後から増えた実値のファイル（`.env.local`・`.env.production` など）が追跡に入る。`.env*` で一括して外し、雛形の `.env.example` だけを否定パターンで戻す。
- **代償**: `.env*` は `.envrc`（direnv）や、秘密を置かない既定値のファイル（フレームワークが追跡してよいとする `.env.development` など）も外す。追跡したいファイルは `!.env.development` のように否定パターンを足して戻す。
- **確かめ方**: `git check-ignore -v .env.local .env.example`。`.env.local` は `.env*` の行に、`.env.example` は `!.env.example` の行に当たる（否定パターンに当たったファイルは追跡される）。追試状況: 実測（`.env`・`.env.local`・`.env.production`・`.env.example` を置いた作業ツリーで確認）。

## ヘルスチェック要件

本番準拠サービスにはヘルスチェックを設定する。

| サービス | test コマンド |
|---------|-------------|
| PostgreSQL | `["CMD-SHELL", "pg_isready -h 127.0.0.1 -U ${POSTGRES_USER:-postgres}"]`（`-h 127.0.0.1` を外さない・下記） |
| Valkey | `["CMD", "valkey-cli", "ping"]` |
| MySQL | `["CMD", "mysqladmin", "ping", "-h", "localhost"]` |
| Mailpit | `["CMD", "wget", "--spider", "-q", "http://localhost:8025"]` |
| LocalStack | `["CMD", "curl", "-f", "http://localhost:4566/_localstack/health"]` |

ヘルスチェックがあることで `depends_on: condition: service_healthy` が利用可能になる。

**PostgreSQL は `-h 127.0.0.1` を付ける**。公式イメージは初回起動時、初期化 SQL（`/docker-entrypoint-initdb.d`）を流す間だけ Unix ソケットだけで待ち受ける一時サーバを立てる。`-h` を付けない `pg_isready` はソケットに当たるので一時サーバにも成功し、**初期化が終わる前に healthy になる**（`service_healthy` で待つアプリが、スキーマができる前に接続する）。`-h 127.0.0.1` で TCP に当てると、初期化が終わって TCP で待ち受けるまで失敗する。追試状況: 実測（`postgres:16-alpine`。初期化 SQL に 15 秒の待ちを入れ、`-h` 無しは 4 秒目から成功・`-h 127.0.0.1` は 18 秒目から成功）。使う版で同じかは、初期化 SQL に待ちを入れて両方を打ち比べて確かめる。

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
AWS_REGION=us-east-1
```
