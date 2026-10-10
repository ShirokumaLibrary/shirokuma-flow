# AWS リソース設計パターン

## コンピュート

### 選定マトリクス

| ユースケース | 推奨サービス | 理由 |
|------------|------------|------|
| Web アプリ（コンテナ） | ECS Fargate | サーバーレス、運用負荷低 |
| Web アプリ（高トラフィック） | ECS EC2 + Auto Scaling | コスト最適化、CPU/メモリ柔軟 |
| 短時間バッチ処理 | Lambda | イベント駆動、コスト効率 |
| 長時間バッチ処理 | ECS Fargate Tasks | 15 分超のタスクに対応 |
| モノリシック移行 | App Runner | 最小運用負荷、コンテナイメージから直接 |
| ML 推論 | SageMaker Inference | GPU、モデル管理統合 |

> **Next.js アプリの本番デプロイは特化既定を持つ**: 本表は**汎用コンテナ経路**（cdk-nextjs をデプロイ先にしない構成。ライブラリ非依存の汎用パターン）向け。**Next.js アプリは `nextjs-deploy.md`（同一 patterns ディレクトリ）の cdk-nextjs 既定**（`NextjsGlobalFunctions` ほか 4 構成の選定マトリクス）を出発点にする。汎用パターンは**汎用コンテナ経路**（cdk-nextjs を使わない構成。非 Next.js アプリと、cdk-nextjs を使わないと決めた **Next.js アプリの両方を含む**）で引き続き有効（層として重ねる）。**cdk-nextjs のコンテナフレーバー（`Nextjs*Containers`）はここに当たらない**——それは cdk-nextjs の中の選択肢なので `nextjs-deploy.md` の選定マトリクスで選ぶ。語の定義と帰結（互換契約の適用可否が反転する）は `nextjs-deploy.md` の「2 つのコンテナ経路（語の定義）」節。

### ECS Fargate 設定パターン

```
CPU: 0.25vCPU（256）、0.5vCPU（512）、1vCPU（1024）、2vCPU（2048）
メモリ: CPU に対して 512MB〜4GB の範囲で設定
タスク数: 最小 2（マルチ AZ）
```

### ALB + ECS 構成（標準パターン）

```
Internet Gateway
    ↓
ALB（パブリックサブネット）
    ↓
ECS Fargate タスク（プライベートサブネット）
    ↓
RDS / ElastiCache（プライベートサブネット）
```

> **この図は接続の寿命を決めていない**: ALB を通す構成で SSE / ストリーミング / WebSocket のように**接続を張り続ける**なら、アイドルタイムアウトと heartbeat の関係・前段のバッファリングを別途決める。正本は [long-lived-connections.md](long-lived-connections.md)（同一 patterns ディレクトリ）。決めずに実装へ進むと後から構成変更になる。

---

## データストア

### RDB 構築方式マトリクス（運用モード × エンジン）

RDB は**単一固定でなく、負荷特性・規模・可用性要件で運用モードを選ぶ**。運用モード軸（Aurora Serverless v2 / Aurora provisioned / 通常 RDS インスタンス）×エンジン軸（PostgreSQL / MySQL）の decision matrix を出発点にする。

| 要件 | 方式 | エンジン | Why |
|------|------|---------|-----|
| 可変・断続負荷／コスト最小化／開発・検証 | Aurora Serverless v2（ACU 最小運用） | PostgreSQL / MySQL | アイドル時に ACU を最小へ自動縮小・従量課金。既存 `stack-structure.ts.template` の既定と一致 |
| 予測可能・定常低負荷の小規模本番 | 通常 RDS インスタンス（t4g.micro / small） | PostgreSQL / MySQL | 常時低負荷では固定小額でシンプル。Serverless v2 の ACU 課金より安いことがある |
| 高可用・スケール本番 | Aurora（Serverless v2 or provisioned）Multi-AZ + reader | PostgreSQL / MySQL | フェイルオーバー・読み取りスケール |

- **エンジン既定は PostgreSQL**（既存テンプレ・patterns が Postgres 中心）。ただし**テンプレ Props で MySQL も選択可能**とする。方式 × エンジンの 4 値（`aurora-postgres` / `aurora-mysql` / `rds-postgres` / `rds-mysql`）を想定し、Props でモードとエンジンを受け取って切り替える（テンプレ実装＝`web-rds-split-stack.ts.template` 側で両対応）。
- **迷ったら Aurora Serverless v2**（既定の出発点）。負荷が予測可能で定常低負荷なら通常 RDS インスタンスへ、本番で高可用・読み取りスケールが要るなら Aurora Multi-AZ + reader へ寄せる。
- **Web/RDS スタック分離と表裏一体**: RDS は Web（cdk-nextjs）とは別 CloudFormation スタック（`DataStack`）に置き、本番は `deletionProtection` + `RemovalPolicy.RETAIN` で blast radius を抑える。スタック間参照は SSM / Secrets Manager の名前解決（疎結合）を既定にし、CFN export の削除ロックを避ける。
- **版照合注記（実装時〔`coding-cdk`〕に確認）**: (1) Aurora Serverless v2 の最小 ACU 0 対応は cdk / エンジン版依存のため、ピン版で `serverlessV2MinCapacity` の 0 許容を照合する。(2) `rds.PostgresEngineVersion` / `rds.AuroraPostgresEngineVersion` enum の該当バージョン実在をピン版の型定義で照合する（本 matrix は方式選定まで・実 API 版照合は実装時）。

### 単純 RDB 選定（用途別クイックリファレンス）

上記マトリクスの補助。用途から素早く引くための簡易版。

| ユースケース | 推奨 | 理由 |
|------------|------|------|
| 標準的な Web アプリ | RDS PostgreSQL / Aurora Serverless v2 | フルマネージド、マルチ AZ 対応 |
| 読み取り負荷が高い | Aurora PostgreSQL（Multi-AZ + reader） | クラスターオートスケーリング |
| 開発・ステージング | Aurora Serverless v2（最小 ACU）/ RDS t4g.micro | コスト最小・アイドル時従量 |
| 本番（小規模） | RDS PostgreSQL t4g.small / db.t4g.medium | 定常低負荷では固定小額でシンプル |

### キャッシュ選定マトリクス

| ユースケース | 推奨 | 理由 |
|------------|------|------|
| セッション・一般キャッシュ | Valkey（ElastiCache） | OSS、Redis 互換 |
| 単純なキャッシュのみ | ElastiCache Serverless | 運用ゼロ、コスト従量制 |
| 読み取り重視のキャッシュ | DAX（DynamoDB 利用時） | インメモリ、自動スケール |

> **注意**: Redis OSS ライセンス変更（2024）により、新規採用は Valkey を推奨。ElastiCache は Valkey エンジンをサポート（2024 以降）。

### ローカル↔本番マッピング

| ローカル | 本番 AWS |
|---------|---------|
| PostgreSQL（Docker） | RDS PostgreSQL / Aurora PostgreSQL |
| Redis / Valkey（Docker） | ElastiCache (Valkey エンジン) |
| MySQL（Docker） | RDS MySQL / Aurora MySQL |
| MongoDB（Docker） | DocumentDB（互換性確認必須） |

---

## メッセージング

### 選定マトリクス

| ユースケース | 推奨 | 理由 |
|------------|------|------|
| 非同期タスクキュー | SQS Standard | シンプル、高スループット |
| 順序保証が必要 | SQS FIFO | 順序保証、重複排除 |
| Pub/Sub（1対多） | SNS + SQS ファンアウト | 複数コンシューマーに配信 |
| イベント駆動アーキテクチャ | EventBridge | ルールベースルーティング |
| ストリーミング | Kinesis Data Streams | リアルタイム、複数コンシューマー |
| サーバー→ブラウザへのリアルタイム配信 | **既定を置かない**（条件で決まる） | 下の「サーバー→ブラウザへのリアルタイム配信」で条件ごとに並べる |

### サーバー→ブラウザへのリアルタイム配信

**この用途には「推奨」を置かない。** 選択を決めるのは用途ではなく、**そのプロジェクトが既に持っている構成要素**（キャッシュ層が在るか・catch-up の基準に使える追記テーブルが在るか）で、そこが違えば選択は反転する。既定を配ると、その制約を持たないプロジェクトが理由の無い選択を引き継ぐ。

| 選択肢 | 成立する条件 | 代償 | 追試 |
|---|---|---|---|
| RDB の LISTEN/NOTIFY | キャッシュ層を持たない（持てない）／通知の起点が既に DB の書き込みである | 購読が接続に紐づくので、接続プールの使い方と設計が絡む | **要確認（未追試）** |
| Redis / Valkey の pub/sub | キャッシュ層が既に構成に在る（上の「キャッシュ選定マトリクス」） | 配信のために別データストアの可用性が経路へ入る | **要確認（未追試）** |
| SNS + SQS ファンアウト | 受け手がサーバー側のプロセスで、ブラウザまでは別の経路で運ぶ | ブラウザは SQS を購読できないので、**この選択肢だけでは端まで届かない** | **要確認（未追試）** |

- **見る順序**: 先に「キャッシュ層を既に持っているか」を確かめる。持っているなら pub/sub が素直で、持っていないときに初めて LISTEN/NOTIFY が候補として意味を持つ。**持っていないことを理由にキャッシュ層を新設するかは、この表では決まらない**（コスト・運用の別軸）。
- **どれを選んでも接続の寿命は別途決める**——正本は 同じ patterns ディレクトリの `long-lived-connections.md`（アイドルタイムアウトと heartbeat の関係・前段のバッファリング・再接続）。
- **ブラウザまで届かせる実装側**（Next.js の route handler で SSE を出す形）は shirokuma-nextjs プラグインの `coding-nextjs` skill の `reference/patterns/streaming-sse.md`。**pub/sub の選択に依らない関係**（購読と catch-up の順序など）はそちらが持つ。
- **追試列の値の読み方**は 同じ patterns ディレクトリの `static-asset-delivery.md` の「追試状況の書き方」節。
- **倒れる向き**: **表に行が無いことは「その選択肢が不適」の意味を持たない**（未調査と区別が付かない＝fail-silent）。上表を根拠に採否を断定せず、選んだ理由を設計成果物に書く。

### SQS + Lambda パターン（非同期処理）

```
Producer（ECS）→ SQS → Lambda（コンシューマー）
                  ↓（失敗時）
                 DLQ（デッドレターキュー）
```

---

## ストレージ

### S3 バケット設計

| 用途 | 設定方針 |
|------|---------|
| ユーザーアップロード | バケットポリシーで CloudFront 経由のみ許可 |
| 静的アセット | **配信経路は 2 通りあり、ここでは決めない**（CDN → アプリのオリジン／CDN → S3）。選定と、選んだ後に決める配信属性（Content-Type・圧縮・キャッシュ）は [static-asset-delivery.md](static-asset-delivery.md) が正本 |
| バックアップ | ライフサイクルで Glacier 移行（90日後） |
| ログ保管 | S3 Intelligent-Tiering |

### S3 セキュリティ設定

```
Block Public Access: 全て有効（デフォルト）
暗号化: SSE-S3 または SSE-KMS
バージョニング: 本番バケットは有効
アクセスログ: 専用ログバケットに記録
```

---

## ネットワーク

### 標準 VPC 構成

```
VPC: 10.0.0.0/16

パブリックサブネット（各 AZ）:
  {region}a: 10.0.0.0/24  ← ALB、NAT Gateway
  {region}c: 10.0.1.0/24

プライベートサブネット（各 AZ）:
  {region}a: 10.0.10.0/24  ← ECS タスク、Lambda
  {region}c: 10.0.11.0/24

DB サブネット（各 AZ）:
  {region}a: 10.0.20.0/24  ← RDS、ElastiCache
  {region}c: 10.0.21.0/24
```

### セキュリティグループ設計原則

| レイヤー | インバウンド | アウトバウンド |
|---------|-----------|-------------|
| ALB | 0.0.0.0/0:443（HTTPS） | ECS SG:8080 |
| ECS | ALB SG:8080 | DB SG:5432、0.0.0.0/0:443（HTTPS） |
| RDS | ECS SG:5432 | なし |
| ElastiCache | ECS SG:6379 | なし |

### NAT Gateway vs VPC Endpoint

| ユースケース | 推奨 |
|------------|------|
| 汎用アウトバウンド通信 | NAT Gateway（パブリックサブネット） |
| S3 / DynamoDB へのアクセス | VPC Endpoint（Gateway 型：無料） |
| Secrets Manager / ECR | VPC Endpoint（Interface 型：コスト考慮） |

> **Gateway 型は時間課金・データ処理料ともに無料**（S3・DynamoDB）。Interface 型（AWS PrivateLink・Secrets Manager / SQS / SNS / SES 等ほとんどのサービス）は時間課金 + データ処理料（~$0.01/h/AZ）が乗る（NAT Gateway より安いがゼロではない）。Next.js を Lambda フレーバー（`NextjsGlobalFunctions`）で VPC アタッチする場合の NAT 要否は `nextjs-deploy.md`（同一 patterns ディレクトリ）の「Lambda VPC アタッチ + NAT のトレードオフ」を参照。

---

## CDK コンストラクト設計

### コンストラクトレベル選択

| レベル | 概要 | 使いどころ |
|-------|------|-----------|
| **L1** | CloudFormation リソース直接対応（`Cfn*`） | 新サービス対応、細粒度制御が必要 |
| **L2** | AWS Defaults + セキュリティベストプラクティスを適用した高レベル API | **推奨デフォルト** |
| **L3** | 複数 L2 を組み合わせた完全なアーキテクチャパターン（`patterns.*`） | 標準的なアーキテクチャ全体を一発構築 |

### L2 コンストラクト推奨例

```typescript
// RDS: L2 DatabaseInstance
const db = new rds.DatabaseInstance(this, 'Database', {
  engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_18 }),
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),
  vpc,
  vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
  multiAz: true,
  deletionProtection: true,
});

// ECS: L2 FargateService
const service = new ecs.FargateService(this, 'Service', {
  cluster,
  taskDefinition,
  desiredCount: 2,
  vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
});
```

### スタック分割パターン

| スタック | 含むリソース | 変更頻度 |
|---------|-----------|---------|
| `NetworkStack` | VPC、サブネット、セキュリティグループ | 低 |
| `StatefulStack` | RDS、ElastiCache、S3 | 低 |
| `AppStack` | ECS、ALB、Lambda、IAM ロール | 高 |

> スタック間の参照は `stack.exportValue()` / `Fn.importValue()` を使用する。CloudFormation クロススタック参照は削除時に依存関係でブロックされることに注意。

> **アカウント境界での分離は別レイヤ**: スタック分割（本表）はアプリ内の blast radius 境界。本番・検証を **アカウント境界**で分ける段階移行（Phase 0/1/2・OU 構成・移行トリガー）は [account-isolation.md](account-isolation.md)（同一 patterns ディレクトリ）を参照。

### Props 設計原則

```typescript
// Good: 環境ごとに変化する値を Props で受け取る
interface AppStackProps extends cdk.StackProps {
  environment: 'staging' | 'production';
  desiredCount: number;
  dbInstanceType: ec2.InstanceType;
}

// Bad: ハードコードで環境差異を吸収しようとする
// if (process.env.ENV === 'production') { ... }
```

---

## セキュリティ

### IAM ロール設計原則

| 原則 | 実装 |
|------|------|
| 最小権限 | 必要なアクション・リソースのみ許可 |
| ロールベース | ユーザーへの直接権限付与を避け、ロールを付与 |
| タスクロール分離 | ECS タスクロール（アプリ用）とタスク実行ロール（ECS コントロールプレーン用）を分離 |

### シークレット管理

| シークレット種別 | 推奨サービス | 理由 |
|---------------|------------|------|
| DB 認証情報 | Secrets Manager | 自動ローテーション対応 |
| API キー | Secrets Manager | バージョン管理、監査ログ |
| 設定値（非機密） | SSM Parameter Store | コスト安（無料枠あり） |
| 環境変数（非機密） | ECS タスク定義の `environment` | シンプル |

### CDK でのシークレット注入パターン

```typescript
// ECS タスク定義でのシークレット注入
const secret = secretsmanager.Secret.fromSecretNameV2(this, 'DbSecret', 'myapp/db');

taskDefinition.addContainer('app', {
  // ...
  secrets: {
    DATABASE_URL: ecs.Secret.fromSecretsManager(secret, 'url'),
  },
});
```
