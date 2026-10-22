# docker-compose パターン集

## 基本構造

### ファイル命名と置き場

置き場（`{compose-dir}`）・base の名前・断片の名前は [infra-conventions.md](infra-conventions.md) の「compose の置き場とファイル名」節で定義する。本ファイルのコマンド例は `{compose-dir}` で打つ前提で書く。

- `compose.override.yaml`（または既存の `docker-compose.override.yml`）は、`-f` 無しの `docker compose` が base に自動で重ねる個人用の上書き。ignore する（追跡すると、個人の上書きが全員の環境へ入る）。

### プロジェクト名を固定する（トップレベル `name:`）

```yaml
name: {project}        # base の先頭に置く
```

- **何を防ぐか**: `name:` が無いと、Compose はプロジェクト名を `{compose-dir}` のディレクトリ名から作る。置き場を動かした・別の作業ツリー（同じリポの別ディレクトリ）から起動した回にプロジェクト名が変わり、**既存のコンテナ・名前の付いていないボリュームを見失って新しく作る**（データが空に見える）。`name:` で固定し、ボリュームも `volumes.<名前>.name: {project}-...` で固定する（本ファイル「ボリューム命名規則」）。
- **限界**: プロジェクト名を固定すると、同じホストで同じ compose を 2 つの作業ツリーから同時に立てたときは同じコンテナを奪い合う。並べて立てる必要がある回は `docker compose -p <別名>` で起動時に変える（固定ボリュームの `name:` も別名にする必要がある）。
- 追試状況: 実測（Docker Compose v5.5.1 の `docker compose config` がトップレベル `name:` をプロジェクト名として出すことを確認）。

### サービス定義の基本形

```yaml
services:
  {service-name}:
    image: {image}:{version}        # latest を避けバージョン固定
    container_name: {project}-{service}  # プロジェクト名プレフィックス推奨
    restart: unless-stopped
    environment:
      - ENV_VAR=${ENV_VAR:-default}  # 環境変数は .env から
    ports:
      - "${PORT:-5432}:5432"         # ポートも環境変数化
    volumes:
      - {volume-name}:/data
    networks:
      - {project}-network
    healthcheck:
      test: ["CMD", "pg_isready", "-h", "127.0.0.1", "-U", "postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  {volume-name}:
    name: {project}-{volume-name}   # ボリューム名もプレフィックス付き

networks:
  {project}-network:
    name: {project}-network
```

## サービス種別パターン

### データベース（PostgreSQL）

```yaml
postgres:
  image: postgres:18-alpine   # バージョンピンとマウント先は連動する（18 は /var/lib/postgresql・17 は /var/lib/postgresql/data。使う版は docker image inspect <image> --format '{{.Config.Env}}' の PGDATA で確かめる）
  container_name: {project}-postgres
  restart: unless-stopped
  environment:
    - POSTGRES_USER=${POSTGRES_USER:-postgres}
    - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres}
    - POSTGRES_DB=${POSTGRES_DB:-app}
  ports:
    - "${POSTGRES_PORT:-5432}:5432"
  volumes:
    # ⚠ 既に旧マウント先（PGDATA が /var/lib/postgresql/data の版。17 で実測）で稼働している volume をそのまま 18 の新マウント先へ当て替えても起動しない
    #   （上流ガードが「there appears to be PostgreSQL data in: /var/lib/postgresql」で Exited (1)）。
    #   データは消えないし空のクラスタも作られない——倒れる向きは fail-closed。
    #   移行は旧イメージで起動して pg_dump で吸い出し、新構成へ restore する。
    - postgres-data:/var/lib/postgresql   # 18 の単一マウント先。/data へ挿すと新規ボリュームでも起動しない（docker-library/postgres#1259）
  healthcheck:
    # -h 127.0.0.1 を外さない（初期化中の一時サーバに成功して healthy が早まるのを防ぐ。infra-conventions.md「ヘルスチェック要件」）
    test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U ${POSTGRES_USER:-postgres}"]
    interval: 10s
    timeout: 5s
    retries: 5
```

### キャッシュ（Valkey / Redis 互換）

```yaml
valkey:
  image: valkey/valkey:9-alpine
  container_name: {project}-valkey
  restart: unless-stopped
  ports:
    - "${VALKEY_PORT:-6379}:6379"
  volumes:
    - valkey-data:/data
  healthcheck:
    test: ["CMD", "valkey-cli", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5
```

> **注意**: 新規追加は Redis ではなく Valkey を使用する（OSSライセンス維持）。

### メール（Mailpit）

```yaml
mailpit:
  image: axllent/mailpit:v1.21-alpine
  container_name: {project}-mailpit
  restart: unless-stopped
  ports:
    - "${MAILPIT_SMTP_PORT:-1025}:1025"   # SMTP
    - "${MAILPIT_HTTP_PORT:-8025}:8025"   # Web UI
  environment:
    - MP_MAX_MESSAGES=500
  healthcheck:
    test: ["CMD", "wget", "--spider", "-q", "http://localhost:8025"]
    interval: 10s
    timeout: 5s
    retries: 5
```

## 依存関係パターン

### depends_on（ヘルスチェック連携）

```yaml
app:
  depends_on:
    postgres:
      condition: service_healthy
    valkey:
      condition: service_healthy
```

### 一回きりのタスク（マイグレーション）を待つ

```yaml
migrate:
  image: {migrate-image}
  restart: "no"                     # 一回きり。終わったら再起動しない
  environment:
    - DATABASE_URL=postgresql://{migrate-user}:${MIGRATE_PASSWORD}@db:5432/{db-name}   # DDL を流せる強い資格
  depends_on:
    db:
      condition: service_healthy
app:
  environment:
    - DATABASE_URL=postgresql://{app-user}:${APP_DB_PASSWORD}@db:5432/{db-name}       # 読み書きだけの弱い資格
  depends_on:
    migrate:
      condition: service_completed_successfully   # exit 0 で終わるまで app を起動しない
```

- **何を防ぐか**: ①アプリがスキーマの古い DB に接続して起動時に失敗する・②アプリの資格で DDL を流せる（アプリが乗っ取られると表を消せる）。マイグレーションを強い資格の別サービスにし、アプリは DDL を持たない別ロールで、マイグレーションの正常終了を待つ。ロールの作り方は DB 初期化 SQL（`db/init/`）で書く。
- **倒れる向き**: マイグレーションが exit 0 以外で終わると app は作られたまま起動しない（`docker compose ps -a` で app が `created`）。`up -d` の出力に `service "migrate" didn't complete successfully` が出る。
- **`restart: "no"` を一回きりのタスクと dev サーバに付ける**: base の既定の `restart: unless-stopped` を写すと、終わったマイグレーションが Docker の再起動のたびに流れ直し、手で止めた dev サーバも勝手に戻る。`restart` を省いたときの既定は `"no"` だが、写し元の既定に引きずられないよう明示する。
- 追試状況: 実測（Docker Compose v5.5.1。一回きりのサービスが exit 0 なら app が起動・exit 1 なら app は `created` のまま）。ロールの分離そのものは DB の権限設計で、版で動くものではない。

## 起動スクリプトパターン

### up スクリプト（全サービス）

```sh
#!/bin/sh
set -e
docker compose up -d
echo "All services started."
```

### up スクリプト（プラグイン形式）

複数の compose ファイルをオーバーレイする場合:

```sh
#!/bin/sh
set -e
docker compose -f compose.yaml -f compose.plugins.yml up -d
```

## 断片合成（service-fragment）

base（db＋app の最小 compose）に、AWS エミュレーション等を**使う分だけ断片で足す**方式。要点:

- **一次方式は `-f` 多重指定**。起動コマンド側で断片を選ぶ（base ファイルを編集しない）。
  ```sh
  # S3/SQS を使うなら base + localstack 断片
  ./scripts/dev-up.sh "-f compose.yaml -f compose.localstack.yml"
  # メールも要るなら mailpit 断片を足す
  ./scripts/dev-up.sh "-f compose.yaml -f compose.localstack.yml -f compose.mailpit.yml"
  # 直接 docker compose でも同じ
  docker compose -f compose.yaml -f compose.localstack.yml up -d
  ```
- **`dev-up.sh` は合成 `-f ...` 文字列を 1 引数で受ける**。引数なし＝`compose.yaml` 単独（base のみ）。base を別の名前（既存の `docker-compose.yml` など）で持つなら、`-f` で渡すか雛形の既定値を書き換える（そのままだと引数なしの起動がファイルを見つけられず落ちる）。起動サービスを `docker compose ps` で動的に列挙し healthcheck 持ちだけ待つため、断片を足しても待機ロジックは変わらない。
- **断片テンプレ**（同一 skill 内 `../templates/`）:
  - [`compose.localstack.yml.template`](../templates/compose.localstack.yml.template) — S3 / SQS / SNS / Secrets Manager（init は localstack パターン参照）
  - [`compose.mailpit.yml.template`](../templates/compose.mailpit.yml.template) — SES 相当（SMTP 捕捉 + Web UI）
  - [`compose.valkey.yml.template`](../templates/compose.valkey.yml.template) — ElastiCache 相当（Redis 互換）
  - [`dev-up.sh.template`](../templates/dev-up.sh.template) — multi-service 動的待ち版

### network 参照規約

断片を `-f` 合成するときの top-level `networks:` 宣言は **base（`compose.yaml`）だけが持つ**。断片側に置かない。

- **断片側**: service の `networks: [{project}-network]` 参照だけ残し、top-level `networks:` は書かない。volume は断片側で宣言してよい（名前は `{project}` プレフィックス）。
- **base 側**: `networks.{project}-network.name: {project}-network` を宣言。合成後もこの宣言が残るため compose が name で自動作成し、合成 `up` がそのまま通る。
- **`external: true` は使わない**: 断片側で `networks: {project}-network: external: true` を宣言すると、マージで base の宣言を上書きし、ネットワークが**事前作成必須**になる（事前 `docker network create` を忘れると `up` が `network ... declared as external, but could not be found` で失敗する）。宣言を省く方式なら事前作成が不要。

### `include:`（将来オプション）

compose-spec の `include:` で base 側に断片を取り込む方式もある。base ファイルを編集して取り込み先を列挙する必要があり「使う断片だけ選ぶ」が起動コマンドでなくファイル編集になるため、一次方式は `-f`。base 改変を許容できるプロジェクトには `include:` も有効。

## traefik + dnsmasq の導入を検討する条件

最小ケースは `localhost:3000` 直で足り、リバースプロキシ（traefik）+ ローカル DNS（dnsmasq）は重い OS 依存（`/var/run/docker.sock` マウント・mkcert TLS・OS resolver 設定）を全利用者に課税するため**既定では入れない**。次の**両方**を満たすときに導入を検討する:

- **複数アプリ同居**: 1 ホストで複数アプリを同時に立て、ホスト名でルーティングしたい（ポート番号での出し分けが破綻する）。
- **HTTPS 必須機能**: OAuth コールバック・Secure Cookie 検証など、平文 `localhost` では成立しない機能を扱う。

いずれかが欠ける間はローカルは `localhost` 直で進める（単一アプリの HTTPS だけなら mkcert 等の軽い手段で足り、この一式は要らない。実体テンプレは持たず、トリガーのみ明文化）。

## ボリューム命名規則

| パターン | 例 |
|---------|-----|
| `{project}-{service}-data` | `myapp-postgres-data` |
| `{project}-{service}-config` | `myapp-valkey-config` |

プロジェクト名プレフィックスにより、異なるプロジェクト間でのボリューム競合を防ぐ。

## 設定変更を反映させる（`up -d` は作り直さないことがある）

**`docker compose up -d` は、compose ファイルや `.env` を変えてもコンテナを作り直さないことがある**。出力が `Recreated` ではなく `Started`（または `Running`）のときは**古い設定のコンテナがそのまま動いている**。

```sh
# 設定の効果を測る前に、必ず作り直してから測る
docker compose up -d --force-recreate {service}
# 反映されたかは出力の Recreated と、実際に入った値の両方で見る
docker compose exec {service} env | grep -E '^(PORT|NODE_ENV)='
```

- **倒れる向き**: 作り直されなかったことは**エラーにならない**（fail-silent）。「設定を入れたのに直らない」→「この設定は効かない」という**誤った結論**に倒れる。**設定が効かないと結論する前に `--force-recreate` で 1 度測り直す**（「効かない」は「反映されていない」と区別が付かない）。
- イメージのビルド内容を変えたときは `--force-recreate` だけでは足りない（`--build` が要る）。**何を変えたか**（実行時設定か／イメージ内容か）で必要な再生成の深さが変わる。

## 疎通確認が測っていないもの（dev サーバを複数立てる構成）

`curl` / `wget` による疎通確認（healthcheck を含む）は **`Origin` ヘッダを送らない**。したがって**リクエスト元オリジンで挙動が変わる経路を一切踏まない**。

- 代表例: 開発サーバの**クロスオリジン開発リクエスト許可リスト**（Next.js の `allowedDevOrigins` 等。**設定名と導入版はフレームワークの版で動くので、使用中の版のドキュメントで確認する**）。許可されないオリジンから来た**開発用アセット（JS チャンク等）だけが拒否**され、**HTML と `/api/health` は 200 のまま**という形になりうる。
- **倒れる向き**: fail-silent。**healthcheck も疎通確認も緑のまま、ブラウザでは hydration されない**——「動いていないのに全部緑」。`docker compose ps` が healthy でも、この経路は**一度も測られていない**。
- **`Origin` を送らない確認は、hydration の可否を測っていない。** これは設定名やフレームワークに依らず成り立つ（確認手段の性質であって、特定の版の挙動ではない）。

### 測り方（値を写さず、自分の環境で対照を取る）

配布側は**対照表の値を持たない**（版で動く・後述）。次の手順で**その場で対照を取る**:

```sh
# 1. 設定を変えたら必ず作り直してから測る（上節）
docker compose up -d --force-recreate {service}

# 2. Origin なし（＝通常の疎通確認）と Origin あり（＝ブラウザ相当）を必ず両方取る
ASSET_URL="http://localhost:{ホスト側ポート}/{実在する開発用アセットのパス}"   # 例: Next.js なら /_next/static/chunks/... のうち実在する 1 本
curl -s -o /dev/null -w 'no-origin=%{http_code}\n' "$ASSET_URL"
curl -s -o /dev/null -w 'with-origin=%{http_code}\n' \
  -H "Origin: http://localhost:{ブラウザで開いているポート}" "$ASSET_URL"
```

- **両方が同じ値になるまで「確認できた」と言わない**。`no-origin=200` / `with-origin=403` は**疎通確認だけが緑の状態**そのもの。
- 対照は **2 軸**で取る: ①許可リスト設定の有無、②**コンテナ内で dev サーバが listen しているポート**（ホスト側のポートマッピングだけを変えても、フレームワークが見るのは**コンテナ内のポート**なので一致しないことがある）。**どちらか一方だけを動かすと原因を取り違える。**
- **本ファイルは 2 軸の組み合わせの結果表を持たない**——結果は**フレームワークの版で動く値**なので表は持たない。**自分の版で上の対照を取ること**が手順であり、表を読むことではない。

## よくある問題と対策

| 問題 | 原因 | 対策 |
|------|------|------|
| コンテナ起動順序の問題 | depends_on が状態を待たない | `condition: service_healthy` を使用 |
| ポート競合 | 同一ポートが複数プロジェクトで使用 | `.env` でポートを環境変数化 |
| データ消失 | ボリュームなしで停止 | named volume を必ず使用 |
| `latest` タグによる破壊的変更 | イメージ更新で挙動変化 | バージョンタグを固定 |
| 設定を変えたのに反映されない | `up -d` がコンテナを作り直していない（出力が `Started`） | `--force-recreate` を付けて測り直す（「設定変更を反映させる」節） |
| 疎通確認は緑なのにブラウザで動かない | `curl` / `wget` が `Origin` を送らず、オリジン依存の経路を踏んでいない | `-H 'Origin: ...'` を付けた対照を取る（「疎通確認が測っていないもの」節） |
