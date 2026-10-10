# CDK Aspects ガバナンスパターン

## CDK Aspects の仕組み

Aspects は CDK のコンストラクトツリーを走査し、すべてのノードにポリシーを適用するメカニズム。

```
App
└── Stack
    ├── VpcConstruct
    ├── DatabaseConstruct
    │   ├── CfnDBInstance  ← Aspect がここまで訪問する
    │   └── CfnSubnetGroup
    └── AppService
        └── CfnTaskDefinition
```

Aspect を Stack レベルに適用すると、スタック内の全 L1/L2/L3 コンストラクトが走査対象になる。

### 適用方法

```typescript
// スタック全体に適用
const stack = new AppStack(app, 'AppStack', { ... });
cdk.Aspects.of(stack).add(new RequiredTagsAspect({
  project: 'my-app',
  environment: props.environment,
}));

// 特定のコンストラクトにのみ適用
cdk.Aspects.of(myDatabase).add(new EncryptionEnforcementAspect());
```

## タグ付け強制 Aspect

全リソースに必須タグを付与し、コスト配分・リソース追跡を実現する。

```typescript
import { IAspect, IConstruct, TagManager, Tags } from 'aws-cdk-lib';

export interface RequiredTagsProps {
  readonly project: string;
  readonly environment: string;
  readonly owner?: string;
  readonly costCenter?: string;
}

export class RequiredTagsAspect implements IAspect {
  constructor(private readonly props: RequiredTagsProps) {}

  visit(node: IConstruct): void {
    // タグをサポートするリソースにのみ適用
    if (TagManager.isTaggable(node)) {
      Tags.of(node).add('Project', this.props.project);
      Tags.of(node).add('Environment', this.props.environment);

      if (this.props.owner) {
        Tags.of(node).add('Owner', this.props.owner);
      }
      if (this.props.costCenter) {
        Tags.of(node).add('CostCenter', this.props.costCenter);
      }

      // 管理タグ（自動設定）
      Tags.of(node).add('ManagedBy', 'CDK');
    }
  }
}
```

### 使用例

```typescript
// bin/app.ts
const stack = new AppStack(app, 'AppStack', { environment: 'prod' });

cdk.Aspects.of(stack).add(new RequiredTagsAspect({
  project: 'my-service',
  environment: 'prod',
  owner: 'platform-team',
  costCenter: 'CC-1234',
}));
```

## 暗号化強制 Aspect

S3 / RDS / EBS 等のストレージで暗号化が有効かチェックし、違反時に警告・エラーを出力する。

```typescript
import { IAspect, IConstruct, Annotations } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as rds from 'aws-cdk-lib/aws-rds';

export class EncryptionEnforcementAspect implements IAspect {
  constructor(private readonly errorOnViolation = false) {}

  visit(node: IConstruct): void {
    // S3 バケットの暗号化チェック
    if (node instanceof s3.CfnBucket) {
      if (!node.bucketEncryption) {
        this.report(node, 'S3 バケットに暗号化が設定されていません');
      }
    }

    // RDS インスタンスの暗号化チェック
    if (node instanceof rds.CfnDBInstance) {
      if (node.storageEncrypted !== true) {
        this.report(node, 'RDS インスタンスのストレージ暗号化が無効です');
      }
    }
  }

  private report(node: IConstruct, message: string): void {
    if (this.errorOnViolation) {
      Annotations.of(node).addError(message);
    } else {
      Annotations.of(node).addWarning(message);
    }
  }
}
```

### 使用例

```typescript
// 本番環境では違反をエラーに（cdk synth/deploy を失敗させる）
cdk.Aspects.of(stack).add(
  new EncryptionEnforcementAspect(props.environment === 'prod'),
);
```

## コスト管理 Aspect

特定のインスタンスタイプや高コストリソースの使用を制限する。

```typescript
import { IAspect, IConstruct, Annotations } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface CostControlProps {
  /** 許可しないインスタンスファミリー（例: ['p3', 'p4d']）*/
  readonly blockedInstanceFamilies?: string[];
  /** 許可する最大インスタンスサイズ（例: 'xlarge'）*/
  readonly maxInstanceSize?: string;
}

export class CostControlAspect implements IAspect {
  private static readonly SIZE_ORDER = [
    'nano', 'micro', 'small', 'medium', 'large',
    'xlarge', '2xlarge', '4xlarge', '8xlarge', '12xlarge', '16xlarge',
  ];

  constructor(private readonly props: CostControlProps) {}

  visit(node: IConstruct): void {
    if (node instanceof ec2.CfnInstance) {
      const instanceType = node.instanceType as string | undefined;
      if (!instanceType) return;

      const [family, size] = instanceType.split('.');

      // ブロック対象ファミリーチェック
      if (this.props.blockedInstanceFamilies?.includes(family)) {
        Annotations.of(node).addError(
          `インスタンスファミリー ${family} は許可されていません`,
        );
      }

      // 最大サイズチェック
      if (this.props.maxInstanceSize && size) {
        const maxIndex = CostControlAspect.SIZE_ORDER.indexOf(this.props.maxInstanceSize);
        const currentIndex = CostControlAspect.SIZE_ORDER.indexOf(size);
        if (currentIndex > maxIndex) {
          Annotations.of(node).addWarning(
            `インスタンスサイズ ${size} が上限 ${this.props.maxInstanceSize} を超えています`,
          );
        }
      }
    }
  }
}
```

## カスタム Aspect の作成パターン

独自のガバナンスポリシーを実装する際のテンプレート。

```typescript
import { IAspect, IConstruct } from 'aws-cdk-lib';

export class CustomPolicyAspect implements IAspect {
  visit(node: IConstruct): void {
    // 1. 対象リソースタイプのみにフィルタリング
    if (!(node instanceof TargetCfnResource)) return;

    // 2. ポリシーチェック
    if (this.violatesPolicy(node)) {
      // 3. 違反の報告
      //    addError: cdk synth/deploy を失敗させる（本番ガード）
      //    addWarning: 警告のみ（開発時の通知）
      //    addInfo: 情報のみ
      Annotations.of(node).addError('ポリシー違反: {理由}');
    }

    // 4. 自動修正（可能な場合）
    this.applyFix(node);
  }

  private violatesPolicy(node: TargetCfnResource): boolean {
    // ポリシー評価ロジック
    return false;
  }

  private applyFix(node: TargetCfnResource): void {
    // 自動修正ロジック（オプション）
  }
}
```

## Aspects の適用順序

```typescript
// 複数の Aspect を適用する場合、登録順に走査される
cdk.Aspects.of(stack).add(new RequiredTagsAspect({ ... }));          // 1番目
cdk.Aspects.of(stack).add(new EncryptionEnforcementAspect(true));    // 2番目
cdk.Aspects.of(stack).add(new CostControlAspect({ ... }));           // 3番目
```

## 動作確認

```bash
# synth 時に Aspect が適用され、エラー/警告が出力される
npx cdk synth

# エラー例（addError の場合）
# [Error at /AppStack/DataBucket] S3 バケットに暗号化が設定されていません

# 警告例（addWarning の場合）
# [Warning at /AppStack/AppServer] インスタンスサイズ 4xlarge が上限 xlarge を超えています
```
