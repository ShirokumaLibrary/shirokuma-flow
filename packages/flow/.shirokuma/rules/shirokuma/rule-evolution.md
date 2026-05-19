---
scope:
  - main
category: general
priority: required
---

# ルール・スキル進化

## 概要

RLAnything の閉ループ概念を応用し、プロジェクト固有のルール・スキルを体系的に進化させる。

```
Policy 実行（日常作業）→ Reward 観測（シグナル収集）→ Policy 更新（改善提案）→ Environment 適応（プラグイン昇格）
```

## フィードバックシグナル

| シグナル種別 | 収集タイミング | 例 |
|------------|--------------|---|
| ルール摩擦 | 随時 | ルール X を無視して手動修正した |
| やり直し指示 | 随時 | スキル Z の出力を修正させた |
| レビュー指摘パターン | PR レビュー | 同じパターンの指摘が 3 回 |
| lint 違反傾向 | lint 実行時 | ルール A の違反が増加傾向 |
| タスク成功率 | セッション終了 | Issue 完了率 |
| PR マージ率 | PR マージ時 | 初回レビューパス率 |

## シグナル永続化

Evolution Issue にシグナルをコメントとして蓄積する。

| 項目 | 値 |
|------|-----|
| Issue Type | Evolution |
| Emoji | 🧬 |
| タイトル形式 | `[Evolution] {トピック}` |

**コメント形式:**

```markdown
**種別:** {ルール摩擦 | 不足パターン | スキル改善 | lint 傾向 | 成功率}
**対象:** {ルール名 or スキル名 or 一般}
**コンテキスト:** {発生状況}
**提案:** {改善案}
```

## 進化トリガー

| トリガー | 条件 | アクション |
|---------|------|----------|
| 反応的 | 同一シグナルが 3+ 件蓄積 | `evolving-rules` スキルで分析・提案 |
| 予防的 | シグナル記録時にパターンを認識 | コメントに提案を含めて記録 |
| 定期的 | ユーザーが `evolving-rules` を明示的に起動 | 蓄積シグナル全体を分析 |
| ダッシュボード表示時 | `/show-dashboard`（`showing-github`）がシグナル蓄積を提示 | `evolving-rules` の起動を推奨（自動実行しない） |
| スキル完了時 | `implement-flow`、`prepare-flow`、`create-item-flow`、`design-flow`、`review-flow` の完了時 | 検出チェックリストで自動記録。シグナル未検出時はリマインド表示（フォールバック） |
| eval 失敗時 | `skill eval` または `skill optimize` で失敗が発生 | eval 結果パターンを Evolution シグナルとして記録。`evolving-rules` で説明改善を提案 |

## 責務境界

| スキル | 責務 | 入力 |
|--------|------|------|
| `discovering-codebase-rules` | コードパターン → 新規ルール提案 | コードベース分析 |
| `evolving-rules` | 既存ルール・スキルの分析・提案・Issue 記録 | Evolution シグナル |
| `coding-claude-config` | ルール・スキルファイルの作成・更新（実行者） | 提案内容 |

**曖昧領域:** `discovering-codebase-rules` が既存ルールの不備を検出した場合、Evolution Issue にコメントとして記録する。`discovering-codebase-rules` 自体はルールの修正を行わない（新規提案のみ）。

## 全体フロー

`evolving-rules` はルール・スキルの変更を直接行わない。提案を記録し、実装は通常のワークフローに乗せる。

```
シグナル蓄積 → evolving-rules（分析・提案）→ Issue 作成 → implement-flow（実装）
```

| フェーズ | 責任者 | 成果物 |
|---------|--------|--------|
| シグナル収集 | 各スキル（自動記録） | Evolution Issue のコメント |
| 分析・提案 | `evolving-rules` | before/after 提案、提案 Issue |
| ユーザー判断 | ユーザー | 提案 Issue の承認 |
| 実装 | `implement-flow` → `coding-claude-config` | ルール・スキルの変更 |

**重要**: `evolving-rules` の責務は「分析・提案・記録」まで。変更の適用は `implement-flow` ワークフローで実施する。

## ルール

1. **シグナルは Issue に記録** — メモリではなく Evolution Issue に蓄積する
2. **閾値を守る** — 3+ 件蓄積で分析起動、それ未満では自動提案しない
3. **慎重に提案** — 過度な提案はノイズになる。DemyAgent の「少ないツール呼び出しが効果的」を反映
4. **既存スキルと重複しない** — `discovering-codebase-rules` は新規パターン発見、`evolving-rules` は既存の改善
5. **変更の直接適用禁止** — `evolving-rules` は提案を Issue として記録するのみ。変更の適用は `implement-flow` ワークフローで実施する

eval データ参照・Evolution Issue ライフサイクル・スキル完了時の自動記録手順・スタンドアロンシグナル記録の詳細は `evolving-rules` スキル実行時に自動ロードされる。
