---
name: designing-aws
description: ローカル開発環境（docker-compose）から本番 AWS リソースへのマッピングを設計する。リソース選定・構成設計・CDK コンストラクト設計判断（L2 vs L3）をカバー。Use when 「AWS設計」「リソース設計」「インフラ設計」「本番構成設計」「CDK設計」「クラウド設計」と言われたとき。
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, WebFetch, WebSearch
model: opus
---

# AWS リソース設計

ローカル開発環境のサービスを本番 AWS リソースにマッピングし、CDK コンストラクト設計判断を含む構成設計を行う。

> **AWS リソース設計はこのスキルの責務。** `coding-cdk` はここで決定された設計に基づいて CDK コンストラクトの実装を担当する。

## スコープ

- **カテゴリ:** 調査系ワーカー
- **スコープ:** プロジェクト構成・既存インフラの読み取り（Read / Grep / Glob / Bash 読み取り専用コマンド）、AWS リソース設計ドキュメントの生成（Write/Edit — 設計成果物への書き込み）、Issue 本文への設計セクション追記。
- **スコープ外:** CDK コンストラクトの実装（`coding-cdk` に委任）、AWS リソースの実際のプロビジョニング、Terraform / Pulumi 等の他 IaC ツールの設計

> **設計成果物の書き込みについて**: このスキルが Issue 本文・設計ドキュメントに Write/Edit するのは設計プロセスの成果物であり、プロダクションコードの変更ではない。調査系ワーカーの例外として許可される。

## ワークフロー

### 0. 技術スタック確認

**最初に**、プロジェクトの `CLAUDE.md` を読んで確認:
- 使用フレームワーク（Next.js、Node.js 等）とランタイム
- 既存の docker-compose.yml に定義されているサービス構成
- CDK バージョン（v1 / v2）と言語（TypeScript / Python 等）
- 既存 CDK スタック構成（`infra/` や `cdk/` ディレクトリ等）
- 対象 AWS アカウント / リージョン

導入先のリポに技術スタックの取り決めを書いたファイルがあれば、それも確認する（無ければ飛ばす。Next.js アプリの推奨スタックは shirokuma-nextjs プラグインの `coding-nextjs` skill の `reference/patterns/tech-stack.md`）。

### 1. 設計コンテキスト確認

`design-flow` から委任された場合、Design Brief と要件が渡される。そのまま使用する。

スタンドアロンで起動された場合、Issue 本文と計画セクションから要件を把握する。

### 2. フレームワーク判定ゲート（最初の分岐）

マッピング分析に入る前に、**対象アプリのフレームワークで既定の設計経路を選ぶ**。線形にこのワークフローを辿る設計者が reference 深部に潜らずとも既定に到達するための最上流分岐。

**問い: 対象は Next.js アプリか？**

- **Yes（Next.js アプリ）** → **cdk-nextjs を既定**とする（上書き可能な既定）。[reference/patterns/nextjs-deploy.md](reference/patterns/nextjs-deploy.md) へ分岐し、「4 アーキテクチャ construct の選定マトリクス」と「後から construct を変える（移行容易性）」を引いて既定 `NextjsGlobalFunctions` から設計を始める。ステップ 3 のマッピング分析はこの既定を前提に、キャッシュ層・RDS 等の周辺リソースについて行う。
- **No（cdk-nextjs をデプロイ先にしない）** → **汎用コンテナ経路**へ。[reference/patterns/aws-resource-patterns.md](reference/patterns/aws-resource-patterns.md)（コンピュート選定マトリクス：ECS Fargate + ALB 等）を出発点にステップ 3 のマッピング分析へ進む。実装テンプレは coding-cdk の `stack-structure.ts.template`（フレームワーク非依存の汎用 ECS + ALB + RDS）。**この分岐は非 Next.js アプリ専用ではない**——Next.js アプリでも cdk-nextjs を使わないと決めたならここへ来る。

> **「コンテナで動かすか」はこの分岐ではない**: cdk-nextjs の中にもコンテナ構成があるため、「コンテナ」では Yes / No が決まらない。2 つを別語で区別する（**定義と帰結は [reference/patterns/nextjs-deploy.md](reference/patterns/nextjs-deploy.md) の「2 つのコンテナ経路」節**）:
>
> - **コンテナフレーバー** — cdk-nextjs の container 系 construct（`Nextjs*Containers`。どの construct が該当するかは `nextjs-deploy.md`「2 つのコンテナ経路」節の表を見る）。cdk-nextjs の**中**に留まるので、この分岐は **Yes** のまま。construct の選択は `nextjs-deploy.md` の選定マトリクスで行う。
> - **汎用コンテナ経路** — cdk-nextjs を使わず汎用コンピュート選定（ECS Fargate + ALB 等）で組む。cdk-nextjs の**外**へ出るので、この分岐は **No**。
>
> **どちらを選ぶかで `nextjs-deploy.md` の「互換契約（ハード要件）」の適用可否が反転する**（コンテナフレーバー＝効く／汎用コンテナ経路＝効かない）。既存 Dockerfile を捨てるかどうかがここに乗るので、語を曖昧にしたまま先へ進まない。

> **既定は「上書き可能」**: cdk-nextjs は固定強制ではない。Next.js アプリでも要件によりコンテナフレーバー（cdk-nextjs 内）や汎用コンテナ経路（cdk-nextjs 外）を選べる。

### 3. ローカル↔本番マッピング分析

既存の docker-compose.yml からサービスを列挙し、各サービスに対応する AWS リソースを決定する。

詳細なマッピングテーブルは [reference/patterns/local-to-prod-mapping.md](reference/patterns/local-to-prod-mapping.md) 参照。

#### 設計観点

| 観点 | 対処するタイミング | パターン参照 |
|------|------------------|-------------|
| コンピュート選定 | アプリケーションのホスティング方法 | [reference/patterns/aws-resource-patterns.md](reference/patterns/aws-resource-patterns.md) - コンピュート |
| データストア選定 | RDS / DynamoDB / ElastiCache の選択 | [reference/patterns/aws-resource-patterns.md](reference/patterns/aws-resource-patterns.md) - データストア |
| メッセージング選定 | SQS / SNS / EventBridge の選択 | [reference/patterns/aws-resource-patterns.md](reference/patterns/aws-resource-patterns.md) - メッセージング |
| ストレージ選定 | S3 バケット設計、ライフサイクル | [reference/patterns/aws-resource-patterns.md](reference/patterns/aws-resource-patterns.md) - ストレージ |
| **静的資産の配信** | **CDN から静的資産を配るなら必ず**（構成の選択に依らず通る）。配信経路 A/B の選定と、Content-Type・圧縮・キャッシュ | [reference/patterns/static-asset-delivery.md](reference/patterns/static-asset-delivery.md) |
| **接続の寿命** | **SSE / ストリーミング / WebSocket を持つなら必ず**（構成に依らず通る。ただし reference の記述は **ALB 経路が射程**で、それ以外は未確認と申告されている）。アイドルタイムアウトと heartbeat の関係・前段のバッファリング | [reference/patterns/long-lived-connections.md](reference/patterns/long-lived-connections.md) |
| ネットワーク設計 | VPC、サブネット、セキュリティグループ | [reference/patterns/aws-resource-patterns.md](reference/patterns/aws-resource-patterns.md) - ネットワーク |
| CDK コンストラクト設計 | L2 vs L3、Props 設計 | [reference/patterns/aws-resource-patterns.md](reference/patterns/aws-resource-patterns.md) - CDK |
| セキュリティ設計 | IAM ロール、Secrets Manager | [reference/patterns/aws-resource-patterns.md](reference/patterns/aws-resource-patterns.md) - セキュリティ |

#### 決定フレームワーク

各観点について評価する:

1. **要件**: ローカルサービスが担う機能は？可用性・スケール要件は？
2. **制約**: コスト上限、リージョン制約、チームの AWS 習熟度
3. **選択肢**: 実行可能な AWS サービスを列挙（aws-resource-patterns.md 参照）
4. **トレードオフ**: 決定マトリクスでオプションを比較
5. **決定**: 根拠を添えてリソースを選択

### 4. 設計出力

構造化されたドキュメントとして AWS リソース設計を作成する:

```markdown
## AWS リソース設計

### サービスマッピング
| ローカル（docker-compose） | AWS リソース | 備考 |
|---------------------------|-------------|------|
| {service-name} | {AWS サービス} | {設定方針} |

### リソース詳細

#### {リソース名}
- **サービス**: {AWS サービス識別子}
- **設定方針**: {主要設定パラメータ}
- **スケーリング**: {オートスケーリング戦略}
- **コスト見積もり**: {概算}

### CDK コンストラクト設計
| コンストラクト | レベル | 理由 |
|-------------|-------|------|
| {construct-name} | L2 / L3 | {選択根拠} |

### ネットワーク構成
{VPC、サブネット、セキュリティグループの設計}

### セキュリティ設計
{IAM ロール、最小権限原則、シークレット管理方針}

### 主要決定事項
| 決定 | 選択 | 根拠 |
|------|------|------|
| {トピック} | {サービス/パターン} | {理由} |
```

### 5. レビューチェックリスト

- [ ] 全ローカルサービスに対応する AWS リソースが定義されている
- [ ] CDK コンストラクトのレベル（L1/L2/L3）選択に根拠がある
- [ ] IAM ロールが最小権限原則に従っている
- [ ] シークレット（DB パスワード等）が Secrets Manager / Parameter Store で管理される
- [ ] VPC 設計でプライベートサブネットが適切に使用されている
- [ ] スケーリング戦略が要件に合致している
- [ ] マルチ AZ 対応が検討されている
- [ ] CDN から静的資産を配るなら、**配信経路（A: オリジン / B: S3）を選んだ根拠**と、**Content-Type / 圧縮 / キャッシュを確認した結果**が書かれている（未確認の資産があるならそう書かれている）
- [ ] 長時間接続を持つなら、**実効アイドルタイムアウト値・heartbeat 間隔・前段プロキシの有無と種別・切断時の挙動**の 4 点が書かれている（`long-lived-connections.md` が具体的に書いているのは **ALB 経路だけ**。ALB を持たない構成〔既定 `NextjsGlobalFunctions` 等〕では値の出所が**未確認**なので、**引けなかったならそう書かれている**——空欄は不可。静的資産側の「未確認の資産があるならそう書かれている」と同じ規律）
- [ ] コスト見積もりが現実的範囲に収まっている

## リファレンスドキュメント

| ドキュメント | 内容 | 読むタイミング |
|------------|------|--------------|
| [reference/patterns/nextjs-deploy.md](reference/patterns/nextjs-deploy.md) | Next.js 本番デプロイ既定（cdk-nextjs・4 construct 規模別選定・移行容易性） | フレームワーク判定ゲートで Next.js を選んだ時 |
| [reference/patterns/aws-resource-patterns.md](reference/patterns/aws-resource-patterns.md) | AWS リソース選定パターン | リソース選択・CDK 設計時 |
| [reference/patterns/local-to-prod-mapping.md](reference/patterns/local-to-prod-mapping.md) | ローカル↔本番マッピングテーブル | マッピング確認時 |
| [reference/patterns/static-asset-delivery.md](reference/patterns/static-asset-delivery.md) | 静的資産の配信経路（CDN → オリジン／CDN → S3）の選定・プレフィックスの受け口・配信属性（Content-Type / 圧縮 / キャッシュ） | CDN から静的資産を配る設計をする時（construct 選択に依らず） |
| [reference/patterns/long-lived-connections.md](reference/patterns/long-lived-connections.md) | 接続の寿命（アイドルタイムアウトと heartbeat の関係・前段のバッファリング・切断時の挙動）。**射程は ALB 経路**——ALB を持たない構成は未確認 | SSE / ストリーミング / WebSocket を持つ設計をする時 |
| [reference/patterns/env-mapping.md](reference/patterns/env-mapping.md) | 環境変数マッピングパターン | 環境変数設計時 |
| [reference/patterns/account-isolation.md](reference/patterns/account-isolation.md) | アカウント分離戦略（段階移行・OU 構成・移行トリガー） | 本番/検証のアカウント境界設計時 |

> LocalStack のエンドポイント切り替えパターンは委任ブリーフで渡される（または coding-infra スキル併用時にその reference を読む）。

## アンチパターン

| パターン | 問題 | 代替案 |
|---------|------|--------|
| 全リソースをパブリックサブネットに配置 | セキュリティリスク | DB・内部サービスはプライベートサブネットへ |
| L1 コンストラクト多用 | CloudFormation の raw JSON を TypeScript で書く状態になる | L2 から始め、カスタマイズが必要な場合のみ L1 を使用 |
| シークレットを環境変数で直接渡す | セキュリティリスク、ローテーション困難 | Secrets Manager + ECS タスク定義の `secrets` フィールド |
| 単一 AZ 構成 | 可用性ゼロダウン設計 | マルチ AZ を RDS / ALB に適用 |
| CDK スタックを1つに集約 | デプロイ単位が大きく変更時のリスクが増大 | Network / Stateful（DB）/ Stateless（App）で分割 |
| 過剰スペック選定 | コスト超過 | 要件を満たす最小のサービスから始めてスケールアップ |

## 次のステップ

`design-flow` 経由で呼ばれた場合、制御は自動的にオーケストレーターに戻る。

スタンドアロンで起動された場合:

```
AWS リソース設計完了。次のステップ:
-> coding-cdk スキルで CDK コンストラクトを実装
-> フルワークフローが必要な場合は /design-flow を使用
```

## 注意事項

- **設計判断がこのスキルの最優先事項** — CDK の実装詳細は `coding-cdk` の責務
- **ビルド検証は不要** — このスキルは設計ドキュメントを生成し、実行可能コードは作成しない
- Design Brief が渡された場合はそれに基づいて設計。スタンドアロン時は Issue から要件を把握してから設計
- AWS サービスの可用性リージョン差異に注意（使うリージョンでの提供状況を AWS のリージョン別サービス一覧で確かめる）
- コスト見積もりは概算で十分。詳細は AWS Pricing Calculator に委ねる
