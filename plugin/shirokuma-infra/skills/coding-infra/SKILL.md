---
name: coding-infra
description: ローカル開発インフラ（docker-compose・スクリプト）の実装・修正を行う。サービス追加・コンテナ設定変更・起動スクリプト整備を担当。Use when 「コンテナ追加」「サービス追加」「docker-compose修正」「起動スクリプト作成」「インフラ設定」と言われたとき。
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
disable-model-invocation: true
---

# インフラ コーディング

docker-compose・シェルスクリプトを使ったローカル開発インフラの実装・修正。

> **スコープ**: ローカル開発環境（docker-compose、起動スクリプト、env テンプレート）に集中する。本番インフラ（AWS、Terraform、CI/CD）は対象外。

## 開始前に

1. プロジェクトの `CLAUDE.md` でサービス構成・命名規則を確認
2. 既存の `docker-compose.yml`（または `compose.yml`）の構造を読んで踏襲する
3. [reference/patterns/infra-conventions.md](reference/patterns/infra-conventions.md) の命名規則・パターンを確認

## ワークフロー

### ステップ 1: 実装計画

進捗トラッカー（全ステップの一覧）を作成し、開始時・完了時に状態を更新する。本 skill はタスク管理ツールを使わないので、手順表を応答本文に状態つき（`todo` / `in_progress` / `done`）で残し、更新のたびに書き直す。手順表は省かない。完了報告には、手順表で進めたことを書く。応答本文の手順表は Stop hook の検知に掛からないので、省いても機械では気づかれない。

```markdown
## 実装計画

### 変更ファイル
- [ ] `docker-compose.yml` - サービス追加・修正
- [ ] `scripts/up-all.sh` - 起動スクリプト更新

### 確認事項
- [ ] ポート競合チェック
- [ ] 依存関係（depends_on）の整合性
- [ ] ヘルスチェック設定
```

### ステップ 2: 実装

`reference/templates/` のテンプレートを使用:
- `docker-compose.dev.yml.template` - プロジェクト初期化用の完成 compose（db＋app の最小 2 サービス）。`db-init.sql.template`（初期化 SQL）・`dev-up.sh.template`（起動スクリプト）とセットで展開する
- `docker-compose-service.yml.template` - 既存 compose にサービスを 1 個足すときの雛形

パターンは [reference/patterns/docker-compose.md](reference/patterns/docker-compose.md) 参照。

サービス移行（イメージ変更など）は [reference/patterns/service-migration.md](reference/patterns/service-migration.md) 参照。

### ステップ 3: 動作確認

```bash
# 設定の構文チェック
cd infra && docker compose config

# サービス起動
cd infra && docker compose up -d {service-name}

# ログ確認
cd infra && docker compose logs -f {service-name}

# ヘルスチェック確認
cd infra && docker compose ps

# 設定を変えた後は作り直してから測る（up -d は作り直さないことがある）
# {service-name} は「設定を変えたサービス」だけを入れる（db 等を巻き込まない）。前提は下記。
cd infra && docker compose up -d --force-recreate {service-name}
```

**`--force-recreate` の前提（対象を絞る）**: このオプションは**指定したサービスのコンテナを作り直す**。ベーステンプレは db＋app の 2 サービスなので、**対象を書かずに打つと db も作り直される**。データが消えないのは **named volume 規約**（[reference/patterns/docker-compose.md](reference/patterns/docker-compose.md) の命名規約・「データ消失 → named volume を必ず使用」）が成り立っているときだけで、**volume 未定義でコンテナ内にデータを持つサービスでは消える**。したがって: ①**規約が成り立っているかを先に確かめる** ②**設定を変えたサービスだけを名前で指定する**。**倒れる向きは fail-silent**——消えたことはコマンドの成否にも `docker compose ps` にも出ない。

**この確認の射程を申告する。** 上のコマンドはいずれも `Origin` ヘッダを送らないので、**リクエスト元オリジンで挙動が変わる経路（dev サーバのクロスオリジン開発リクエスト許可リスト等）を 1 度も測っていない**。`docker compose ps` が healthy でも**ブラウザでは動かない**ことがあり、**倒れる向きは fail-silent（全部緑に見える）**。dev サーバをブラウザから使う構成では、[reference/patterns/docker-compose.md](reference/patterns/docker-compose.md) の「疎通確認が測っていないもの」節の対照（`-H 'Origin: ...'` あり／なし）を取り、**取った／取っていないを完了レポートに書く**。

### ステップ 4: 完了レポート

変更した内容をコメントとして Issue に記録する。

## リファレンスドキュメント

雛形・パターンは本 SKILL.md と同階層の `reference/` 配下。必要時に Read で読む（常時注入しない）。

| ドキュメント | 内容 | 読むタイミング |
|------------|------|--------------|
| [reference/templates/docker-compose.dev.yml.template](reference/templates/docker-compose.dev.yml.template) | dev 環境 compose 最小形（db＋app・healthcheck・named volume・init マウント・`.env.example` 項目つき） | プロジェクトに compose が無い初期化時 |
| [reference/templates/db-init.sql.template](reference/templates/db-init.sql.template) | DB 初期化 SQL 雛形（`db/init/` 配置・スキーマ＋追加 DB 例） | プロジェクトに compose が無い初期化時（compose 展開とセット） |
| [reference/templates/dev-up.sh.template](reference/templates/dev-up.sh.template) | 起動＋ヘルスチェック待ち＋接続情報表示スクリプト | プロジェクトに compose が無い初期化時（compose 展開とセット） |
| [reference/templates/docker-compose-service.yml.template](reference/templates/docker-compose-service.yml.template) | サービス定義テンプレート（1 サービス分） | 既存 compose への新規サービス追加時 |
| [reference/templates/compose.localstack.yml.template](reference/templates/compose.localstack.yml.template) | LocalStack 断片（S3/SQS/SNS/Secrets・ネットワークは base 所有・init を ready.d にマウント） | AWS（S3/SQS/SNS/Secrets）をローカル合成する時。base に `-f` で重ねる |
| [reference/templates/compose.mailpit.yml.template](reference/templates/compose.mailpit.yml.template) | Mailpit 断片（SES 相当・SMTP 1025／Web UI 8025・healthcheck） | メール送信（SES 相当）をローカル合成する時。base に `-f` で重ねる |
| [reference/templates/compose.valkey.yml.template](reference/templates/compose.valkey.yml.template) | Valkey 断片（ElastiCache 相当・`valkey-cli ping` healthcheck・named volume） | キャッシュ／キュー（ElastiCache 相当）をローカル合成する時。base に `-f` で重ねる |
| [reference/templates/localstack-init.sh.template](reference/templates/localstack-init.sh.template) | LocalStack init 最小実例（S3 1＋SQS 1＋SES verify 1・awslocal・足し方コメント） | localstack 断片を使い初期リソースを作る時 |
| [reference/patterns/docker-compose.md](reference/patterns/docker-compose.md) | docker-compose パターン集（設定変更の反映＝`--force-recreate`・疎通確認が測っていない経路を含む） | サービス追加・修正時／動作確認の結果を解釈する時 |
| [reference/patterns/service-migration.md](reference/patterns/service-migration.md) | サービス移行パターン | イメージ変更・リネーム時 |
| [reference/patterns/infra-conventions.md](reference/patterns/infra-conventions.md) | 命名規則・ポート割り当て・ヘルスチェック | インフラ作業の開始前 |
| [reference/patterns/localstack.md](reference/patterns/localstack.md) | LocalStack サービス定義・初期化スクリプト・AWS サービス対応表 | AWS サービスエミュレーション追加時 |
| [reference/patterns/dockerfile.md](reference/patterns/dockerfile.md) | Dockerfile マルチステージビルド・pnpm キャッシュ・セキュリティ | Dockerfile 作成・修正時 |

## クイックコマンド

```bash
# compose 一式は infra/ 配下（cd infra してから実行）
cd infra && docker compose up -d              # 全サービス起動（バックグラウンド）
cd infra && docker compose down               # 全サービス停止
cd infra && docker compose ps                 # サービス状態確認
cd infra && docker compose logs -f {service}  # ログ追跡
cd infra && docker compose config             # 設定の構文検証
cd infra && docker compose pull               # イメージ更新
```

## 次のステップ

`implement-flow` チェーンではなくスタンドアロンで起動された場合:

```
実装完了。次のステップ:
→ `implement-flow` の手順でコミットへ進む（コミットは `commit-worker` が行う）
```

## 注意事項

- **既存構造を踏襲** — プロジェクトの docker-compose 構造・命名規則に従う
- **ポート管理** — [reference/patterns/infra-conventions.md](reference/patterns/infra-conventions.md) のポート割り当て表を参照し競合を避ける
- **ヘルスチェック必須** — 本番準拠サービスにはヘルスチェックを設定する
- **バージョンピン固定** — `latest` タグを避け、バージョンを明示する
