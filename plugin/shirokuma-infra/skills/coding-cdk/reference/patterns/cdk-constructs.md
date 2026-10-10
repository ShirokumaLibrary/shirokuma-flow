# CDK コンストラクトパターン

## L2/L3 コンストラクト使い分けマトリクス

| コンストラクトレベル | 条件 | 推奨度 | 理由 |
|------------------|------|--------|------|
| L3（パターン）| AWS Solutions Constructs や CDK Patterns に合致する構成 | 最優先 | 実績あり・デフォルト設定がベストプラクティス準拠 |
| L2（高レベル）| 標準的な AWS サービス設定で Props でカバーできる | 推奨 | 型安全・CloudFormation の詳細を隠蔽 |
| L2 + escape hatch | L2 の Props に存在しない設定が必要 | 条件付き推奨 | L2 を維持しつつ細かい制御が可能 |
| L1（CloudFormation）| L2/L3 が存在しない新サービス、または詳細制御が必須 | 最終手段 | CloudFormation の raw プロパティを TypeScript で記述 |

### 判断フロー

```
要件を確認
    ↓
AWS Solutions Constructs / CDK Patterns に合致？ → YES → L3 を使用
    ↓ NO
aws-cdk-lib に対応 L2 コンストラクトが存在？ → YES → L2 を使用
    ↓ NO
L2 の CfnXxx.addPropertyOverride() で設定可能？ → YES → L2 + escape hatch
    ↓ NO
L1（CfnXxx）を使用（理由をコメントに記載）
```

## Props 設計ガイド

### interface 設計パターン

```typescript
// Props interface の基本形
export interface MyConstructProps {
  // Required: コンストラクトの動作に必須
  readonly vpc: ec2.IVpc;
  readonly environment: 'dev' | 'staging' | 'prod';

  // Optional: デフォルト値があるもの
  readonly instanceType?: ec2.InstanceType;
  readonly removalPolicy?: cdk.RemovalPolicy;
  readonly enableDeletionProtection?: boolean;
}
```

### Required vs Optional の判断基準

| 判断 | Required | Optional |
|------|----------|----------|
| コンストラクトが動作するために必ず必要 | YES | — |
| 安全なデフォルト値が存在する | — | YES |
| 環境によって値が変わる（dev/prod）| YES | — |
| ほとんどのケースで同じ値になる | — | YES |

### デフォルト値の設定

```typescript
export class MyConstruct extends Construct {
  constructor(scope: Construct, id: string, props: MyConstructProps) {
    super(scope, id);

    // デフォルト値はコンストラクタ内で解決
    const instanceType = props.instanceType
      ?? ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL);

    const removalPolicy = props.removalPolicy
      ?? (props.environment === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY);
  }
}
```

## Escape Hatch パターン

L2 コンストラクトで設定できないプロパティに L1 からアクセスする手法。

```typescript
// L2 コンストラクトを作成
const bucket = new s3.Bucket(this, 'Bucket', {
  versioned: true,
  encryption: s3.BucketEncryption.S3_MANAGED,
});

// L1（CfnBucket）にアクセスして L2 未対応プロパティを設定
const cfnBucket = bucket.node.defaultChild as s3.CfnBucket;
cfnBucket.addPropertyOverride('ObjectLockEnabled', true);
cfnBucket.addPropertyOverride('ObjectLockConfiguration', {
  ObjectLockEnabled: 'Enabled',
  Rule: {
    DefaultRetention: {
      Mode: 'COMPLIANCE',
      Years: 7,
    },
  },
});
```

### Escape Hatch 使用時の注意

- `node.defaultChild` が `undefined` の場合は `!` アサーションより `as` キャストで型を明示
- CloudFormation のプロパティ名はパスカルケース（`ObjectLockEnabled` など）
- L2 が将来対応した場合に置き換えやすいようコメントを残す

## コンストラクト合成パターン

複数の AWS リソースを1つのコンストラクトにまとめ、再利用性を高める。

### 例: ECS サービスコンストラクト

> **位置づけ（汎用 Node.js アプリ向け）**: 下記 `AppService`（Fargate + ALB）は**汎用 Node.js コンテナアプリ向け**。Next.js アプリを AWS へデプロイする場合は、ISR / data cache / 画像最適化を construct が担う cdk-nextjs 既定（`cdk-nextjs-construct.md`・同一 patterns ディレクトリ）を優先する。`AppService` は**汎用コンテナ経路**（cdk-nextjs をデプロイ先にしない構成。非 Next.js アプリと、cdk-nextjs を使わないと決めた Next.js アプリの両方を含む。語の正本は designing-aws の `reference/patterns/nextjs-deploy.md`「2 つのコンテナ経路」節）で引き続き使う（使い分けは `cdk-nextjs-construct.md`「手書き `AppService` と cdk-nextjs の使い分け」節を参照）。

```typescript
export interface AppServiceProps {
  readonly vpc: ec2.IVpc;
  readonly cluster: ecs.ICluster;
  readonly image: ecs.ContainerImage;
  readonly environment: Record<string, string>;
  readonly secrets: Record<string, ecs.Secret>;
  readonly desiredCount?: number;
}

export class AppService extends Construct {
  public readonly service: ecs.FargateService;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props: AppServiceProps) {
    super(scope, id);

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
    });

    taskDefinition.addContainer('App', {
      image: props.image,
      environment: props.environment,
      secrets: props.secrets,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: id }),
    });

    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc: props.vpc,
      internetFacing: true,
    });

    this.service = new ecs.FargateService(this, 'Service', {
      cluster: props.cluster,
      taskDefinition,
      desiredCount: props.desiredCount ?? 2,
    });

    // ALB → ECS のルーティング設定
    const listener = this.loadBalancer.addListener('Listener', { port: 80 });
    listener.addTargets('Target', {
      port: 80,
      targets: [this.service],
      healthCheck: { path: '/health' },
    });
  }
}
```

### 合成パターンのガイドライン

- コンストラクトは**単一責任**を持つ（ECS サービス、RDS クラスタ等）
- 外部コンストラクトから参照する必要があるリソースを `public readonly` で公開
- スタック間依存は Props で渡す（`IVpc`, `ICluster` 等のインターフェース型を使用）
- コンストラクトの `id` はスタック内でユニーク

## 命名規則

```typescript
// スタック: PascalCase
class NetworkStack extends cdk.Stack {}

// コンストラクト: PascalCase
class AppService extends Construct {}

// リソース ID: PascalCase（CloudFormation 論理 ID）
new s3.Bucket(this, 'DataBucket', { ... });

// CDK 出力: kebab-case が推奨（export name）
new cdk.CfnOutput(this, 'VpcId', {
  exportName: `${id}-vpc-id`,
  value: this.vpc.vpcId,
});
```
