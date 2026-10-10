# 環境別設定管理パターン

## 3方式の比較

| 方式 | 用途 | メリット | デメリット |
|------|------|---------|-----------|
| `cdk.json` contexts | 非シークレット設定（リージョン、インスタンスタイプ等）| シンプル・バージョン管理対象 | シークレット不可・コンテキストキーが増えると複雑 |
| Props 注入 | スタック間設定の受け渡し | 型安全・テスト容易 | `bin/app.ts` に設定が集中する |
| SSM Parameter Store | シークレット・環境別シークレット | 安全・ローテーション対応 | デプロイ時に SSM へのアクセスが必要 |

## 推奨パターン: Props 注入 + SSM（シークレットのみ）

```typescript
// bin/app.ts - 環境別設定を集中管理
const app = new cdk.App();

// 非シークレット設定は cdk.json context または直接定義
const env = app.node.tryGetContext('env') ?? 'dev';
const config = getConfig(env);

new AppStack(app, `AppStack-${env}`, {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  environment: env,
  instanceType: config.instanceType,
  desiredCount: config.desiredCount,
});

function getConfig(environment: string) {
  const configs: Record<string, { instanceType: string; desiredCount: number }> = {
    dev: { instanceType: 't3.small', desiredCount: 1 },
    staging: { instanceType: 't3.medium', desiredCount: 2 },
    prod: { instanceType: 't3.large', desiredCount: 4 },
  };
  return configs[environment] ?? configs['dev'];
}
```

## `cdk.json` contexts の使用例

非シークレット・環境に依存しない設定はここで管理。

```json
{
  "app": "npx ts-node --prefer-ts-exts bin/app.ts",
  "context": {
    "env": "dev",
    "@aws-cdk/aws-apigateway:usagePlanKeyOrderInsensitiveId": true,
    "@aws-cdk/aws-lambda:recognizeLayerVersion": true,
    "vpcCidr": "10.0.0.0/16",
    "availabilityZones": ["{region}a", "{region}c"]
  }
}
```

コンストラクトからの参照:

```typescript
const vpcCidr = this.node.tryGetContext('vpcCidr') as string ?? '10.0.0.0/16';
```

## 環境別スタック分離パターン

同一 CDK アプリ内で環境別スタックを分離し、デプロイ単位を制御する。

```typescript
// bin/app.ts
const envs = ['dev', 'staging', 'prod'] as const;

for (const env of envs) {
  const config = getConfig(env);

  new NetworkStack(app, `Network-${env}`, {
    env: awsEnv,
    environment: env,
    vpcCidr: config.vpcCidr,
  });

  new DatabaseStack(app, `Database-${env}`, {
    env: awsEnv,
    environment: env,
    // cross-stack reference: NetworkStack の出力を受け取る
    vpc: NetworkStack.vpcFromExportedValues(app, env),
  });
}
```

## SSM Parameter Store による設定注入

### シークレットでない設定（StringParameter）

```typescript
// シークレットでない設定の書き込み（別途 CDK で管理）
new ssm.StringParameter(this, 'ApiEndpoint', {
  parameterName: `/myapp/${props.environment}/api-endpoint`,
  stringValue: `https://api.${props.environment}.example.com`,
});

// 読み取り（デプロイ時に解決）
const apiEndpoint = ssm.StringParameter.valueForStringParameter(
  this,
  `/myapp/${props.environment}/api-endpoint`,
);
```

### シークレット（SecureString）

```typescript
// Secrets Manager 経由（推奨）
const dbSecret = secretsmanager.Secret.fromSecretNameV2(
  this,
  'DbSecret',
  `/myapp/${props.environment}/db-password`,
);

// ECS タスク定義でシークレットを参照
taskDefinition.addContainer('App', {
  secrets: {
    DB_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret),
    API_KEY: ecs.Secret.fromSsmParameter(
      ssm.StringParameter.fromSecureStringParameterAttributes(this, 'ApiKey', {
        parameterName: `/myapp/${props.environment}/api-key`,
        version: 1,
      }),
    ),
  },
});
```

## 環境別 RemovalPolicy

```typescript
// 環境によって削除ポリシーを切り替える
const removalPolicy = props.environment === 'prod'
  ? cdk.RemovalPolicy.RETAIN      // 本番: 誤削除防止
  : cdk.RemovalPolicy.DESTROY;    // 非本番: クリーンアップ容易

new s3.Bucket(this, 'DataBucket', {
  removalPolicy,
  autoDeleteObjects: props.environment !== 'prod', // 本番では false
});
```

## デプロイコマンド（環境指定）

```bash
# 環境を context で指定
npx cdk deploy --context env=dev
npx cdk deploy --context env=prod

# 特定スタックのみデプロイ
npx cdk deploy "Network-prod" "Database-prod" --context env=prod

# 差分確認
npx cdk diff --context env=prod
```
