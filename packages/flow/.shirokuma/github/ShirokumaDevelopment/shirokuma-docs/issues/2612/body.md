---
number: 2612
type: issue
updated_at: "2026-05-16T06:19:57Z"
title: "feat(skill): finalize-changes に finalize-worker SubAgent を導入してメインコンテキスト消費を削減"
status: Review
priority: High
size: M
labels: ["area:plugin"]
assignees: ["particles7"]
subIssuesSummary: "[object Object]"
cached_at: "2026-05-16T07:13:18.162Z"
---

## 目的

`implement-flow` / `review-flow` の利用者（開発者および Claude）が、後処理チェーンを途中停止なく完走できるようにする。現在 `finalize-changes` スキルが `simplify` と `security-review` を `Skill` チェーンで呼ぶため、両者の中間出力（diff・指摘リスト）がメインコンテキストに積まれ、auto-compression 直前で処理が止まる症状が観測されているため。

## 概要

`finalize-worker` SubAgent を新設し、`simplify` と `security-review` を SubAgent コンテキスト内で完結させる。`finalize-changes` スキルは「順次呼ぶ」ロジックを持たず、SubAgent 一つに集約する Agent 委任型に縮小する。

## 背景

`plugin/shirokuma-skills-ja/skills/finalize-changes/SKILL.md` は `implement-flow` と `review-flow` の末尾で呼ばれる共通後処理オーケストレーター。現在の構造:

| Step | 実行 | 呼び出し方 | 出力規模 |
|------|------|-----------|---------|
| 1 | `/simplify` | Skill | 大（コード全体レビュー + 修正 diff） |
| 2 | `reviewing-security` | Skill | 大（security-review 出力 + 修正 diff） |
| 3 | `shirokuma-flow lint docs` | Bash | 中 |
| 4 | `commit-worker` | Agent | 小 |

Step 1, 2 が `Skill` チェーンになっており、`simplify` と `security-review` の中間出力（diff 再掲・指摘リスト）が全てメインコンテキストに積まれる。`implement-flow` の末尾で発動する位置のため、実装作業で既に消費された context にさらに 2 つの大規模レビュー出力が加算され、auto-compression 直前で停止する症状の根本原因とみられる。

### 観測症状

- `implement-flow` / `review-flow` 末尾チェーン中の処理停止
- 主に `simplify` または `security-review` のステップで顕在化
- ユーザーから「最近途中で作業が止まる、スキル内でスキル呼ぶと止まることが多い」との指摘

## 検討事項

### 提案する分割

```text
finalize-worker (新設 SubAgent)
  - /simplify (builtin, Skill)
  - /security-review (builtin, Skill)
  - 変更サマリーのみ返す

finalize-changes (skill, 大幅縮小)
  - Agent(finalize-worker)
  - Bash(shirokuma-flow lint docs)
  - Agent(commit-worker) if git diff
```

メインに戻るのは `finalize-worker` の最終サマリー + `lint docs` 結果 + コミットメッセージのみ。`simplify` / `security-review` の中間レビュー出力は SubAgent コンテキストで破棄される。

### 設計論点

1. **`reviewing-security` の allowlist 判定（human-docs-only diff skip）の移植**
   - スキップロジック（`.md` のみ等の拡張子チェック）を `finalize-worker` の前段に Bash で組み込む
   - 既存最適化（#2483 / #2481）を維持する

2. **`reviewing-security` プラグインスキルの存続判断**
   - allowlist が SubAgent 側に移ると単なる薄いラッパーになる
   - 他からの呼び出しを grep で確認した上で廃止候補とする
   - 廃止判断は本 Issue の派生 Issue に切り出すことを検討

### 影響範囲

- `plugin/shirokuma-skills-ja/skills/finalize-changes/SKILL.md`（大幅縮小）
- `plugin/shirokuma-skills-en/skills/finalize-changes/SKILL.md`（EN 同期）
- `plugin/shirokuma-skills-ja/agents/finalize-worker.md`（新設）
- `plugin/shirokuma-skills-en/agents/finalize-worker.md`（新設）
- `plugin/shirokuma-skills-ja/skills/reviewing-security/SKILL.md`（存続判断後に対応）
- `plugin/specs/skills/finalize-changes/`（仕様更新）

## 成果物

- [ ] `finalize-worker` SubAgent が `simplify` + `security-review` を順次実行し、変更サマリーのみを返す
- [ ] `finalize-changes` スキルが `Skill` ツールを `allowed-tools` から外し、Agent 委任型になっている
- [ ] human-docs-only diff の skip 最適化が SubAgent 側で維持されている
- [ ] EN/JA 両方の plugin が同期されている
- [ ] `implement-flow` / `review-flow` の末尾チェーンが停止せずに完走することを手動検証

## 関連 Issue / PR

- #2084 — finalize-changes スキル抽出（共通化の起点）
- #2483 / #2481 — reviewing-security の AI-consumed asset 監査・docs-only skip（allowlist 移植の参照）
- #2509 / #2516 — lint docs 組み込み（Step 3 の参照）