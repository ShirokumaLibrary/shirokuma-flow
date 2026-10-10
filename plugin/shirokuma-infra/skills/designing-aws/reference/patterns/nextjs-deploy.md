# Next.js 本番 AWS デプロイパターン（cdk-nextjs 既定）

Next.js アプリを本番 AWS へデプロイするときの**上書き可能な既定**を定める。cdklabs/cdk-nextjs（v0.5.3 を前提に書いている）を Next.js アプリの既定 AWS デプロイスタックとする。

> **位置づけ（上書き可能な既定）**: cdk-nextjs は **「上書き可能な既定」**（固定強制ではない）。Next.js アプリの出発点は cdk-nextjs とし、要件に応じてコンテナフレーバー（cdk-nextjs 内）・汎用コンテナ経路（cdk-nextjs 外）へ差し替える余地を残す（下記「2 つのコンテナ経路」）。designing-aws の[フレームワーク判定ゲート](../../SKILL.md)で Next.js を選んだ設計者はまずこの既定に到達する。実 API（prop 名・`overrides` 構造）はピン版の型定義を正とし coding 時に版照合する（experimental v0.x）。

> **汎用パターンとの関係（層として重ねる）**: 汎用デプロイパターン（ECS Fargate + ALB）は `aws-resource-patterns.md`（コンピュート選定マトリクス）と `local-to-prod-mapping.md`（「アプリコンテナ → ECS Fargate / App Runner」行）が持つ。本 reference は Next.js アプリ向けの特化既定をその上に重ねる。汎用パターンが有効なのは**汎用コンテナ経路**（cdk-nextjs を使わない構成。非 Next.js アプリと、cdk-nextjs を使わないと決めた Next.js アプリの両方を含む）。**cdk-nextjs のコンテナフレーバー（`Nextjs*Containers`）はこれに当たらない**——cdk-nextjs の中の選択肢なので本 reference が扱う（下記「2 つのコンテナ経路」）。

## 2 つのコンテナ経路（語の定義）

「コンテナで動かす」は設計上の分岐にならない。cdk-nextjs の中にもコンテナ構成があるためで、**cdk-nextjs の中に留まるのか外へ出るのか**が分岐の実体である。本 skill 群ではこの 2 つを別語で固定する。

| 語 | 指すもの | cdk-nextjs | 下記「互換契約（ハード要件）」 | 既存 Dockerfile（`output: "standalone"` 前提） |
|---|---|---|---|---|
| **コンテナフレーバー** | cdk-nextjs の container 系 construct（`NextjsGlobalContainers` / `NextjsRegionalContainers`）| **使う（中に留まる）** | **効く** | **使わない**（Dockerfile は construct が生成する）|
| **汎用コンテナ経路** | cdk-nextjs を使わず汎用コンピュート選定（ECS Fargate + ALB 等）で組む構成。フレームワークを問わず、**Next.js アプリでも選べる** | 使わない（外へ出る）| **効かない** | **そのまま正しい**（自前で保持する）|

- **「フレーバー」は cdk-nextjs の construct を指す語**であり、cdk-nextjs の外の構成には使わない。cdk-nextjs を使わない構成は「汎用コンテナ経路」と呼ぶ。
- **設計文書ではこの 2 語をそのまま使う（同義語を作らない）。** 「従来の〜」「既存の〜」「レガシーな〜」のような**時系列の修飾を付けた言い換え**や**英語表記の別名**を使うと、同じものを指しているのか別のものなのかを読み手が判定できず、しかも判定を誤ると互換契約の適用可否（表の右 2 列）が反転する。
- **どの construct がコンテナフレーバーに当たるかの全件は上の表、4 construct の全体像は下記「4 アーキテクチャ construct の選定マトリクス」にある。** 他の skill / reference / テンプレートに出る construct 名は個別の名指しで、全件ではない。
- **判定軸はフレームワーク名ではない。** 「非 Next.js だから汎用コンテナ経路」ではなく、「cdk-nextjs をデプロイ先にするか」で決まる。Next.js アプリが汎用コンテナ経路を選ぶのは正当な選択肢である。
- **迷ったときの決め方**: cdk-nextjs の提供する ISR / キャッシュ層 / 静的資産配信を使うなら**コンテナフレーバー**（下記「4 アーキテクチャ construct の選定マトリクス」で construct を選ぶ）。それらを自前で持つ・持たない設計なら**汎用コンテナ経路**（`aws-resource-patterns.md` のコンピュート選定マトリクス／coding-cdk の `stack-structure.ts.template`）。
- **この選択は互換契約の適用可否を反転させる**（表の右 2 列）。既存の runner ステージを捨てるかどうかがここに乗るので、**先にこの語を確定してから Dockerfile に手を入れる**。

## cdk-nextjs を既定にする理由（Why）

- **上書き可能な既定と同型**: 全 construct が `overrides` prop で既存リソース持ち込み（`cacheBucket` / `alb` / `ecsCluster` 等）を含め深くカスタマイズできる。既定を出発点にしつつ差し替え自由という方針を本番デプロイ層へ同型で拡張する。
- **framework 非依存スタンスと親和**: cdklabs 公式・Apache-2.0・依存 none。Next.js を black box として扱い公開 adapter API に最小依存する設計原則で、Next.js 更新時の breaking 確率と保守負担を下げる。
- **最小構成から始める方針と一致**: 既定フレーバー `NextjsGlobalFunctions` は VPC/NAT 不要で最小コスト。「最小構成から始めてスケールアップ」方針（過剰プロビジョニングの回避）と合致する。
- **既存 CDK 資産と直交しない**: 既存 reference の L2/L3 選定・スタック分割の考え方を活かせる。cdk-nextjs L3 を採る場合、一般的な 3 スタック分割（Network / Stateless / Stateful）のうち Network / Stateless は construct が内部で構成する（CloudFront / Lambda / ALB とキャッシュ層 S3+DynamoDB）ため縮退し、cdk-nextjs が作らない**アプリ固有の隣接 stateful リソース（RDS / ElastiCache 等）だけを別 Stateful Stack として残す**構成に落ちる（cdk-nextjs のキャッシュ層 S3/DynamoDB は construct 自動作成なのでここに含めない）。

## 4 アーキテクチャ construct の選定マトリクス（サービス規模 × CloudFront 可否 × トラフィック）

cdk-nextjs は "One architecture does not fit all" として 4 つの construct を提供する。既定は `NextjsGlobalFunctions`。他 3 構成は要件に応じた上書き選択肢として提示する。選定は **① サービス規模 / トラフィック特性・② CloudFront 可否・③ 運用スタイル（サーバーレス/コンテナ）** の 3 軸で行う。

### 軸 A: サービス規模による既定選定（CloudFront 可の通常環境）

| 規模／要件 | 既定 construct | 構成 | Why |
|-----------|---------------|------|-----|
| 小規模・PoC・可変/低トラフィック（**既定の出発点**） | `NextjsGlobalFunctions` | CloudFront + Lambda + S3 静的資産 + S3/DynamoDB キャッシュ層 | VPC/NAT 不要・従量課金でアイドル安い（~$8/月）。過剰プロビジョニング回避 |
| 中〜大・予測可能な高トラフィック・常時稼働で最低レイテンシ | `NextjsGlobalContainers` | CloudFront + ALB + ECS Fargate + S3 + DynamoDB | コンテナ常時稼働で低レイテンシ。ALB 常時課金（~$20/月）だが高負荷では相対的に妥当 |

### 軸 B: CloudFront 可否・運用スタイルによる全 construct 対応表

| construct | 構成要素 | 規模の目安 | 位置づけ | 選ぶ場面 |
|-----------|---------|-----------|---------|---------|
| `NextjsGlobalFunctions` | CloudFront + Lambda（コンテナイメージ + Lambda Web Adapter）+ S3 静的資産 + S3/DynamoDB キャッシュ層 | 小規模・PoC・可変/低トラフィック | **既定推奨** | 何も選ばないプロジェクトの出発点。可変トラフィック・VPC/NAT 不要・最小コスト |
| `NextjsGlobalContainers` | CloudFront + ALB + ECS Fargate + S3 + DynamoDB | 中〜大・予測可能な高トラフィック | 上書き選択肢 | 予測可能な高トラフィック・常時稼働で最低レイテンシが要る・コンテナ運用に寄せたい |
| `NextjsRegionalContainers` | ALB + ECS Fargate + S3 + DynamoDB（CloudFront 不可） | 中〜大（CloudFront 制約下） | 上書き選択肢 | CloudFront が使えない環境（GovCloud 等）でコンテナ運用 |
| `NextjsRegionalFunctions` | API Gateway + Lambda + S3 + DynamoDB（CloudFront 不可） | 小〜中（CloudFront 制約下） | 上書き選択肢 | CloudFront が使えない環境（GovCloud 等）でサーバーレス運用 |

### 選定フロー

1. **CloudFront が使えない（GovCloud 等）** → `NextjsRegional*`。コンテナ運用なら `NextjsRegionalContainers`、サーバーレスなら `NextjsRegionalFunctions`。
2. **CloudFront が使える（通常）** → 規模軸（軸 A）で選ぶ:
   - 小規模・PoC・可変/低トラフィック → 既定 `NextjsGlobalFunctions`。
   - 中〜大・予測可能な高トラフィック・常時稼働で最低レイテンシ → `NextjsGlobalContainers`。
3. 迷ったら **`NextjsGlobalFunctions`**（既定）。後から `overrides` や construct 差し替えで移行できる（下記「後から construct を変える」参照）。

> **どの construct を選んでも下記「互換契約（ハード要件）」節がそのまま効く**（`adapterPath` を足す・`output: "standalone"` を使わない・Dockerfile は construct が生成する）。4 construct はいずれも cdk-nextjs をデプロイ先にするため、契約は construct 選択に依存しない。契約が外れるのは cdk-nextjs 自体を使わない**汎用コンテナ経路**を選んだときだけで、その場合は本マトリクス自体が適用外になる。

## 後から construct を変える（移行容易性）

既定 `NextjsGlobalFunctions` から始めて後で規模に合わせて別 construct へ移す場合の容易性。**同じ Global 系（サーバーレス ⇄ コンテナ）内の移行は比較的容易**だが、**Global ⇄ Regional（CloudFront 有無）の移行は実質再設計**になる。

| 移行 | 容易性 | コスト・手順 |
|------|-------|------------|
| `NextjsGlobalFunctions` ⇄ `NextjsGlobalContainers` | **比較的容易** | CloudFront・S3 静的資産・S3/DynamoDB キャッシュ層を**共有**し、差分は compute（Lambda ⇄ ALB+ECS Fargate）のみ。スタックコードの construct 差し替えが主。ただし CloudFront distribution が再作成される場合は DNS 切替（Route53 alias）が要る＝安全策は blue/green（新 construct を別 id で立て、DNS を新へ切替） |
| `NextjsGlobal*` ⇄ `NextjsRegional*` | **高コスト（実質再設計）** | CloudFront の有無で配信・URL・キャッシュ経路の構成が大きく変わる。エッジ配信を前提にした設計を Regional（API Gateway / ALB 直）へ組み替えるため実質再設計 |

- **設計上の勧め（移行を安くする）**: 拡大が視野にあるなら**最初からキャッシュ層（S3 `cacheBucket`・DynamoDB `revalidationTable`）を BYO（別スタックに分離）で持つ**。construct を差し替えてもキャッシュ資産が保持され、移行が破壊的でなくなる。BYO の受け渡しは `overrides` の `IBucket` / `ITable` 型で行う。
- **実キー名・overrides 構造は版照合**: BYO で渡す prop の実キー名・`overrides` の構造は cdk-nextjs 版に追随する（experimental v0.x）。ピン版（例 `cdk-nextjs@0.5.3`）の型定義を正とし、coding 時に `node_modules/cdk-nextjs` で照合する。

## 既定フレーバー `NextjsGlobalFunctions` の理由

- **VPC/NAT 不要**: Lambda がデフォルトでは VPC 外に置かれ、NAT Gateway（~$32/月/AZ + データ処理料）が発生しない。CloudFront + Lambda + S3 + DynamoDB はいずれも VPC を必須としない。
- **月額概算 ~$8**: 小規模トラフィック前提の最小構成。CloudFront・Lambda・S3・DynamoDB はいずれも従量課金で、アイドル時のコストが小さい。ALB（~$20/月・常時課金）や NAT Gateway を持つコンテナフレーバー（`Nextjs*Containers`）より出発点として安い。
- **最小構成から始める方針と一致**: トラフィックが予測可能・大規模になった段階で `NextjsGlobalContainers`（ALB + ECS Fargate）へ上書き移行する。最初からコンテナ + ALB を積まない。

> 参考コスト値の前提（リージョン・時点）は `local-to-prod-mapping.md` の「コスト概算」と同じ。実額は使うリージョンで AWS Pricing Calculator を使って試算すること。

## Lambda VPC アタッチ + NAT のトレードオフ

`NextjsGlobalFunctions`（Lambda フレーバー）採用時、アプリが同一 VPC 内の RDS / ElastiCache（既存 infra 既定は private subnet 配置）へ到達する場合は Lambda を VPC アタッチする。このとき NAT Gateway が要るかは**到達先サービスの VPC エンドポイント種別**で決まり、既定コスト ~$8/月からの乖離は限定的:

- **S3・DynamoDB は Gateway 型 VPC エンドポイントが使え無料**（時間課金・データ処理料なし）。cdk-nextjs のキャッシュ層（S3 + DynamoDB）は Lambda が VPC アタッチされていても Gateway 型エンドポイント経由で到達でき、**この 2 サービスのために NAT Gateway は不要**。
- **RDS 等の同一 VPC リソースへの到達も NAT 不要**: 同一 VPC 内の private subnet に置いた RDS へは VPC 直結で到達する（インターネットを経由しない）ため NAT を要しない。
- **Interface 型エンドポイントが要るサービスはコストが乗る**: Secrets Manager・SQS・SNS・SES など**ほとんどの AWS サービスは Interface 型 VPC エンドポイント（AWS PrivateLink）が必要**で、時間課金 + データ処理料（~$0.01/h/AZ）が発生する。NAT Gateway（~$32/月/AZ + データ処理）よりは安いがゼロではない。VPC アタッチした Lambda からこれらへ到達するなら Interface 型エンドポイントを設計に含める。
- **判断ヒント**: 「Lambda VPC アタッチ + RDS」の組み合わせ自体は、キャッシュ層の S3/DynamoDB が Gateway 型で無料なので既定の「VPC/NAT 不要 ~$8/月」からの乖離は限定的。Secrets Manager 等 Interface 型が要るサービスをどれだけ使うかでコストが決まる。NAT Gateway を無条件に足す前に、到達先がどのエンドポイント種別で足りるかを確認する。

> エンドポイント種別の一般則は `aws-resource-patterns.md` の「NAT Gateway vs VPC Endpoint」表と揃える。

## 互換契約（ハード要件）

cdk-nextjs をデプロイ先にする場合、Next.js アプリ側に以下の互換契約が要る。

> **適用範囲は construct 非依存**: 本節は上記 4 construct の**すべて**（`NextjsGlobalFunctions` / `NextjsGlobalContainers` / `NextjsRegionalContainers` / `NextjsRegionalFunctions`）に等しく効く。コンテナフレーバーを選んでも免除されない。**効かないのは「2 つのコンテナ経路」の汎用コンテナ経路（cdk-nextjs を使わない）だけ**で、そのときは standalone 前提の既存 Dockerfile がそのまま正しい。

- **next.config に `adapterPath` を追加**: `adapterPath: import.meta.resolve("cdk-nextjs/adapter")` を設定する。cdk-nextjs は Next.js の公開 adapter API を使う。
- **`output: "standalone"` は使わない**: cdk-nextjs は Next.js を black box 扱いし、standalone 出力前提とは同時両立しない。既存の汎用 Dockerfile（standalone 前提）は**汎用コンテナ経路**（cdk-nextjs を使わない構成）用に残し、cdk-nextjs 経路では使わない。
- **バージョン下限**: Next.js **v16.2 以上**（Image Optimization Caching の公開 API 依存）・Node **v24**・Docker 必須。cdk-nextjs が自前で Dockerfile を生成する。
- **成熟度リスク（版固定推奨）**: cdk-nextjs は experimental（v0.x・後方非互換更新があり得る）。**版を固定してピン留めする**（例: `cdk-nextjs@0.5.3`）ことを推奨し、更新時は breaking の有無を確認してから上げる。cdk-nag で AWS ベストプラクティスが適用される。

## ローカル開発ループには Lambda/API Gateway エミュレーションが不要

`NextjsGlobalFunctions`（既定）の Lambda コンテナイメージは Lambda Web Adapter 経由で通常の HTTP サーバー（`next start` 相当）をそのまま公開する構成のため、**ローカル開発では同じコンテナイメージを `docker run`（または docker-compose）で通常の Web サーバーとして起動するだけでよく、Lambda・API Gateway をエミュレートする必要が無い**。本番でのみ Lambda Web Adapter が Lambda イベント（API Gateway / CloudFront 経由）をコンテナ内の HTTP リクエストへ変換して橋渡しする。

- LocalStack で Lambda/API Gateway を再現する経路（`coding-infra/reference/patterns/localstack.md`）は、この Next.js 既定パターンでは**不要**。汎用（非 Next.js）の Lambda 関数を書く場合にのみ検討する。
- 汎用 Lambda + API Gateway 構成のローカル開発パターン自体は**本 skill の参照パターンには無い**。

## キャッシュ層（construct が自動作成・自動注入）

ISR / data cache / full route cache 用のキャッシュ層は construct が自動作成する。アプリ・ローカル環境は意識不要:

- **S3**: data cache / full route cache の本体を保持する。
- **DynamoDB**: tag revalidation のメタデータのみを保持する（**キャッシュ本体ではない**）。タグ単位の失効管理に使う軽量テーブル。
- **環境変数の自動注入**: これらへの接続情報は `CDK_NEXTJS_*` 環境変数で construct が自動注入する。アプリのローカル docker-compose 側にキャッシュ層をモデル化する必要はない（本番 construct が env で供給する）。

## 参照

- `aws-resource-patterns.md`（designing-aws・同一 patterns ディレクトリ）: 汎用コンピュート選定（ECS Fargate + ALB）・NAT Gateway vs VPC Endpoint の一般則。**汎用コンテナ経路**（cdk-nextjs を使わない構成。Next.js アプリを含む）はこちら。**コンテナフレーバー（`Nextjs*Containers`）はこちらではなく本ファイルの選定マトリクス**。
- `static-asset-delivery.md`（designing-aws・同一 patterns ディレクトリ）: **静的資産の配信**を扱う。本ファイルの 4 construct はいずれも「S3 静的資産」を自動構成するが、**Content-Type / 圧縮 / キャッシュのどこまでを construct が決めるかはこの配布物の記述からは読めない（未確認）**。construct を選んだ後も、配信経路の選定と配信属性の確認はあちらを通す。
- `long-lived-connections.md`（designing-aws・同一 patterns ディレクトリ）: **接続の寿命**を扱う。ALB を持つ構成（`Nextjs*Containers` ＝コンテナフレーバー）で SSE / ストリーミングを出すなら通す。**ALB を持たない構成（既定 `NextjsGlobalFunctions` / `NextjsRegionalFunctions`）で接続の寿命を何が決めるかは、あちらにも本ファイルにも記述が無い（未確認）**——それでも設計成果物には同じ 4 行を書き、値が引けなければ「引けなかった」と書く。
- `local-to-prod-mapping.md`（designing-aws・同一 patterns ディレクトリ）: ローカル↔本番マッピング・コスト概算。「アプリコンテナ」行の cdk-nextjs 分岐はこちらから本ファイルへ相互参照。
