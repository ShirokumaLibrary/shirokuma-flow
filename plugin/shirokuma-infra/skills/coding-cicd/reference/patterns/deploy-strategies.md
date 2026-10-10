# デプロイ戦略パターン

## 戦略比較マトリクス

| 戦略 | 概要 | ダウンタイム | ロールバック速度 | 複雑さ | 推奨ユースケース |
|------|------|------------|----------------|--------|----------------|
| Rolling | 旧バージョンを段階的に新バージョンに差し替え | なし（ECS/K8s） | 中（再デプロイ） | 低 | 標準的なコンテナサービス |
| Blue/Green | 旧（Blue）と新（Green）を並列実行し DNS 切替 | なし | 高速（DNS 切替） | 中 | ゼロダウンタイム必須・ロールバックを重視 |
| Canary | 一部トラフィック（5%→25%→100%）を段階的に新バージョンへ | なし | 中（重み付け戻し） | 高 | 新機能の段階リリース・リスク最小化 |
| Recreate | 旧バージョンを停止してから新バージョンを起動 | あり | 中（再デプロイ） | 最低 | dev 環境・ステートフルアプリ |

> **DB スキーマ変更を伴うデプロイ**では、戦略の選択だけでは決まらない軸が 4 つ残る（実行媒体・打つ位置・失敗時の扱い・ネットワーク）。**戦略を決めた直後に** [db-migration-delivery.md](db-migration-delivery.md) を読んで 4 軸を決める。**失敗時の扱いは戦略ごとに違う**ので、同ファイルの「軸 3: 失敗時の扱い（デプロイ戦略ごと）」を上表の戦略と対応させて読む。

### GitHub Actions での実現

| 戦略 | GitHub Actions の実装 |
|------|----------------------|
| Rolling | ECS Update Service / Kubernetes apply（デフォルト動作） |
| Blue/Green | ECS Blue/Green（CodeDeploy 統合）または ALB 重み付けルーティング |
| Canary | ALB の加重ターゲットグループ / Lambda エイリアスの重み付け |
| Recreate | `docker compose down && docker compose up` / ECS Force New Deployment |

## GitHub Environments 承認フロー設計

### 推奨構成（3環境）

```
開発ブランチ push      → dev 環境（自動デプロイ）
                              ↓ 成功
mainline ブランチ push → staging 環境（自動デプロイ）
                              ↓ 成功 + 手動承認
                        production 環境（手動承認後デプロイ）
```

> **mainline** はそのリポジトリの既定ブランチ（`main` / `master` / `develop` 等）。`gh repo view --json defaultBranchRef -q .defaultBranchRef.name` で確認する。**開発ブランチ**は dev 環境へ自動デプロイする別のブランチ（`develop` / `dev` 等）で、**mainline とは必ず別名**でなければならない（同じだと 1 回の push で dev / staging / prod が同時に発火する）。開発ブランチを持たない運用なら dev 経路そのものを削除する。
>
> ワークフローの `on.push.branches` や `if:` 条件、および**本ファイル中の shell 例に出るブランチ名**は、すべて自分のリポジトリの実際の名前に読み替えること。`main` 決め打ちは、mainline が `main` でないときデプロイが赤くならずに skip される＝**沈黙する**失敗になる。

### GitHub Environments 設定手順

1. リポジトリ Settings → Environments → New environment
2. 各環境を作成:
   - `dev`: Protection rules なし（自動）
   - `staging`: Protection rules なし（自動、または Required reviewers 1名）
   - `production`: Required reviewers（最低1名）+ Wait timer（任意）

### ワークフローでの参照

```yaml
jobs:
  deploy-dev:
    environment: dev          # 自動デプロイ
    runs-on: ubuntu-latest

  deploy-staging:
    environment: staging      # 自動または軽量承認
    needs: deploy-dev

  deploy-prod:
    environment: production   # 必須手動承認
    needs: deploy-staging
```

> `environment:` に指定する名前は GitHub Environments の名前と完全一致が必要。

### Deployment Protection Rules

| ルール | 設定箇所 | 推奨値 |
|--------|---------|--------|
| Required reviewers | GitHub Environments 設定 | production: 最低1名 |
| Wait timer | GitHub Environments 設定 | production: 0〜5分（デプロイ前の最終確認猶予） |
| Branch policy | GitHub Environments 設定 | production: mainline ブランチのみ許可 |

## ロールバック手順

### パターン 1: 前のリリースタグを再デプロイ（推奨）

前のタグを再プッシュして CD ワークフローをトリガーする。イメージタグが不変であることが前提。

```bash
# 前のリリースタグを確認
git tag -l --sort=-version:refname | head -5

# mainline ブランチ名を実測する（決め打ちしない）
MAIN_BRANCH="$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)"

# 本番に出ている mainline の先端を起点にする（今いるブランチの HEAD ではない）
git fetch origin
git switch -c "rollback/{説明}" "origin/$MAIN_BRANCH"

# revert コミットを作り、rollback ブランチ経由で mainline へ PR を出す
git revert --no-commit HEAD
git commit -m "revert: {説明} (#N)"
git push origin "rollback/{説明}"
gh pr create --base "$MAIN_BRANCH" --head "rollback/{説明}" --fill
# merge されると mainline への push で CD がトリガーされる
```

> ⚠️ **起点ブランチを明示すること**。`git revert HEAD` は実行時のカレントブランチに依存するので、feature ブランチ上でそのまま実行すると本番と無関係なコミットを revert し、PR に余計な差分まで巻き込む。上のように `origin/$MAIN_BRANCH` から切り直す。
>
> ⚠️ ブランチ名を決め打ちしないこと。mainline を `main` から移行済みでも**旧 `main` ブランチが残っている**リポジトリでは `git push origin main` が**成功してしまい**、revert が誰も見ていないブランチに積まれて CD がトリガーされない——ロールバックが静かに空振りする。緊急時ほどこの沈黙は高くつく。保護が無く緊急で直接 push する場合も、決め打ちではなく `git push origin "HEAD:$MAIN_BRANCH"` と実測値を使う。
>
> ⚠️ **二次防御層（hook の block 判定）は照合の前段で引用符の内側を不透明な 1 トークンへ置換する**ので、**pattern が literal で必要とする値——mainline 直接 push を止める rule なら mainline 名そのもの——を引用符で括ると、deny が allow へ反転する**。**「括らない」の射程はその値だけで、引数一般を裸にするという意味ではない**——上のブロックが `"$MAIN_BRANCH"` / `"rollback/{説明}"` を括っているのは、変数展開と空白を含みうる値を裸にすると語分割・グロブで壊れるからで、**そちらの引用は外さない**（外してもこの層の判定は強くならない: `gh pr create` を捕まえる rule は pattern が verb 名だけを要求するので、引数の引用有無によらずマッチする）。射程と倒れる向きの正本は shirokuma-flow プラグインの `autonomous-flow` skill の `reference/criteria/irreversible-operations.md`。実際の判定は `shirokuma-flow hooks evaluate` に当該コマンド形を渡して確かめられる。

> ⚠️ **PR 経由は「直接 push 禁止」は回避できるが、保護のすべてを回避できるわけではない**。required reviewers や required status checks が設定されていれば、この PR も approve と CI 完走を待たないと merge できない——緊急ロールバックで実際に詰まるのはここ。**平時のうちに**緊急時の扱い（admin merge を許可するか・誰が承認できるか・production Environments の承認者は誰か）を決めておくこと。手順として回らないことに障害中に気づくのが最悪。

### パターン 2: GitHub Actions の re-run（緊急時）

GitHub UI または CLI から前の成功した run を再実行する。

```bash
# 前の run を確認
gh run list --workflow=cd.yml --limit 5

# 特定の run を再実行
gh run rerun {run-id}
```

### パターン 3: ECS の手動ロールバック（最終手段）

```bash
# 現在のサービス設定を確認
aws ecs describe-services \
  --cluster {cluster-name} \
  --services {service-name} \
  --query 'services[0].taskDefinition'

# 前のタスク定義リビジョンにロールバック
aws ecs update-service \
  --cluster {cluster-name} \
  --service {service-name} \
  --task-definition {family-name}:{previous-revision}
```

## デプロイ前チェックリスト

| チェック項目 | 確認方法 |
|------------|---------|
| テスト全件パス | CI ワークフローの結果確認 |
| ビルド成功 | CI の build ジョブ確認 |
| staging での動作確認 | テスト・煙幕テスト（smoke test）実行 |
| マイグレーション計画 | DB スキーマ変更がある場合は前後互換性を確認。**どちらの互換性が要るかは打つ位置で決まる**ので、先に [db-migration-delivery.md](db-migration-delivery.md) の「軸 2: 打つ位置（順序）」で位置を決める |
| ロールバック可否 | 不可逆な変更（DB マイグレーション）の有無を確認。判定は [db-migration-delivery.md](db-migration-delivery.md) の「軸 2: 打つ位置（順序）」の「段 1 と段 3 を同じデプロイに混ぜない」で行う |
| 監視設定 | デプロイ後のアラート閾値・通知先を確認 |
