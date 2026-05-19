---
title: "chore: 中途半端に残った autoSetTimestamps と Project lifecycle 日時フィールド (Start at / Review at / End at) を完全削除"
type: Chore
priority: Medium
size: M
status: Backlog
labels:
  - area:cli
---

## 背景

GitHub Projects の lifecycle 日時フィールド (`Start at` / `Review at` / `End at`) と CLI 側の `autoSetTimestamps` 機能は廃止方針だったが、コードベースと Project 構成に中途半端に残存している。

### 現状の確認（2026-05-16 時点）

**Project 側**: 3 フィールドとも生存している
```
"Start at":  TEXT
"Review at": TEXT
"End at":    TEXT
```

**書き込み実態**:
| フィールド | 動作 | 例: Issue #2612 |
|-----------|------|----------------|
| `Start at` | 書き込まれない | 空 |
| `Review at` | 書き込まれる | `2026-05-16T16:07:39+09:00` |
| `End at` | 書き込まれない | 空 |

→ `Review at` だけが実質機能しており、それ以外は dead field。

**コード側に残る痕跡**:
- `packages/flow/src/utils/project-fields.ts:493` — `autoSetTimestamps()` 関数本体
- `packages/flow/src/utils/gh-config.ts:68` — Status→フィールドマッピング `"Review": "Review at"`
- `packages/flow/src/commands/project/setup.ts:49` — `LIFECYCLE_FIELDS = ["Start at", "Review at", "End at"]` (Project セットアップ時にフィールドを作成)
- `packages/flow/src/utils/issue-detail.ts:321` — Status 遷移時の `autoSetTimestamps` 呼び出し
- `packages/flow/src/commands/issue/{add,push,import}/`, `pr/{create,create-from-issue,merge}.ts`, `project/add-issue.ts` — `updateProjectStatus` 経由で autoSetTimestamps を発動させる前提のコメント・処理
- `packages/flow/src/commands/items/integrity/classify.ts:261` — Review Issue で Review at タイムスタンプが欠落 → warning

**ルール・スキル側に残る記述**:
- `.shirokuma/rules/shirokuma-flow/cli-status-update-policy.md:90,94` — `Start at` / `Review at` / `End at` 記録仕様の説明
- `.shirokuma/rules/shirokuma-flow/config-reference.md:155` — `"Review": "Review at"` マッピング
- `.shirokuma/rules/shirokuma/github/project-items.md:204` — PR の日時フィールド整合性チェック説明
- `plugin/shirokuma-skills-ja/skills/review-flow/SKILL.md` — Review ⇄ In progress 往復の設計意図として「`autoSetTimestamps` の Review at 重複記録を避ける副次効果」を記載

### 副次的な歪み

`review-flow` の Status 遷移仕様は「コード修正のときだけ Review → In progress → Review に往復」している。これは `Review at` 重複記録回避を副次効果として挙げているが、CLI 規約上は `Review ⇄ In progress` がそもそも禁止遷移で `--force` 必須。残骸機能のために矛盾遷移を残しているのは負債。

## 削除対象

### コード

- [ ] `packages/flow/src/utils/project-fields.ts` の `autoSetTimestamps` 関数削除
- [ ] `packages/flow/src/utils/gh-config.ts` の Status→タイムスタンプマッピング (`"Review": "Review at"`) 削除
- [ ] `packages/flow/src/commands/project/setup.ts` の `LIFECYCLE_FIELDS` 削除、Project セットアップ時のフィールド作成ロジック削除
- [ ] `packages/flow/src/utils/issue-detail.ts:321` の `autoSetTimestamps` 呼び出し削除
- [ ] `packages/flow/src/commands/issue/{add,push,import}/`, `pr/{create,create-from-issue,merge}.ts`, `project/add-issue.ts` の `updateProjectStatus` ルーティング前提コメント・処理整理（updateProjectStatus 自体は残す）
- [ ] `packages/flow/src/commands/items/integrity/classify.ts` の Review at 欠落 warning 削除

### ルール・スキル

- [ ] `.shirokuma/rules/shirokuma-flow/cli-status-update-policy.md` の autoSetTimestamps 関連節削除
- [ ] `.shirokuma/rules/shirokuma-flow/config-reference.md` の `"Review": "Review at"` マッピング行削除
- [ ] `.shirokuma/rules/shirokuma/github/project-items.md` の日時フィールド整合性チェック説明削除
- [ ] `plugin/shirokuma-skills-{ja,en}/skills/review-flow/SKILL.md` の「Review at 重複記録回避」副次効果記述削除 + Status 遷移仕様の見直し（往復廃止の検討）

### GitHub Project（手動）

- [ ] `Start at` / `Review at` / `End at` フィールドを Project から削除
- [ ] 既存 Issue の `Review at` 値はそのまま残置（過去データとして残す）か、削除するかを判断

### テスト

- [ ] `__tests__/` 内の autoSetTimestamps / LIFECYCLE_FIELDS / Review at 関連テストを削除または更新

## 完了基準

- [ ] `grep -rn 'autoSetTimestamps\|LIFECYCLE_FIELDS\|Review at\|Start at\|End at' packages/flow/src/` で残骸が出ない
- [ ] `shirokuma-flow project fields` の出力に `Start at` / `Review at` / `End at` が含まれない
- [ ] `review-flow` の Status 遷移仕様が更新済み（`Review at` を理由とした往復が消えている）
- [ ] `pnpm test` 全 PASS
- [ ] PR レビュー対応で `--force` を使わずに済むか、または `Review ⇄ In progress` の正規化を別 Issue として記録

## 関連

- PR #2614 レビュー対応中に判明（`--force` を 2 回必要とした）
- #2615 / #2616: PR #2614 の他のフォローアップ Issue
- `.claude/projects/-home-ubuntu-projects-shirokuma-docs/memory/project_status_flow_inprogress_review_gap.md` の「In progress → Review は CLI 正規ルール非対応」記載と関連
- ADR-v3-014 / ADR-v3-022: autoSetTimestamps 関連の過去 ADR（廃止判断時に参照・更新）
