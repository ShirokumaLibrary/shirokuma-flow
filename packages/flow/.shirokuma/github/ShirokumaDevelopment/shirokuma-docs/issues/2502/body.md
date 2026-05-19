---
number: 2502
type: issue
updated_at: "2026-05-13T01:08:51Z"
title: "feat(workflow): 親 Issue close 時に「計画 Issue 以外の子」を自動 close する逆方向連鎖"
status: In progress
priority: Medium
size: M
labels: ["area:cli", "area:workflow"]
assignees: ["particles7"]
subIssuesSummary: "[object Object]"
cached_at: "2026-05-13T01:09:26.486Z"
---

## 目的

親 Issue が close された際に、配下の「計画 Issue 以外の子」を自動 close する逆方向の連鎖を実装する。現状はサブ → 計画 → エピックの正方向連鎖（`syncParentStatus`、#2451 で実装済み）はあるが、親 → 子の逆方向は未対応で、不要になった子 Issue が残存する。

## 起点

- /insights 2026-05-09

## 検討事項

- 連鎖を発火させるトリガー（`issue close` / `issue cancel` / `pr merge` の挙動別）
- 子のうち「実作業サブ Issue」と「計画 Issue」の扱い分け（計画 Issue は `syncParentStatus` 側で扱われる）
- ループ防止（既存 `MAX_PARENT_SYNC_DEPTH = 2` パターンを踏襲）
- 子に PR/孫 Issue がある場合の挙動（`issue rollback` ロジック相当の検討）
- close 理由（NOT_PLANNED）の継承可否

## 注意

`syncParentStatus`（正方向）と対になる逆方向連鎖のため、`utils/parent-status.ts` 周辺の設計を再確認してから実装着手すること。

## 受け入れ基準

- [ ] 親 close 時に「実作業サブ Issue」が自動 close される
- [ ] PR/孫 Issue を持つ子はエラーにならず適切に扱われる（または明示エラー）
- [ ] 既存の正方向連鎖テストが PASS
- [ ] 新規シナリオの単体テスト追加