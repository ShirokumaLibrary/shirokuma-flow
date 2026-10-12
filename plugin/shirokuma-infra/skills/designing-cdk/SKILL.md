---
name: designing-cdk
description: CDK コンストラクト設計を行う。スタック分割方針・L2/L3 コンストラクト選択根拠・Props インターフェース設計・Aspects ガバナンス設計をカバー。Use when 「CDK設計」「コンストラクト設計」「スタック設計」「CDKアーキテクチャ」「Aspects設計」「CDK構造設計」と言われたとき。
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, WebFetch, WebSearch
model: opus
---

# CDK コンストラクト設計

AWS CDK のコンストラクト構造・スタック分割・Props 設計・Aspects ガバナンスを設計する。

> **スコープ境界:** `designing-aws` は AWS リソース選定（何を使うか）を担い、本スキルは CDK コードの構造・設計パターン（どう実装するか）を担う。実装は `coding-cdk` が担当する。

## スコープ

- **カテゴリ:** 調査系ワーカー
- **スコープ:** 既存 CDK コードの読み取り（Read / Grep / Glob / Bash 読み取り専用）、CDK 設計ドキュメントの生成（Write/Edit — 設計成果物への書き込み）、Issue 本文への設計セクション追記。
- **スコープ外:** AWS リソース選定（`designing-aws` に委任）、CDK コンストラクトの実装（`coding-cdk` に委任）、docker-compose 設計（`designing-infra` に委任）

> **設計成果物の書き込みについて**: このスキルが Issue 本文・設計ドキュメントに Write/Edit するのは設計プロセスの成果物であり、プロダクションコードの変更ではない。調査系ワーカーの例外として許可される。

## ワークフロー

### 0. 既存 CDK 構成確認

**最初に**、プロジェクトの `CLAUDE.md` と既存 CDK コードを確認:

- CDK バージョン（v1 / v2）と言語（TypeScript / Python 等）
- CDK ディレクトリ構成（`infra/` や `cdk/` 等）
- 既存スタック数と分割方針
- 使用中の L2/L3 コンストラクト
- `cdk.json` の context キー構成

```bash
find . -path "*/infra/*.ts" -o -path "*/cdk/*.ts" | head -20
cat {infra-dir}/cdk.json 2>/dev/null
```

### 1. 設計コンテキスト確認

`design-flow` から委任された場合、Design Brief と要件が渡される。そのまま使用する。

スタンドアロンで起動された場合、Issue 本文と計画セクションから設計要件を把握する。

### 2. 設計フレームワーク適用（観点ごとに評価）

各設計観点を評価し、根拠を添えて決定する。各観点の詳細パターン（比較表・テンプレート・チェックリスト）は [reference/patterns/cdk-design-patterns.md](reference/patterns/cdk-design-patterns.md) を必要時に Read する。

| 設計観点 | 判断の骨格 | パターン参照 |
|---------|-----------|-------------|
| スタック分割 | ステートフル/ステートレス・変更頻度・責務・リスクで分割軸を決める（標準は Network → Stateful → Stateless の 3 分割） | reference「スタック分割設計」 |
| L2/L3 選択 | 標準ユースケースは L3、デフォルト設定が要れば L2、制御不能プロパティは L1 Escape Hatch | reference「L2/L3 コンストラクト選択設計」 |
| Props 設計 | 環境差異は Props で注入・Required/Optional を型で区別・専用型で型安全性最大化 | reference「Props インターフェース設計」 |
| Aspects ガバナンス | タグ付け・暗号化・コスト管理の一括適用要件があれば適用スコープを明確に設計 | reference「Aspects ガバナンス設計」 |

### 3. 設計出力・レビュー

設計出力テンプレート（スタック構成・設計決定・Props・Aspects・cross-stack 参照）とレビューチェックリストは reference を参照して埋める。状態遷移は orchestrator が flow verb で行う。

## リファレンスドキュメント

| ドキュメント | 内容 | 読むタイミング |
|------------|------|--------------|
| [reference/patterns/cdk-design-patterns.md](reference/patterns/cdk-design-patterns.md) | スタック分割・L2/L3 選択・Props 設計・Aspects・設計出力テンプレート・レビューチェックリスト | 各設計観点を詳細化する時・成果物を埋める時 |

## 次のステップ

`design-flow` 経由で呼ばれた場合、制御は自動的にオーケストレーターに戻る。

スタンドアロンで起動された場合:

```
CDK コンストラクト設計完了。次のステップ:
-> coding-cdk スキルで CDK コンストラクトを実装
-> フルワークフローが必要な場合は /design-flow を使用
```

## 注意事項

- 横断の決定を ADR に切り出したら、その What の着地は `docs-placement` 第 1 節の基準で判定し、カテゴリは `shirokuma-flow gate vocab --field adr-landing-category` から選ぶ（領域固有のカテゴリは無い）。
- **実装コードを生成しない** — 設計ドキュメントのみを出力。コード実装は `coding-cdk` の責務
- **AWS リソース選定には踏み込まない** — リソース種別の選択が必要な場合は `designing-aws` に委任
- CDK v2 (`aws-cdk-lib`) を前提とする。v1 の場合は個別パッケージ名に注意
- Aspects の実装は複雑なため、設計段階で適用スコープを明確にする
