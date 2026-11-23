---
name: reviewing-aws
description: AWS インフラ構成のレビューを行う。IAM ポリシー・セキュリティグループ・Well-Architected フレームワーク・コスト最適化・可用性設計をレビュー。Use when 「AWSレビュー」「インフラレビュー」「IAMレビュー」「aws review」「セキュリティグループレビュー」「Well-Architectedレビュー」と言われたとき。
allowed-tools: Read, Grep, Glob, Bash, WebSearch, WebFetch
model: opus
disable-model-invocation: true
---

# AWS インフラ構成レビュー

AWS リソース構成のコードレビューを行う。IAM 最小権限、セキュリティグループ設計、Well-Architected フレームワーク準拠、コスト最適化に集中する。

## スコープ

- **読み手:** review-flow のレビューの担い手（review-worker）が、SKILL.md と reference を Read で文書として読んで観点に合算する（Skill では起動しない）。
- **スコープ:** CDK コード / IaC ファイルの読み取り（Read / Grep / Glob / Bash 読み取り専用）、レビューレポートの生成。コードの修正・AWS リソースのプロビジョニングは行わない。
- **スコープ外:** CDK コードの修正（`coding-cdk` に委任）、実際の AWS リソース変更

## レビュー観点

### IAM セキュリティ（最小権限原則）

| チェック項目 | 問題 | 修正方針 |
|------------|------|---------|
| ワイルドカード Action | `"Action": "*"` または `"Action": "s3:*"` | 必要な Action を列挙 |
| ワイルドカード Resource | `"Resource": "*"` | 特定リソース ARN を指定 |
| IAM PassRole | 過剰な PassRole 権限 | 特定ロール ARN に制限 |
| インラインポリシー | インラインポリシーの使用 | マネージドポリシーを推奨 |
| MFA 強制 | 管理操作に MFA なし | MFA 条件を Condition に追加 |
| クロスアカウント | `"Principal": "*"` | 特定アカウント ID / IAM エンティティを指定 |

### ネットワーク / セキュリティグループ

| チェック項目 | 問題 | 修正方針 |
|------------|------|---------|
| 0.0.0.0/0 インバウンド | 全 IP からのアクセス許可 | 特定 CIDR / セキュリティグループ参照 |
| SSH/RDP 開放 | ポート 22/3389 を全 IP に開放 | VPN / SSM Session Manager を使用 |
| パブリックサブネットの DB | RDS / ElastiCache をパブリック配置 | プライベートサブネットに移動 |
| セキュリティグループ間参照 | CIDR 参照のみ | セキュリティグループ間参照を使用 |
| NACLs の欠如 | 追加のネットワーク層なし | 機密サブネットに NACL を推奨 |

### 可用性 / 耐障害性

| チェック項目 | 問題 | 修正方針 |
|------------|------|---------|
| シングル AZ | 単一 AZ にリソース集中 | マルチ AZ 構成を推奨 |
| 単一インスタンス | ASG なしの単一 EC2 | Auto Scaling Group を導入 |
| RDS フェイルオーバー | Multi-AZ 未設定 | `multiAz: true` を設定 |
| バックアップ設定 | RDS バックアップ保存期間が短い / なし | 最低 7 日間を推奨 |
| ヘルスチェック | ALB ターゲットにヘルスチェックなし | 適切なパスとしきい値を設定 |

### コスト最適化

| チェック項目 | 問題 | 修正方針 |
|------------|------|---------|
| インスタンスサイズ | 過剰スペック | Compute Optimizer の推奨を確認 |
| リザーブドインスタンス | オンデマンドのみ | 長期稼働には RI / Savings Plans を検討 |
| NAT ゲートウェイ | 全 AZ に NAT GW | トラフィックパターンに応じて削減 |
| 未使用 EIP | アタッチされていない Elastic IP | 削除または解放 |
| ライフサイクルポリシー | S3 バケットにライフサイクルなし | 古いオブジェクトの Glacier 移行 |

### データ保護

| チェック項目 | 問題 | 修正方針 |
|------------|------|---------|
| 暗号化 | EBS / RDS / S3 の暗号化なし | KMS キーで暗号化を有効化 |
| バケット公開 | S3 バケットが公開 | `blockPublicAccess: BlockPublicAccess.BLOCK_ALL` |
| シークレット管理 | Lambda 環境変数に平文シークレット | Secrets Manager / Parameter Store を使用 |
| CloudTrail | API ログが未設定 | CloudTrail を有効化 |
| GuardDuty | 脅威検知が未設定 | GuardDuty の有効化を推奨 |

### タグ付け

| チェック項目 | 問題 | 修正方針 |
|------------|------|---------|
| 必須タグ欠如 | `Environment` / `Project` タグなし | CDK Aspects でタグ付けを強制 |
| コスト配賦タグ | チーム/機能別タグなし | `CostCenter` タグを追加 |

### framework 既定との整合

対象が Next.js アプリの場合、AWS デプロイ構成が cdk-nextjs 既定（既定フレーバー `NextjsGlobalFunctions` 起点・上書き可能な既定）と整合しているかをレビューする。

> **cdk-nextjs をデプロイ先にしない構成は固定語「汎用コンテナ経路」で呼ぶ**。**判定軸はフレームワーク名ではない**ので「非 Next.js だから」で分けない——Next.js アプリが汎用コンテナ経路を選ぶのは正当な選択肢であり、レビューで求めるのは選択の Why であって選択そのものの是正ではない。語の定義（コンテナフレーバー／汎用コンテナ経路）と帰結の正本は designing-aws スキルの `reference/patterns/nextjs-deploy.md`「2 つのコンテナ経路」節。 **construct 選定の判断基準そのものの正本は同ファイルの「4 アーキテクチャ construct の選定マトリクス」**で、下表の各行はそれを引くための入口として要点だけを持つ（**全件の列挙は持たない**）。

| チェック項目 | 問題 | 修正方針 |
|------------|------|---------|
| framework 既定の逸脱 | Next.js アプリなのに cdk-nextjs をデプロイ先にせず**汎用コンテナ経路**（ECS Fargate + ALB + VPC 3 分割等）を手組み | 特段の理由がなければ cdk-nextjs 既定（`NextjsGlobalFunctions` 起点）へ寄せる。**汎用コンテナ経路の選択自体は違反ではない**ので、求めるのは設計上の Why の記載であって構成の是正ではない |
| construct 規模の不一致 | 規模・トラフィック特性に対し過剰/過小な construct 選定 | CloudFront 可否（Global/Regional）と運用・トラフィック特性（`NextjsGlobalFunctions`=可変・小トラフィックで最小コスト／`NextjsGlobalContainers`=予測可能な高トラフィック・最低レイテンシ・コンテナ運用向き）で選定根拠を確認。迷えば既定 `NextjsGlobalFunctions` |
| Web/RDS スタック同居 | Web（cdk-nextjs）と RDS を同一 CloudFormation スタックに同居 | 別スタックへ分離（blast radius 抑制） |

> **cdk-nextjs 経路の例外注記**: cdk-nextjs の construct（`NextjsGlobalFunctions` 等）は network（CloudFront/Lambda/ALB・必要時 VPC）と cache 層（S3/DynamoDB）を construct 内部に内包する設計のため、**Network/Stateful/Stateless の 3 分割が構成に現れないことは違反ではない**（construct が network 層とアプリ〔stateless〕層を内部に引き受けるため 3 分割が縮退し、別スタックに残るのは隣接 stateful〔アプリ固有の RDS/ElastiCache 等〕のみ、という縮退設計による）。可用性・ネットワーク観点を cdk-nextjs 経路へ機械適用して「3 分割の欠如」を NEEDS_REVISION にしないこと。**この例外は cdk-nextjs 経路に限る**。**汎用コンテナ経路**（cdk-nextjs をデプロイ先にしない構成。手書き `AppService` + VPC 等）で全リソースを安易に単一集約するアンチパターンは通常どおり指摘する（例外を広げない）。

## ワークフロー

### 1. 対象ファイルの確認

```bash
# CDK スタックファイルの確認
find . -path "*/lib/*-stack.ts" | head -20
find . -path "*/bin/*.ts" | head -10

# IAM ポリシーの確認
grep -r "PolicyStatement\|addToPolicy\|attachInlinePolicy" --include="*.ts" -l | head -10

# セキュリティグループの確認
grep -r "SecurityGroup\|addIngressRule\|addEgressRule" --include="*.ts" -l | head -10
```

### 2. コード分析

CDK コードを読み込み、レビュー観点テーブルを適用する。

優先チェック順:
1. IAM 最小権限違反（セキュリティリスク）
2. ネットワーク開放問題
3. 可用性設計（シングル AZ）
4. データ保護（暗号化・シークレット管理）
5. コスト最適化

### 3. レポート生成

**判定行契約・レポート雛形・深刻度定義はコア review-flow 側（`reference/templates/report.md`）が正本**で、本 skill は観点を足すだけ。下の形は本 skill の観点の所見をまとめる例で、判定行の形と値域はコア側に合わせる。

```markdown
**レビュー結果:** PASS | NEEDS_REVISION

## レビュー結果サマリー

### 問題サマリー
| 深刻度 | 件数 |
|--------|------|
| Critical | {n} |
| High | {n} |
| Medium | {n} |
| Low | {n} |
| **合計** | **{n}** |

### 重大な問題
{IAM・ネットワーク・暗号化問題を列挙}

### 改善点
{可用性・コスト最適化提案を列挙}
```

### 4. レポート保存

レポートの置き場と GitHub への記録は、レビューの担い手の手順（review-worker の回は委任ブリーフ）が決める。この skill は書き込み先を決めない。

- **GitHub へのコメントは、委任ブリーフが頼んだ回だけ**書く。PR へのコメントには判定行をフェンスの外に書かない（判定記録の読み手が記録と読み、形式外として merge を人ゲートへ倒す）。merge の可否を決める判定記録は、レビューの担い手ではなくメインが CLI で書く。
- 書き込み先を頼まれていない回は、判定行と指摘を完了報告（返事）に含める。CLI は Discussion へ書き込む verb を持たないので、レポートを Discussion へは投稿しない。

## レビュー結果の判定

- **PASS**: `**レビュー結果:** PASS` — 重大な問題なし
- **NEEDS_REVISION**: `**レビュー結果:** NEEDS_REVISION` — 差し戻し。Critical/High 問題あり（IAM ワイルドカード・公開アクセス・暗号化なし等）

判定行はレポートの**最初の行**に置き、値はこの 2 値のみを使う（他の値は走査に一致せず分岐が成立しない）。一字一句合わせるのは判定行の位置とマーカーの形であって値の列挙ではない——雛形の `PASS | NEEDS_REVISION` は値域の表記なので、実出力ではどちらか **1 値だけ**を書く（両値を並べた行をそのまま出すと走査が PASS と読み取り差し戻しが消える）。

## 注意事項

- **コードの修正は行わない** — 所見の報告のみ
- Well-Architected フレームワークの 6 柱（運用上の優秀性・セキュリティ・信頼性・パフォーマンス効率・コスト最適化・持続可能性）を念頭に置く
- リージョン固有の制限に注意（使うリージョンでの提供状況を確かめる）
