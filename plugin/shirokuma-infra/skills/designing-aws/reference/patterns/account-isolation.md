# アカウント分離戦略パターン

本番・検証環境を **どのアカウント境界で分離するか** の段階移行パターン。マルチアカウント分離を既定の方向としつつ、小規模プロジェクトは単一アカウントから始めて必要になった段階で分離する。単一固定でも「常にフル分離」でもなく、規模・要件で選べる段階を明文で引ける状態にする。

> **前提となる原則**: **workload を management アカウントに置かない**（AWS Organizations ベストプラクティス）。management アカウントは billing・SCP（Service Control Policy）・Organizations 管理のみを持ち、アプリケーションのリソース（ECS / Lambda / RDS 等）はデプロイしない。management が侵害された場合の blast radius を最小化するため。

## 段階移行マトリクス

規模と隔離要件で 3 フェーズを選ぶ。Phase 0 から始め、移行トリガーに該当したら次フェーズへ進む（strangler-fig）。先回りでフル分離を常設しない。

| フェーズ | アカウント構成 | 環境の分け方 | 移行トリガー |
|---------|--------------|------------|------------|
| **Phase 0（小規模開始）** | 単一 workload アカウント（+ 可能なら management を分離） | dev/staging/prod は CDK context ＋ スタック名 prefix で論理分離 | —（出発点） |
| **Phase 1（本番隔離）** | management + prod + （dev/staging 合同） | prod を別アカウントへ切り出す | 本番稼働開始（実ユーザーデータ発生）・本番 blast radius を dev から隔離したい・コンプライアンス要件 |
| **Phase 2（フル分離）** | management + Workloads OU（dev/staging/prod）+ Security OU（log-archive/audit）で **4〜6 アカウント** | アカウント境界で環境分離 | 複数チーム・staging も隔離要件・コスト配賦をアカウント境界で厳密化 |

> **迷ったら Phase 0**。単一アカウント内でも CDK context（`--context env=prod`）とスタック名 prefix（`MyApp-prod-*` / `MyApp-dev-*`）で環境を論理分離でき、小規模なら十分。移行トリガーに該当してから次フェーズへ。

## フェーズ別の詳細

### Phase 0: 単一 workload アカウント

- 1 つの workload アカウントに dev/staging/prod を同居させる。可能なら management アカウントだけは分離しておく（後の Phase 1/2 への移行が楽になる）。
- 環境分離は **CDK context ＋ スタック名 prefix** で論理的に行う。IAM・タグ・命名規約で環境を区別する。
- 適する規模: PoC・個人/少人数開発・本番稼働前。

### Phase 1: 本番隔離

- **prod を独立アカウント**へ切り出し、management + prod + （dev/staging 合同）の構成にする。
- 本番の blast radius（誤操作・侵害・コスト暴走）を dev/staging から物理的に隔離する。実ユーザーデータが発生した時点が典型的なトリガー。
- dev と staging は当面 1 アカウントに残してよい（隔離コストと便益のバランス）。

### Phase 2: フル分離（AWS Organizations OU 構成）

OU（Organizational Unit）でアカウントを整理する。標準的な OU 構成:

| OU | アカウント | 役割 |
|----|-----------|------|
| （root 直下） | management | billing・SCP・Organizations 管理のみ（workload を置かない） |
| **Workloads OU** | dev | 開発環境 |
| **Workloads OU** | staging | 検証環境 |
| **Workloads OU** | prod | 本番環境 |
| **Security OU** | log-archive | 全アカウントの CloudTrail / Config ログ集約（不変ストア） |
| **Security OU** | audit | セキュリティ監査・GuardDuty / Security Hub の委任管理 |

- 合計 **4〜6 アカウント**（Security OU の 2 アカウントは要件次第で段階的に追加）。
- SCP を OU 単位で適用し、環境ごとにガードレール（リージョン制限・危険 API 禁止等）を差し込む。
- 適する規模: 複数チーム・staging も隔離が要る・コスト配賦をアカウント境界で厳密に行いたい。

## CDK 対応

段階が進むほど CDK 側で **アカウント / リージョンを env 別に明示**する必要がある。

| 項目 | 対応 |
|------|------|
| **env 別の account/region** | `bin/app.ts` で env（dev/staging/prod）ごとに `env: { account, region }` を明示する。単一の `CDK_DEFAULT_ACCOUNT` に依存する初期テンプレを env 別に拡張する |
| **cross-account deploy** | GitHub Actions からのデプロイは OIDC ロールを **アカウント別**に用意する。`github-actions-cdk.yml.template` の `CDK_DEPLOY_ROLE_ARN`（dev/staging 用）と `CDK_DEPLOY_ROLE_ARN_PROD`（本番用）の分岐がその萌芽 |
| **bootstrap** | 各アカウント × 各リージョンで `cdk bootstrap` を実行する（アカウントを増やすたびに必要） |
| **共用アカウントの bootstrap** | 他のアプリと同じアカウントを使うときは、`cdk bootstrap --qualifier {qualifier} --toolkit-stack-name {toolkit-stack}` で専用の bootstrap を作り、アプリ側も同じ qualifier で合成する（`cdk.json` の context `@aws-cdk/core:bootstrapQualifier`、または `DefaultStackSynthesizer` の `qualifier`）。**何を防ぐか**: 既定の bootstrap を共有すると、他のアプリの bootstrap の作り直し・版の更新・権限の変更が自分の deploy に効き、デプロイ用のロールとアセットのバケットも共有になる。追試状況: `要確認（未追試）`。本物のアカウントでの bootstrap は試していない。aws-cdk 2.1146.0 の CLI が `--qualifier`・`--toolkit-stack-name` を持ち、aws-cdk-lib 2.274.0 の合成器が context `@aws-cdk/core:bootstrapQualifier` を読むことはパッケージの中身で照合した |

```typescript
// bin/app.ts — env ごとに account/region を明示する例（実装は coding-cdk が担当）
const envConfig = {
  dev:     { account: '111111111111', region: '{region}' },
  staging: { account: '222222222222', region: '{region}' },
  prod:    { account: '333333333333', region: '{region}' },
};

const env = app.node.tryGetContext('env') ?? 'dev';
new AppStack(app, `MyApp-${env}`, { env: envConfig[env] });
```

> Phase 0 では `envConfig` の account が全 env で同一（単一アカウント）でも、この構造にしておけば Phase 1/2 への移行時に account を差し替えるだけで済む。実コード修正（`bin/app.ts`・`github-actions-cdk.yml.template`）は本 reference のスコープ外で、実装時（`coding-cdk`・`coding-cicd`）が担う。

## Web/RDS 分離との関係

アカウント分離（環境の物理境界）と Web/RDS のスタック分離（アプリ内の blast radius 境界）は **表裏一体**である。

- 本番 DB の**スタック境界・削除保護**（`deletionProtection` ＋ `RemovalPolicy.RETAIN`）は、環境分離設計と連動する。prod を別アカウントへ隔離（Phase 1）すると、本番 DB は誤った `cdk destroy` の影響からアカウント境界でも守られる。
- Web/RDS を別スタックに分離する設計は [aws-resource-patterns.md](aws-resource-patterns.md) の「スタック分割パターン」を参照。アカウント境界（本ファイル）とスタック境界（同ファイル）は異なるレイヤの blast radius 制御であり、両方を段階に応じて併用する。

## 関連パターン

| パターン | ドキュメント | 参照するタイミング |
|---------|------------|----------------|
| AWS リソース選定・スタック分割 | [aws-resource-patterns.md](aws-resource-patterns.md) | スタック境界・ネットワーク設計時 |
| Next.js デプロイ（cdk-nextjs 既定） | [nextjs-deploy.md](nextjs-deploy.md) | Next.js アプリの本番デプロイ構成時 |
| 環境変数マッピング | [env-mapping.md](env-mapping.md) | 環境別の接続情報・シークレット設計時 |
