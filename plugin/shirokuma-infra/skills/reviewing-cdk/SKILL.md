---
name: reviewing-cdk
description: AWS CDK コードのレビューを行う。コンストラクト設計・Aspects パターン・スタック分割・テスト・型安全性をレビュー。Use when 「CDKレビュー」「コンストラクトレビュー」「cdk review」「IaCレビュー」「スタックレビュー」と言われたとき。
allowed-tools: Read, Grep, Glob, Bash, WebSearch, WebFetch
model: opus
disable-model-invocation: true
---

# AWS CDK コードレビュー

CDK コンストラクトの設計品質、Aspects パターン、スタック分割戦略、テストカバレッジをレビューする。

## スコープ

- **カテゴリ:** 調査系ワーカー
- **スコープ:** CDK TypeScript コードの読み取り（Read / Grep / Glob / Bash 読み取り専用）、レビューレポートの生成。コードの修正・`cdk deploy` は行わない。
- **スコープ外:** CDK コードの修正（`coding-cdk` に委任）、AWS リソースのプロビジョニング

## レビュー観点

### コンストラクト設計

| チェック項目 | 問題 | 修正方針 |
|------------|------|---------|
| L1 コンストラクト多用 | `CfnXxx` を直接使用 | L2 から始め、必要な場合のみ L1 を使用 |
| Props 設計 | 全フィールドが Required | `Partial<>` / Optional フィールドでデフォルトを設定 |
| コンストラクト粒度 | Stack に全リソースを定義 | 機能別にコンストラクトを分割 |
| ID 命名 | 意味のない ID（`Resource1`, `Lambda`） | 機能を表す説明的な ID を使用 |
| スコープの適切性 | `this` ではなく親スコープを渡す | 最小スコープを使用 |

### スタック分割

| チェック項目 | 問題 | 修正方針 |
|------------|------|---------|
| モノリシックスタック | 1 スタックに全リソース | Network / Stateful / Stateless で分割 |
| 循環参照 | スタック間の循環依存 | 依存方向を単方向に保つ |
| Cross-stack 参照 | `Fn.importValue` の過剰使用 | スタック間の Props 受け渡しを優先 |
| スタック数過多 | 細かすぎるスタック分割 | デプロイ単位として適切な粒度に統合 |

> **cdk-nextjs 経路の例外注記**: 上表の「モノリシックスタック（1 スタックに全リソース）」および前述のコンストラクト設計の「コンストラクト粒度（Stack に全リソースを定義）」を **cdk-nextjs 経路へ機械適用しない**。cdk-nextjs の construct（`NextjsGlobalFunctions` 等）は network（CloudFront/Lambda/ALB・必要時 VPC）と cache 層（S3/DynamoDB）を construct 内部に内包する設計であり、**Network/Stateful/Stateless の 3 分割が construct 内に現れないことは違反ではない**（construct が network 層とアプリ〔stateless〕層を内部に引き受けるため 3 分割が縮退し、別スタックに残るのは隣接 stateful〔アプリ固有の RDS/ElastiCache 等〕のみ、という縮退設計による）。**この例外は cdk-nextjs 経路に限る**。**汎用コンテナ経路**（cdk-nextjs をデプロイ先にしない構成）で全リソースを 1 スタック・1 construct に集約するアンチパターンは通常どおり指摘する（例外を広げない）。なお cdk-nextjs 採用時も Web（cdk-nextjs）と RDS（DataStack）のスタック分離は別軸として維持する。

### CDK Aspects

| チェック項目 | 問題 | 修正方針 |
|------------|------|---------|
| タグ付けの手動追加 | リソースごとに `Tags.of().add()` | `Aspects.of(app).add(new TaggingAspect())` |
| 暗号化強制 | 暗号化チェックが手動 | Aspects で一括強制 |
| コスト管理タグ | 一部リソースにタグ漏れ | Aspects でフォールバック保証 |

### 型安全性

| チェック項目 | 問題 | 修正方針 |
|------------|------|---------|
| `any` 型の使用 | Props や変数に `any` | 適切な CDK 型を使用 |
| Token 参照 | `cdk.Token.isUnresolved()` の未確認 | Token 参照を適切にハンドリング |
| 環境変数の型 | `process.env.X` をそのまま使用 | `process.env.X ?? throwIfMissing()` |
| construct.node.scope | 型アサーションで scope を取得 | CDK の適切な型を使用 |

### テスト

| チェック項目 | 問題 | 修正方針 |
|------------|------|---------|
| スナップショットテストのみ | ロジックをテストしない | Fine-grained assertions を追加 |
| テスト数不足 | カバレッジが低い | 主要コンストラクトにテストを追加 |
| `Template.fromStack()` 未使用 | raw CloudFormation でアサート | CDK assertions API を使用 |
| prop バリデーション | 不正な Props をテストしない | 境界値・異常系のテストを追加 |

### 環境設定

| チェック項目 | 問題 | 修正方針 |
|------------|------|---------|
| ハードコードされた ARN | `"arn:aws:..."` を直書き | SSM Parameter / context で外部化 |
| アカウント ID のハードコード | `"123456789012"` を直書き | `cdk.Aws.ACCOUNT_ID` または context を使用 |
| 環境別設定 | dev/prod の分岐が不明確 | Context / Environment class で分離 |
| `cdk.json` のシークレット | context にシークレット値を格納 | Secrets Manager / SSM を使用 |

### framework 既定との整合

対象が Next.js アプリの CDK コードの場合、cdk-nextjs 既定（既定フレーバー `NextjsGlobalFunctions` 起点・上書き可能な既定）と整合しているかをレビューする。

> **cdk-nextjs をデプロイ先にしない構成は固定語「汎用コンテナ経路」で呼ぶ**。**判定軸はフレームワーク名ではない**ので「非 Next.js だから」で分けない——Next.js アプリが汎用コンテナ経路を選ぶのは正当な選択肢であり、レビューで求めるのは選択の Why であって選択そのものの是正ではない。語の定義（コンテナフレーバー／汎用コンテナ経路）と帰結の正本は designing-aws スキルの `reference/patterns/nextjs-deploy.md`「2 つのコンテナ経路」節。 **construct 選定の判断基準そのものの正本は同ファイルの「4 アーキテクチャ construct の選定マトリクス」**で、下表の各行はそれを引くための入口として要点だけを持つ（**全件の列挙は持たない**）。

| チェック項目 | 問題 | 修正方針 |
|------------|------|---------|
| framework 既定の逸脱 | Next.js アプリで cdk-nextjs をデプロイ先にせず**汎用コンテナ経路**を手組み | 特段の理由がなければ cdk-nextjs 既定（`NextjsGlobalFunctions` 起点）へ寄せる。**汎用コンテナ経路の選択自体は違反ではない**ので、求めるのは設計上の Why の記載であって構成の是正ではない |
| construct 選定の妥当性 | 規模・トラフィックに合わない construct（`NextjsGlobal*`/`NextjsRegional*`）選定 | CloudFront 可否（Global/Regional）と運用・トラフィック特性（`NextjsGlobalFunctions`=可変・小トラフィックで最小コスト／`NextjsGlobalContainers`=予測可能な高トラフィック・最低レイテンシ・コンテナ運用向き）で選定根拠を確認。迷えば既定 `NextjsGlobalFunctions` |
| Web/RDS スタック分離 | Web（cdk-nextjs）と RDS を同一スタックに同居 | 別 CloudFormation スタックへ分離（blast radius 抑制） |

> cdk-nextjs 経路では上記「スタック分割」観点に **cdk-nextjs 経路の例外注記**（同節）が適用される点に注意。3 分割の欠如そのものは違反ではなく、逸脱として見るのは「Next.js アプリなのに cdk-nextjs 既定を採らず**汎用コンテナ経路**を手組みしている」場合である（その選択自体は正当な選択肢なので、求めるのは Why の記載）。

## ワークフロー

### 1. 対象ファイルの確認

```bash
# CDK 構造の確認
find . -path "*/lib/*.ts" | grep -v "test" | head -20
find . -path "*/bin/*.ts" | head -10
find . -name "*.test.ts" -path "*/cdk/*" -o -name "*.spec.ts" -path "*/cdk/*" | head -10

# Aspects の使用確認
grep -r "Aspects\|IAspect" --include="*.ts" -l | head -10

# テストファイルの確認
grep -r "Template.fromStack\|assertions" --include="*.ts" -l | head -10
```

### 2. Lint 実行

```bash
shirokuma-flow typescript lint -p .
```

> `lint code` はコアに無い。JS/TS の JSDoc タグ lint は LANGUAGE 軸の拡張 `@shirokuma-library/typescript` が `typescript lint` として提供する。拡張が入っていない環境ではこの段を飛ばし、飛ばした旨をレビュー報告に明記する。

### 3. コード分析

CDK ファイルを読み込み、レビュー観点テーブルを適用する。

優先チェック順:
1. 型安全性（コンパイルエラーリスク）
2. セキュリティ関連設計（IAM・暗号化）
3. スタック分割の適切性
4. テストカバレッジ
5. コンストラクト設計品質

### 4. レポート生成

**レポート先頭の判定行は機械分岐の契約**——委任元（orchestrator）がこの文字列を走査して差し戻しを分岐するため、一字一句この形式で必ず出力する。

```markdown
**レビュー結果:** PASS | NEEDS_REVISION

## レビュー結果サマリー

### 問題サマリー
| 深刻度 | 件数 |
|--------|------|
| Critical | {n} |
| High | {n} |
| Medium | {n} |
| Low | {n} |
| **合計** | **{n}** |

### 重大な問題
{型安全性・セキュリティ設計問題を列挙}

### 改善点
{コンストラクト設計・テスト改善提案を列挙}
```

### 5. レポート保存

PR コンテキストがある場合（PR も issue として top-level コメントできる。`<body>` は**本文そのもの**なので、ファイルは `-` で stdin から流す）:
```bash
shirokuma-flow issue comment {PR#} - < /tmp/shirokuma-flow/review-cdk.md
```

PR コンテキストがない場合（レビュー対象の Issue へ記録する）:
```bash
shirokuma-flow issue comment {Issue#} - < /tmp/shirokuma-flow/review-cdk.md
```

Issue も PR も無い場合は、**レポートをファイルのまま残し、完了報告にパスと判定行を含める**。CLI は Discussion へ書き込む verb を持たないので、レポートを Discussion へは投稿しない。

## レビュー結果の判定

- **PASS**: `**レビュー結果:** PASS` — 重大な問題なし
- **NEEDS_REVISION**: `**レビュー結果:** NEEDS_REVISION` — 差し戻し。Critical/High 問題あり

判定行はレポートの**最初の行**に置き、値はこの 2 値のみを使う（他の値は走査に一致せず分岐が成立しない）。一字一句合わせるのは判定行の位置とマーカーの形であって値の列挙ではない——雛形の `PASS | NEEDS_REVISION` は値域の表記なので、実出力ではどちらか **1 値だけ**を書く（両値を並べた行をそのまま出すと走査が PASS と読み取り差し戻しが消える）。

## 注意事項

- **コードの修正は行わない** — 所見の報告のみ
- CDK v2 を前提。v1 と v2 の API 差異に注意
- `cdk synth` の出力を確認できる場合は CloudFormation テンプレートも参照
