---
number: 2498
type: issue
updated_at: "2026-05-13T07:10:10Z"
title: "feat(lint): SKILL.md 行数ガイドライン (skill-md-size) 追加と肥大化スキルの reference/ 分割"
status: In progress
priority: Medium
size: M
labels: ["area:plugin", "area:lint"]
assignees: ["particles7"]
subIssuesSummary: "[object Object]"
cached_at: "2026-05-13T07:10:42.984Z"
---

## 目的

SKILL.md が際限なく肥大化することを防ぐため、行数ガイドライン（目安 250 行）を `lint workflow` のルールとして導入し、肥大化スキルの `reference/*.md` 分割を進める。

## 起点

- Discussion #2378 軸 D

## 検討事項

- `lint workflow` の新規ルール: `skill-md-size`（warn: 250 行、error: 400 行など）
- 現状の肥大化スキル（行数は時期により変動するため目安）:
  - `implement-flow/SKILL.md`
  - `review-issue/SKILL.md`
  - `prepare-flow/SKILL.md`
- 分割方針: 詳細手順・テーブル類を `reference/*.md` に切り出し、SKILL.md からは見出しレベルで参照する
- 既に運用されている `reference/` パターン（implement-flow など）との一貫性

## 受け入れ基準

- [ ] `lint workflow` で `skill-md-size` が動作する
- [ ] ★ 肥大化スキルが目安行数以下に収まる
- [ ] 既存の動作テスト（スキル本体の挙動）が壊れない