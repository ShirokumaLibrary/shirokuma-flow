# 委任判定規則（worker → ドメイン拡張スキル併用）

coding-worker / design-worker / review-worker が「コア単独で作業するか、ドメイン拡張スキル（shirokuma-nextjs / shirokuma-infra の coding-* / designing-* / reviewing-*）を併用するか」を自己判定する基準。**判定主体は worker**（orchestrator はブリーフに「拡張プラグイン候補」のヒントを書くだけで判定しない——orchestrator は対象ファイルを開かないため判定材料を持たない）。

## 判定: ① ∧ ② の 2 段機械判定

**① リポ依存検出**（拡張が関与しうるか・リポごとに 1 回）:

| 検出物 | 候補プラグイン |
|---|---|
| `package.json` に `next` 依存 | shirokuma-nextjs |
| `cdk.json` または `aws-cdk-lib` 依存 | shirokuma-infra（cdk/aws） |
| `@aws-sdk/*` 依存（または `docker-compose*.yml`/`compose.yaml` 内の `localstack` サービス定義） | shirokuma-infra（aws） |
| `Dockerfile` / `docker-compose*.yml` / `compose.yaml` | shirokuma-infra（infra） |
| `.github/workflows/*.yml` | shirokuma-infra（cicd） |

**② 対象パターン照合**（タスクの対象＝計画タスクの変更対象・PR 差分パス・Design Brief の言及）:

| 対象パターン | coding 時 | designing 時 | reviewing 時 |
|---|---|---|---|
| `app/**/(page\|layout\|route).tsx`・`"use client"/"use server"`・server action | coding-nextjs | designing-nextjs | reviewing-nextjs |
| `**/*-stack.ts`・`bin/*.ts`（CDK）・`cdk.json` | coding-cdk | designing-cdk | reviewing-cdk |
| `.github/workflows/**` | coding-cicd | designing-cicd | reviewing-cicd |
| `Dockerfile*`・`docker-compose*`・`compose.yaml` | coding-infra | designing-infra | reviewing-infra |
| `**/*.{ts,js,mjs,py}` のうち import/require に `@aws-sdk/` を含むファイル・LocalStack エンドポイント設定（`AWS_ENDPOINT_URL` / `localstack` 参照）を持つファイル | coding-aws | designing-aws | reviewing-aws |

## 規則

- **① ∧ ② が揃ったときだけ**拡張 skill を併用する。どちらか欠けたらコア worker 単独。
- **複数該当は併用**する（reviewing は観点を合算・coding はタスク単位で切替・designing はセクション単位で併記）。
- Issue ラベル（`area:nextjs` 等）は**強制オーバーライドのみ**: 付いていれば ①② を省略して該当拡張を採用する。ラベルを判定の既定にはしない（付け忘れで沈黙スキップする失敗を作り込まないため。①② の一次情報＝対象ファイルと依存は worker が必ず見るので付け忘れが起きない）。

## 実行機構: 拡張 SKILL.md＋reference を Read で読む（文書併読）

- 併用 = **拡張 skill の SKILL.md と reference/ を Read で文書として読み**、その観点表・判定表・パターン・雛形に従って自分で作業する。**Skill ツールでは起動しない**（worker は Skill ツールを持たない。tools は変更しない——特に review-worker の Read 系のみという安全境界を崩さない）。
- パス解決: 委任ブリーフにパスが明示されていればそれを Read。なければ skill 名（例: `coding-nextjs`）で Glob によりプラグインのインストール先（`**/skills/<skill名>/SKILL.md`）を探索して解決する。
- 解決できない（拡張プラグインが未インストール等）の場合は**沈黙スキップせず**、コア単独で作業した上でサマリーに「拡張 <名> を検出したが読めなかった」と明記する。

> 状態遷移・委任の制御は orchestrator の責務（worker は判定と併読のみ行う）。reference は rule を転記しない（リンク参照のみ）。
