# サービス移行パターン

サービスのイメージ変更・コンテナ名変更・ボリューム移行など、既存サービスの構成を変更する際のパターン。

## イメージ移行（例: Redis → Valkey）

### 背景

Redis 7.4 以降はライセンスが RSALv2 / SSPLv1 のデュアルに変わった（8.0 から AGPLv3 も選べる。7.2 以前は BSD-3-Clause のまま）。OSS プロジェクトでは Valkey（BSD-3-Clause）への移行を推奨。Valkey は Redis 互換 API を提供するため、アプリケーションコードの変更は不要。

### 手順

```bash
# 1. 既存コンテナを停止
docker compose stop {old-service}

# 2. docker-compose.yml でイメージを変更
#    image: redis:7-alpine → image: valkey/valkey:9-alpine

# 3. container_name も更新（任意）
#    container_name: {project}-redis → container_name: {project}-valkey

# 4. 新しいサービスを起動
docker compose up -d {new-service}

# 5. 旧コンテナを削除
docker compose rm -f {old-service}
```

### docker-compose.yml の変更例

```yaml
# 変更前
redis:
  image: redis:7-alpine
  container_name: {project}-redis
  ports:
    - "${REDIS_PORT:-6379}:6379"
  volumes:
    - redis-data:/data

# 変更後
valkey:
  image: valkey/valkey:9-alpine
  container_name: {project}-valkey
  ports:
    - "${VALKEY_PORT:-6379}:6379"
  volumes:
    - valkey-data:/data
```

### 関連ファイルの更新

サービス名変更が伴う場合、以下も確認して更新する:

| ファイル | 更新内容 |
|---------|---------|
| `docker-compose.yml` | サービス名・イメージ・ボリューム名 |
| `.env` / `.env.example` | 環境変数キー名（`REDIS_URL` → `VALKEY_URL` など） |
| `depends_on` を持つ他サービス | 依存サービス名の更新 |
| アプリ設定ファイル | 接続文字列（ホスト名がサービス名の場合） |
| `scripts/*.sh` | サービス名を指定する起動スクリプト |

## コンテナ名変更

コンテナ名のみを変更する場合（イメージはそのまま）:

```bash
# 旧コンテナを停止・削除
docker compose stop {old-name}
docker compose rm -f {old-name}

# docker-compose.yml の container_name を更新後
docker compose up -d {service-key}
```

## ボリューム移行

データを保持しながらボリューム名を変更する場合:

```bash
# 1. ソースボリュームのデータを一時コンテナ経由でコピー
docker run --rm \
  -v {old-volume}:/source:ro \
  -v {new-volume}:/dest \
  alpine sh -c "cp -av /source/. /dest/"

# 2. 移行確認
docker run --rm -v {new-volume}:/data alpine ls /data

# 3. docker-compose.yml のボリューム名を更新して起動
docker compose up -d
```

## ロールバック手順

移行に問題が発生した場合:

```bash
# 新サービスを停止
docker compose stop {new-service}

# docker-compose.yml を旧設定に戻す
git checkout docker-compose.yml

# 旧サービスを再起動
docker compose up -d {old-service}
```

## チェックリスト

移行完了後に確認する項目:

- [ ] 新サービスのヘルスチェックが passing
- [ ] アプリケーションが正常に接続できる
- [ ] 旧コンテナ・旧ボリュームが残っていないか確認
- [ ] `.env.example` が更新されている
- [ ] README や CLAUDE.md のサービス一覧が更新されている
