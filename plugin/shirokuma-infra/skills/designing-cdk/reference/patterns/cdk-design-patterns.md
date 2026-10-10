# CDK 設計パターン

CDK コンストラクト設計の決定フレームワーク詳細。スタック分割・L2/L3 選択・Props 設計・Aspects ガバナンスのパターン集。SKILL.md 本文の判断骨格を補う設計リファレンス。

## スタック分割設計

### 分割原則

| 分割軸 | 説明 | 例 |
|-------|------|-----|
| ステートフル/ステートレス | DB 等の永続データとアプリを分離 | Stateful: RDS / S3、Stateless: ECS |
| 変更頻度 | 変更頻度の低いリソースを安定スタックに分離 | Network スタックは稀に変更、App スタックは頻繁に変更 |
| チーム責務 | チームの責務境界に合わせた分割 | インフラチーム vs アプリチーム |
| デプロイリスク | 変更時の影響範囲を最小化 | ネットワーク変更がアプリデプロイに影響しない |

### 推奨構成（3 スタック分割）

```
Network Stack        - VPC、サブネット、セキュリティグループ、VPC Endpoints
Stateful Stack       - RDS、ElastiCache、S3（永続データ）
Stateless Stack      - ECS、Lambda、ALB（アプリ層）
```

依存関係: Network → Stateful → Stateless

### cdk-nextjs L3 を採る場合のスタック分割（縮退）

Next.js アプリを cdk-nextjs（上書き可能な既定・designing-aws の `nextjs-deploy.md` を参照）でデプロイする場合、上の 3 スタック分割は縮退する。cdk-nextjs の construct（`NextjsGlobalFunctions` 等）が**内部でネットワーク（CloudFront / Lambda / ALB 等）とキャッシュ層（S3 + DynamoDB）を自前で構成する**ため、Network Stack / Stateless Stack に相当する部分を construct が丸ごと引き受ける。

- **Network Stack**: 縮退。cdk-nextjs が CloudFront / Lambda（既定フレーバーは VPC 不要）を内部構成する。RDS 等を同一 VPC 内 private subnet に置く要件があるときのみ、VPC を別途持つ（Lambda VPC アタッチの要否は `nextjs-deploy.md` の NAT トレードオフ節を参照）。
- **Stateless Stack**: 縮退。アプリ層（サーバー実行・静的配信・ISR キャッシュ）は cdk-nextjs construct が内包する。手書きの ECS / ALB / Lambda を重ねない。
- **Stateful Stack のみ残る（隣接 stateful に縮退）**: cdk-nextjs が作らない**隣接する stateful リソース**（アプリが使う RDS / ElastiCache 等の cache/DB）だけを別スタックとして持つ。cdk-nextjs のキャッシュ層 S3/DynamoDB は construct が自動作成するので、ここに含めない。
- **構成イメージ**: `NextjsStack`（cdk-nextjs construct＝ネットワーク + アプリ + キャッシュ層を内包）＋ `StatefulStack`（アプリ固有の RDS / ElastiCache 等）。既存 3 分割の Network / Stateless は construct に吸収される。

> **位置づけ（上書き可能な既定）**: cdk-nextjs は固定強制ではない既定なので、本節のスタック縮退方針も、cdk-nextjs を採る場合の既定として扱う（cdk-nextjs を採らない構成には当たらない）。

## L2/L3 コンストラクト選択設計

### 選択フレームワーク

| レベル | 使用場面 | 例 |
|-------|---------|-----|
| L3（Patterns Library） | 標準的なユースケースで完全なパターンが必要 | `ApplicationLoadBalancedFargateService` |
| L2（Intent-based） | ベストプラクティスのデフォルト設定が必要 | `aws_rds.DatabaseInstance` |
| L1（CloudFormation） | L2 で制御できないプロパティが必要 | Escape Hatch 経由 |

### 設計決定記録

各コンストラクトについて設計根拠を記録する。

```markdown
### コンストラクト設計決定

| コンストラクト | レベル | 選択理由 | 備考 |
|-------------|-------|---------|------|
| {construct} | L2/L3 | {根拠} | {注意点} |
```

## Props インターフェース設計

### 設計原則

- **環境別差異は Props で注入** — ハードコードを避ける
- **Required vs Optional を明示** — 必須設定と任意設定を型で区別
- **型安全性を最大化** — `string` より `aws_ec2.InstanceType` 等の専用型を使用

```typescript
// Props 設計テンプレート
interface {StackName}Props extends cdk.StackProps {
  // 環境識別子
  environment: 'dev' | 'staging' | 'prod';

  // 必須: スケール設定
  readonly desiredCount: number;
  readonly instanceType: ec2.InstanceType;

  // オプション: コスト最適化
  readonly enableDeletionProtection?: boolean;  // default: true in prod
  readonly multiAz?: boolean;                   // default: false in dev
}
```

## Aspects ガバナンス設計

ガバナンス要件がある場合、Aspects による一括適用を設計する。

| Aspects の用途 | 実装例 |
|-------------|--------|
| タグ付け強制 | `Environment`・`Project`・`CostCenter` タグ |
| 暗号化強制 | EBS・RDS・S3 の暗号化チェック |
| コスト管理 | 本番環境以外でのリソースサイズ制限 |

Aspects の実装は複雑なため、設計段階で適用スコープを明確にする。

## 設計出力テンプレート

```markdown
## CDK コンストラクト設計

### スタック構成
| スタック | 含むリソース | 変更頻度 | 依存スタック |
|---------|------------|---------|-------------|
| {stack-name} | {リソース一覧} | 低/中/高 | {依存先} |

### コンストラクト設計決定
| コンストラクト | レベル | 選択理由 |
|-------------|-------|---------|
| {construct} | L2/L3 | {根拠} |

### Props インターフェース設計
{主要 Props の構造}

### Aspects ガバナンス
{ガバナンス要件と実装方針}

### cross-stack 参照方針
{スタック間の値受け渡し方法}
```

## レビューチェックリスト

- [ ] スタック分割がステートフル/ステートレスの境界を守っている
- [ ] L3 コンストラクトの採用で冗長な実装が排除されている
- [ ] Props が環境差異を適切に抽象化している
- [ ] `interface Props` が `cdk.StackProps` を継承している
- [ ] cross-stack 参照が適切（循環依存がない）
- [ ] Aspects でタグ付け・暗号化ガバナンスが担保されている
- [ ] `any` 型が使用されていない
