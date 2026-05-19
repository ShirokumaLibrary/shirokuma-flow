---
title: "test(workflow): 統合テスト追補 — block/resume サイクル / reject 差し戻し / cancel カスケード親 sync"
labels: ["area:tests"]
issue_type: "test"
priority: "P3"
size: "S"
status: "In progress"
---

## 概要

`__tests__/integration/workflow/` のシナリオ追補。現状は計画→実装バトンタッチ・PR マージ・PR クローズロールバックの 3 本のみで、5 値ステータスモデル（ADR-v3-018）の **block / resume / reject / cancel カスケード** 経路が integration 層で未検証。

ラッパーコマンドの単体テスト（`__tests__/commands/{block,resume,reject,cancel}.test.ts`）と状態遷移ルールの単体テスト（`__tests__/utils/status-workflow{,-5values}.test.ts`）はあるが、**コマンド連携での副作用整合性**（コメント記録 + 状態遷移 + 親 sync）が integration では追えていない。

## 背景

`__tests__/integration/workflow/FINDINGS.md` の F-001/F-006/F-007 は対応済みで、追補すべきシナリオは新たに以下の 3 系統に集約される。

| 系統 | 検証したいこと |
|---|---|
| block/resume サイクル | In progress → Blocked → In progress の往復で reason コメントが正しく記録され、状態が戻ること |
| reject 差し戻し | Review → In progress（reject）→ 再 submit → Review の遷移後、reason コメント・履歴が integrity を保つこと |
| cancel カスケード親 sync | サブ Issue を `issue cancel`（NOT_PLANNED close）した後、親自動 unparent（#2024 Phase 2-A）と syncParentStatus 再評価が連鎖して動くこと |

## 追加テストファイル

### 1. `__tests__/integration/workflow/block-resume-cycle.test.ts`

| テストケース | 検証内容 |
|---|---|
| 正常系: `block` → reason がコメント投稿され Status: Blocked になる | コメント投稿 → 状態遷移 の順序、reason 文字列の伝播 |
| 正常系: `resume` で Blocked → In progress に戻る | 状態遷移のみ、コメント任意 |
| `resume --comment` 指定で comment → transition の順 | 既存 `resume.test.ts` と同等だがフル CLI 経由 |
| 異常系: ToDo から `block` を呼ぶと拒否される | `STATUS_TRANSITIONS["ToDo"]` に Blocked が含まれない |

### 2. `__tests__/integration/workflow/reject-cycle.test.ts`

| テストケース | 検証内容 |
|---|---|
| 正常系: Review → `reject --reason` で In progress に戻る | reason コメント記録 + 状態遷移 |
| 正常系: 差し戻し後に再度 `submit` で Review に戻れる | サイクルが詰まらない（履歴がデッドロックを起こさない） |
| 異常系: ToDo から `reject` を呼ぶと拒否 | `STATUS_TRANSITIONS["ToDo"]` に該当遷移なし |
| `reject` でコメント投稿が失敗した場合は transition をスキップ | 既存 `reject.test.ts` と同等だが副作用整合性を integration で確認 |

### 3. `__tests__/integration/workflow/cancel-cascade-parent-sync.test.ts`

| テストケース | 検証内容 |
|---|---|
| 正常系: サブ Issue を cancel すると親から unparent される | `issue cancel` の自動 unparent（#2024 Phase 2-A） |
| 正常系: 孫 Issue がある場合、孫も自動 unparent される | カスケード unparent |
| 親 sync: 残りサブ Issue がすべて Done なら親も Done に追従 | `syncParentStatus` の連鎖呼び出し |
| 親 sync: 残りサブ Issue に In progress があれば親は In progress を維持 | `syncParentStatus` の保守的判定 |

## 実装方針

- 既存 3 本（`prepare-to-implement` / `pr-merge-to-done` / `pr-close-rollback`）と同じパターンを踏襲
  - `jest.unstable_mockModule` で `gh` 呼び出し層をモック（CLI 呼び出しの副作用境界）
  - 委任先のラッパー（`cmdItemTransition`, `cmdAddComment`, `cmdItemClose`）はモックせず、**実装を経由して副作用を検証**する
- ヘルパーは `__tests__/integration/workflow/` 内で必要に応じて共有
- `FINDINGS.md` には追加発見があれば追記（Issue 化はその時点で判断）

## 受け入れ条件

- [ ] 3 ファイルが `__tests__/integration/workflow/` 配下に追加される
- [ ] 全 12+ ケースが pass する
- [ ] 既存の 3 本と合わせて `pnpm test __tests__/integration/workflow/` がオールグリーン
- [ ] pre-push の lint workflow（`__tests__` 命名規約）に違反しない

## 参考

- ADR-v3-018: Status ライフサイクルモデル全面改訂（5 値モデル）
- #2024 Phase 2-A: 孫 Issue 自動 unparent
- #2240 (F-007): pr create → linked Issue 自動 Review 遷移
- `__tests__/integration/workflow/FINDINGS.md`: 過去のワークフロー結合テスト発見一覧
