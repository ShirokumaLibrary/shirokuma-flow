# cdk-nextjs コンストラクト実装パターン

Next.js アプリを AWS へデプロイする CDK コンストラクトの実装例。cdklabs/cdk-nextjs（v0.5.x を前提に書いている）を Next.js アプリの上書き可能な既定デプロイスタックとして使う場合の、`NextjsGlobalFunctions`（CloudFront + Lambda + S3 + DynamoDB）最小実装と `overrides` によるカスタマイズを扱う。

> **位置づけ（上書き可能な既定）**: cdk-nextjs は Next.js アプリの **「上書き可能な既定」**（固定強制ではない）。要件に応じて差し替え・別スタック採用の余地を残す（designing-aws の `nextjs-deploy.md` と同じ位置づけ）。

> **手書き `AppService`（Fargate + ALB）との関係**: 同一 patterns ディレクトリの `cdk-constructs.md` にある手書き `AppService`（`ecs.FargateService` + `elbv2.ApplicationLoadBalancer` + `/health`）は**汎用 Node.js アプリ向け**。**汎用コンテナ経路**（cdk-nextjs をデプロイ先にしない構成。非 Next.js のコンテナアプリと、cdk-nextjs を使わないと決めた Next.js アプリの両方を含む）では引き続き `AppService` を使う。本ファイルは Next.js 特化の既定を層として重ねるもので、`AppService` を置き換えない（どちらを使うかは本ファイル「手書き `AppService` と cdk-nextjs の使い分け」節で判定する）。

## 前提（互換契約・ハード要件）

cdk-nextjs をデプロイ先にする場合、Next.js アプリ側とビルド環境に以下の契約が要る。実装前にプロジェクトがこれを満たすか確認する。

| 契約 | 内容 | 満たさない場合 |
|------|------|--------------|
| next.config の `adapterPath` | `adapterPath: import.meta.resolve("cdk-nextjs/adapter")` を設定 | cdk-nextjs が公開 adapter API に接続できずビルドが成立しない |
| `output: "standalone"` を使わない | cdk-nextjs は Next.js を black box 扱いし standalone 出力とは同時両立しない | 出力形態が衝突する。standalone 前提の Dockerfile は**汎用コンテナ経路**（cdk-nextjs をデプロイ先にしない構成。非 Next.js アプリと、cdk-nextjs を使わないと決めた Next.js アプリの両方を含む）用に残す |
| Next.js **v16.2 以上** | Image Optimization Caching の公開 API に依存 | 画像最適化キャッシュ API が無くビルドが失敗する |
| Node **v24** | cdk-nextjs のランタイム前提 | 想定外のランタイムで不整合が出る |
| Docker 必須 | cdk-nextjs が自前で Dockerfile を生成する | synth / build が Docker を要求して失敗する |
| 版のピン留め（推奨） | experimental（v0.x・後方非互換更新があり得る）ため版を固定してピン留めする（例: `cdk-nextjs@0.5.3`。入れる版は `npm view cdk-nextjs version` で確かめる） | 更新時に breaking を無自覚に踏む |

### next.config の互換設定例

```typescript
// next.config.ts — cdk-nextjs をデプロイ先にする場合の互換設定
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cdk-nextjs の公開 adapter を接続する（ハード要件）。
  adapterPath: import.meta.resolve("cdk-nextjs/adapter"),

  // NOTE: `output: "standalone"` は設定しない。
  //   cdk-nextjs は Next.js を black box 扱いし公開 adapter API を使うため、
  //   standalone 出力とは同時両立しない。standalone 前提の Dockerfile は
  //   汎用コンテナ経路（cdk-nextjs をデプロイ先にしない構成）にのみ残す（cdk-nextjs 経路では未使用）。

  images: {
    // Image Optimization Caching は Next.js v16.2+ の公開 API に依存する。
  },
};

export default nextConfig;
```

## 最小実装: `NextjsGlobalFunctions`

`NextjsGlobalFunctions` は CloudFront + Lambda（コンテナイメージ + Lambda Web Adapter）+ S3 静的資産 + S3/DynamoDB キャッシュ層を 1 コンストラクトで構成する。VPC/NAT 不要で最小コストの既定フレーバー。キャッシュ層（S3 本体 + DynamoDB tag revalidation メタデータ）は construct が自動作成し、接続情報を `CDK_NEXTJS_*` 環境変数でアプリへ自動注入するため、アプリ・ローカル環境側でキャッシュ層をモデル化する必要はない。

```typescript
// lib/web-stack.ts — Next.js アプリの最小デプロイスタック
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { NextjsGlobalFunctions } from "cdk-nextjs";

export interface WebStackProps extends cdk.StackProps {
  readonly environment: "dev" | "staging" | "prod";
  // Next.js プロジェクトのルート（next.config を含む）への相対パス。
  readonly nextjsPath: string;
}

export class WebStack extends cdk.Stack {
  public readonly site: NextjsGlobalFunctions;

  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);

    // 最小構成: これだけで CloudFront + Lambda + S3 + S3/DynamoDB キャッシュ層が構成される。
    // キャッシュ層は construct が自動作成し CDK_NEXTJS_* を Lambda へ自動注入する。
    this.site = new NextjsGlobalFunctions(this, "Site", {
      // Next.js プロジェクトの場所。cdk-nextjs が Dockerfile を生成しビルドする。
      relativePathToWorkspace: props.nextjsPath,

      // ヘルスチェックの経路（アプリ側に用意した API route を指す）。
      healthCheckPath: "/api/health",
    });

    new cdk.CfnOutput(this, "SiteUrl", {
      exportName: `${id}-site-url`,
      value: this.site.distribution.distributionDomainName,
    });
  }
}
```

- **`relativePathToWorkspace`**: Next.js プロジェクトのルートを指す。cdk-nextjs が自前で Dockerfile を生成してビルドするため、アプリ側に Dockerfile を用意する必要はない（前提「Docker 必須」はビルド環境に Docker が要るという意味）。
- **キャッシュ層は自動**: ISR / data cache / full route cache 用の S3 と、tag revalidation メタデータ用の DynamoDB は construct が自動作成する。DynamoDB はキャッシュ本体ではなくタグ単位の失効管理のみを持つ軽量テーブル。
- **VPC/NAT 不要**: Lambda はデフォルトで VPC 外に置かれ、NAT Gateway が発生しない。同一 VPC の RDS 等へ到達する場合の VPC アタッチ判断は designing-aws 側の `nextjs-deploy.md`（Lambda VPC アタッチ + NAT のトレードオフ節）を参照。

## `overrides` によるカスタマイズ

全 construct は `overrides` prop で内部リソースを深くカスタマイズできる。「上書き可能な既定」を出発点にしつつ、既存リソースの持ち込みや細部の差し替えを行う。

### 既存リソースの持ち込み（cacheBucket / revalidationTable）

キャッシュ層を construct 自動作成に任せず、既に持っている S3 バケット・DynamoDB テーブルを持ち込む例。マルチスタック構成でキャッシュ層を stateful スタック側に置きたい場合などに使う。

```typescript
// 既存の S3 バケット・DynamoDB テーブルを持ち込む
import * as s3 from "aws-cdk-lib/aws-s3";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { NextjsGlobalFunctions } from "cdk-nextjs";

export interface WebStackProps extends cdk.StackProps {
  readonly nextjsPath: string;
  // stateful スタックから Props で受け取る既存リソース。
  readonly cacheBucket: s3.IBucket;
  readonly revalidationTable: dynamodb.ITable;
}

// ...スタック内...
this.site = new NextjsGlobalFunctions(this, "Site", {
  relativePathToWorkspace: props.nextjsPath,
  healthCheckPath: "/api/health",
  overrides: {
    // data cache / full route cache 本体を保持する S3 を持ち込む。
    cacheBucket: props.cacheBucket,
    // tag revalidation メタデータを保持する DynamoDB を持ち込む。
    revalidationTable: props.revalidationTable,
  },
});
```

- **持ち込みの利点**: ライフサイクル（`RemovalPolicy` 等）を stateful スタック側で一元管理でき、アプリスタックの入れ替え時にキャッシュ資産を保持できる。スタック分割の考え方は designing-cdk の `cdk-design-patterns.md`（cdk-nextjs 時のスタック分割）を参照。
- **`IBucket` / `ITable` で受け取る**: スタック間依存は具象型でなくインターフェース型（`IBucket` / `ITable`）を Props で渡す（同一 patterns ディレクトリ `cdk-constructs.md`「合成パターンのガイドライン」と同方針）。

### コンテナフレーバーへ上書きするときの ALB / ECS 持ち込み

予測可能な高トラフィックで `NextjsGlobalContainers`（CloudFront + ALB + ECS Fargate）へ移行する場合も、`overrides` で既存の ALB・ECS クラスタを持ち込める。フレーバーの選定基準そのものは designing-aws の `nextjs-deploy.md`（4 アーキテクチャ construct の選定マトリクス）を参照。

```typescript
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import { NextjsGlobalContainers } from "cdk-nextjs";

new NextjsGlobalContainers(this, "Site", {
  relativePathToWorkspace: props.nextjsPath,
  healthCheckPath: "/api/health",
  overrides: {
    // 既存の共有 ALB / ECS クラスタを持ち込む（新規作成させない）。
    alb: props.sharedAlb,          // elbv2.IApplicationLoadBalancer
    ecsCluster: props.sharedCluster, // ecs.ICluster
  },
});
```

### CloudFront / Lambda の細部差し替え

キャッシュポリシー・Lambda のメモリ/タイムアウトなど個別リソースの props を差し替える場合も `overrides` から入る。差し替えた個別リソースにも組織ポリシー（必須タグ・暗号化強制・コスト制限）を効かせる場合は `cdk-aspects.md`（同一 patterns ディレクトリ）の Aspects（タグ付け強制・暗号化強制・コスト管理）を Stack レベルで適用する方針に合わせる。

```typescript
new NextjsGlobalFunctions(this, "Site", {
  relativePathToWorkspace: props.nextjsPath,
  overrides: {
    // 個別リソースの props を部分上書きする（存在するキーのみ差し替え）。
    serverFunction: {
      functionProps: {
        memorySize: 1024,
        timeout: cdk.Duration.seconds(30),
      },
    },
  },
});
```

> `overrides` のキー構造・上書き可能な粒度は cdk-nextjs の版に追随して変わりうる（experimental v0.x）。版をピン留めし、更新時は README の overrides 仕様を確認してから上げる。実キー名はピンした版の型定義（`node_modules/cdk-nextjs`）を正とする。

## 手書き `AppService` と cdk-nextjs の使い分け

同一 patterns ディレクトリの `cdk-constructs.md` にある手書き `AppService`（Fargate + ALB）と、本ファイルの cdk-nextjs のどちらを使うかを次で判定する。`AppService` を選ぶ側が**汎用コンテナ経路**（cdk-nextjs をデプロイ先にしない構成）で、**判定軸はフレームワーク名ではなく「cdk-nextjs をデプロイ先にするか」**（下表の 1 行目は「非 Next.js なら cdk-nextjs を選べない」という含意の向きであって、逆——汎用コンテナ経路なら非 Next.js——は成り立たない）。語の正本は designing-aws の `reference/patterns/nextjs-deploy.md`「2 つのコンテナ経路」節。

| 状況 | 使うもの | 理由 |
|------|---------|------|
| Next.js アプリ・CloudFront 使用可 | `NextjsGlobalFunctions`（本ファイル・既定） | ISR / data cache / 画像最適化を construct が担い、毎回ゼロ設計しない |
| Next.js アプリ・予測可能高トラフィック | `NextjsGlobalContainers`（overrides で移行） | 常時稼働で最低レイテンシ・コンテナ運用に寄せる |
| Next.js アプリ・CloudFront 不可（GovCloud 等） | `NextjsRegional*` | designing-aws の選定マトリクス参照 |
| 非 Next.js の Node.js コンテナアプリ | 手書き `AppService`（`cdk-constructs.md`） | Next.js 特化のキャッシュ層が不要。汎用 Fargate + ALB で足りる |
| cdk-nextjs を採らない方針のプロジェクト | 手書き `AppService`（`cdk-constructs.md`） | cdk-nextjs は上書き可能な既定なので、採らない選択も許容 |

## 検証

cdk-nextjs は Docker でビルドするため、synth 前に Docker が起動していることを確認する。

```bash
# 型チェック（デプロイ前に必ず実行）
cd {infra-dir} && npx tsc --noEmit

# テンプレート生成（Docker が要る。cdk-nextjs が Dockerfile を生成してビルドする）
npx cdk synth

# 差分確認
npx cdk diff
```

- `cdk synth` が Docker を要求して失敗する場合は Docker デーモンの起動を確認する。
- 実 AWS への `cdk deploy` 検証は個別プロジェクト側の責務であり、本 worker の射程外。CLI 実走で外部（実 AWS / 実 GitHub）へ書き込む検証は行わない。

## 参照

- `cdk-constructs.md`（coding-cdk・同一 patterns ディレクトリ）: 手書き `AppService`（汎用 Fargate + ALB）・L2/L3 選定・Props 設計・合成パターンのガイドライン。**汎用コンテナ経路**（cdk-nextjs をデプロイ先にしない構成）はこちら。
- `cdk-aspects.md`（coding-cdk・同一 patterns ディレクトリ）: Aspects によるタグ付け強制・暗号化強制・コスト管理の方針。
- `environment-config.md`（coding-cdk・同一 patterns ディレクトリ）: 環境別設定管理（cdk.json / Props / SSM）。
- `nextjs-deploy.md`（designing-aws の reference/patterns）: 4 アーキテクチャ construct の選定マトリクス・既定フレーバー選定・コスト/トレードオフ・Lambda VPC アタッチ + NAT の判断。フレーバーを「どれにするか」はこちら。
- `cdk-design-patterns.md`（designing-cdk の reference/patterns）: cdk-nextjs L3 を採る場合のスタック分割（キャッシュ層の持ち込み先）。

