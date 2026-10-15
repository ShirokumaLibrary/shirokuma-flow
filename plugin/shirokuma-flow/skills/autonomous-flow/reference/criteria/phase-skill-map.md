# phase → skill マッピング（単一正本）

> **目的**: `next` コマンドの `nextPhase` 出力から orchestrator が **一意に**起動 skill を特定するための単一正本。
> orchestrator は `next <n>` を呼んだ後、返ってきた `nextPhase`（と必要なら `reason`）でこの表を引き、
> 対応する skill を `Skill` ツールで決定的に起動する。判定ロジックを skill 側で再実装しない。

判定の正本はあくまで CLI の `next`。
本表は「CLI が返す値 → 起動 skill」の対応だけを一意に固定する（命名の非対称や `null` 分岐の扱いを含む）。

## 表1: `next` 出力（`nextPhase`）→ skill マッピング

`next` が **実際に返す値のみ**を記載する。

| `nextPhase` | `reason` | 起動 skill |
|---|---|---|
| `Designing` | `no_children` / `design_child_incomplete` | design-flow |
| `Preparing` | `design_approved_plan_missing` / `plan_child_incomplete` / `no_plan_child` / `design_not_needed_plan_needed` | prepare-flow |
| `Working` | `plan_child_approved` / `plan_child_active` / `no_sub_child` / `sub_child_present` / `design_skipped_not_needed` / `plan_skipped_not_needed` / `sub_ready` / `sub_started` | implement-flow |
| `null` | `triage_incomplete` | skill 起動しない・既定は orchestrator が `submit`／`approve`を打って再 `next`（`IssueType=ADR` の候補 Issue も既定は orchestrator が打つ）。確認モード（`確認モード: guided` の明示がある回）では人の `approve` を待つ |
| `null` | `awaiting_approval` | skill 起動しない・既定は orchestrator が `approve`を打って再 `next`（`IssueType=ADR` の候補 Issue も既定は orchestrator が打つ）。確認モード（`確認モード: guided` の明示がある回）では人の `approve` を待つ |
| `null` | `sub_leaf` | skill 起動しない・`nextActions` に従う。sub は Done / Blocked の回だけ `leaf` になる。空なら何もしない（`done` を打たない） |
| `null` | `*_select_child` | skill 起動しない・次に着手する子を選んで `next <子番号>` |
| `null` | `*_all_children_done` | skill 起動しない・継続型（epic/research）の全子完了。次課題追加 or 人の判断で `shirokuma-flow done <n>`（COMPLETED close・正常終了）／取りやめは `cancel`（NOT_PLANNED） |
| `null` | `undetermined` | skill 起動しない・`shirokuma-flow status <n>` で状態確認して判断 |

## 表2: `next` 非経由の skill 起動トリガー

`Requirements` と `Reviewing` は `next` の出力（`nextPhase`）に依らず、orchestrator の文脈で起動する。

| フェーズ | 起動 skill | 起動タイミング |
|---|---|---|
| Requirements | requirements-flow | orchestrator が要件未確定を検知した時・または人が明示指示した時（issue-flow の前後） |
| Reviewing | review-flow | implement-flow 手順6: PR 作成後、`submit <pr>`（Backlog→Review）前の AI レビューとして起動 |

## 使い方

1. orchestrator が `next <n>` を呼ぶ。
2. 返ってきた `nextPhase` の値で **表1** を引き、対応 skill を決定的に特定して `Skill` ツールで起動する。
   `nextPhase` が `null` の場合は skill を起動せず、`reason` に応じた次手（表1 の右列）を実行する。
3. `Requirements`・`Reviewing` は `next` を経由しない。**表2** のタイミングで orchestrator が文脈判断で起動する。

## 注記

- **`next` の `reason` 値域に ADR は無い＝CLI は ADR 候補の状態でフェーズを止めない**。表1の `reason` に ADR（候補 Issue の Status・Accept の有無・`adr publish` の有無）を見る値は無い。入口ゲート 2 種も **対象 Issue 自身の Status だけ**を見るので、ADR 候補が未確定でも他の Issue のフェーズ判定には現れない。したがって **決定の段が起こした候補の確定と ADR 候補の PR の取り込みを次の段より先に済ませる順序は、CLI ではなく skill の手順（`design-flow` / `prepare-flow` の「段の順序」6・`implement-flow` の入口の確かめ。後者は決定の段が計画の回と、計画を飛ばした回の設計が起こした候補を持つ）と計画レビューが持つ**（正本は [[concept-gap-to-adr]] 手順 5）。`verdict` が次の段を示しても、その手順を飛ばさない。確定を人が持つ候補がある間に止めるのは、その候補に依存する課題の次の段だけで、他の課題は止めない。
- **`Requirements` / `Reviewing` は `next` が返さない**。
  `next` の出力の `nextPhase` は `Designing` / `Preparing` / `Working` / `null` のみを取る。
- **`*_select_child` / `*_all_children_done`** の `${kind}` 部分は実 kind に展開される
  （`epic_select_child`・`research_all_children_done` 等）。継続型（epic / research）
  の親に対して返る reason であり、親自身はフェーズを持たない（子課題を選んで `next <子>` する）。
- **`*_all_children_done` の done/cancel 案内は `next` 出力の `hint` が運ぶ**（optional な補足で、JSON 契約は不変）。抑制されるのは機械の auto-close であり、人起点の `done` は射程外。
- **`Working → implement-flow` の命名非対称**: `Preparing → prepare-flow` は語幹一致だが
  `Working → implement-flow` は語幹が一致しない。convention（フェーズ名から skill 名を機械導出）では
  解けないため、本表が本質的に必要（この対応を暗黙の規則で代替できない）。

## 参照元

- CLI: `shirokuma-flow next`
