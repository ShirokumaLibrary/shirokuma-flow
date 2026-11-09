# phase → skill マッピングと段の担い手（単一正本）

> **目的**: ① `next` コマンドの `nextPhase` 出力から orchestrator が **一意に**起動 skill を特定するための単一正本（表 1・表 2）。
> orchestrator は `next <n>` を呼んだ後、返ってきた `nextPhase`（と必要なら `reason`）でこの表を引き、
> 対応する skill を `Skill` ツールで決定的に起動する。判定ロジックを skill 側で再実装しない。
> ② 方式ごとに各段を誰が担うかを引く一覧（表 3）。

判定の正本はあくまで CLI の `next`。
表 1・表 2 は「CLI が返す値 → 起動 skill」の対応だけを一意に固定する（命名の非対称や `null` 分岐の扱いを含む）。
表 3 は、方式ごとに各段を誰が担うかの一覧（担い手の名と手順の正本の所在だけ）を持つ。

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
| `null` | `sub_design_needed`（verdict `reclassify`） | skill 起動しない・`nextActions` に従い `issue set-kind <n> normal` で課題（normal）へ切り替えてから `next <n>` を引き直す（EPIC / Research 直下の sub に信頼投稿者の `**設計要否:** NEEDED` がある回。ToDo / In progress のときだけ） |
| `null` | `*_select_child` | skill 起動しない・次に着手する子を選んで `next <子番号>` |
| `null` | `*_all_children_done` | skill 起動しない・継続型（epic/research）の全子完了。次課題追加 or 人の判断で `shirokuma-flow done <n>`（COMPLETED close・正常終了）／取りやめは `cancel`（NOT_PLANNED） |
| `null` | `issue_done`（verdict `done`） | skill 起動しない・課題（kind normal / design / plan）自身が Done（終端）。子の状態や設計要否・計画要否の契約によらず段を返さない。終わっていることを報告する（戻すかは人が決める）。`nextActions` に要素があれば規範 `next-routing-contract` 手順 3 のとおり辿る |
| `null` | `undetermined` | skill 起動しない・`shirokuma-flow status <n>` で状態確認して判断 |

## 表2: `next` 非経由の skill 起動トリガー

`Requirements` と `Reviewing` は `next` の出力（`nextPhase`）に依らず、orchestrator の文脈で起動する。

| フェーズ | 起動 skill | 起動タイミング |
|---|---|---|
| Requirements | requirements-flow | orchestrator が要件未確定を検知した時・または人が明示指示した時（issue-flow の前後） |
| Reviewing | review-flow | implement-flow 手順6: PR 作成後、`submit <pr>`（Backlog→Review）前の AI レビューとして起動 |

## 表3: 方式 × 段 → 担い手

方式は 3 つ: 段ごとの委任（既定）・worker 方式・作業セッション方式（後の 2 つはやり切り方式。選び方は `implement-flow` の `reference/docs/issue-run.md` の「方式の選び方」）。表が持つのは担い手の名と手順の正本の所在だけで、責務・条件・手順は所在の側が持つ（ここに写さない）。「メイン」は方式を回すセッションのメイン、「作業セッション」は作業セッションのメイン、「管理セッション」は作業セッションへ渡す側のメイン。

| 段 | 段ごとの委任 | worker 方式 | 作業セッション方式 | 手順の正本 |
|---|---|---|---|---|
| 課題本文（起票・仕上げ） | メイン（起票）・`requirements-worker`（本文） | 同左 | 管理セッション（seed の起票）・作業セッション（本文） | `issue-flow`「課題本体の本文の書き手と、提出前の分析」「確認ビュー」／`implement-flow` の `reference/docs/issue-run.md`「作業セッションで回す回」・`issue-run-flow`「トリアージの段」 |
| 提出前の分析 | `review-worker` | 同左 | 同左 | `analyze-issue` |
| トリアージの遷移 | メイン | 同左 | 作業セッション | `issue-flow`「状態遷移（打ち方）」 |
| 設計の起案 | `design-worker` | `issue-run-worker` | 作業セッション | `design-flow`「段の順序」1b・`design-worker`／`issue-run-worker`「段と手順書」 |
| 設計レビュー | `review-worker` | 同左 | 同左 | `design-flow`「段の順序」4 |
| 計画要否の契約 | `design-worker` | 同左 | 作業セッション | `design-flow`「段の順序」5b／`issue-run-flow`「自分で打つもの・委任するもの」 |
| ADR 候補の起草 | `requirements-worker` | 同左 | 作業セッション | `requirements-flow`「ADR の状態遷移（打ち方）」／`issue-run-flow`「ADR 候補の段」 |
| ADR 候補の整合のレビュー | `review-worker` | 同左 | 同左 | `requirements-flow`「ADR の状態遷移（打ち方）」 |
| 計画の起案 | `plan-worker` | `issue-run-worker` | 作業セッション | `prepare-flow`「段の順序」1・`plan-worker`／`issue-run-worker`「段と手順書」 |
| 計画レビュー | `review-worker` | 同左 | 同左 | `prepare-flow`「段の順序」2 |
| 実装 | `coding-worker` | `issue-run-worker` | 作業セッション | `implement-flow`「段の順序」3・`coding-worker`／`issue-run-worker`「段と手順書」 |
| 品質ゲート | `finalize-worker` | `issue-run-worker` | 作業セッション | `implement-flow`「段の順序」4・`finalize-worker` |
| commit / PR 作成 | `commit-worker`・`pr-worker` | `issue-run-worker` | 作業セッション | `committing-and-opening-pr` |
| PR のレビュー（R1） | `security-review-worker`・`code-review-worker`・`asset-safety-review-worker` | 同左（`issue-run-worker` が入れ子で呼ぶ） | 同左 | `review-flow`「段の順序」／`implement-flow` の `reference/docs/issue-run.md`「PR のレビューを入れ子で回す回」 |
| R2 の是正 | `coding-worker`・`finalize-worker`・`commit-worker` | `issue-run-worker` | 作業セッション | `review-flow` の `reference/docs/review-gate.md`「R1b / R2」 |
| 判定記録・記録行・状態遷移 | メイン | 同左 | 作業セッション | 規範 `orchestration-discipline` C16 ③ |
| 確認ビューの生成 | `explainer-worker` | 同左 | 同左 | 規範 `html-report-criteria` |
| merge | メイン | 同左 | 管理セッション | 規範 `branch-workflow`「自律境界」 |

**倒れる向き**: 表は各定義と別に置くので、担い手の交代や節の改名に表が追いつかないことがある。照らす機械段は無い（fail-open）。食い違ったら所在の側に従う。

## 使い方

1. orchestrator が `next <n>` を呼ぶ。
2. 返ってきた `nextPhase` の値で **表1** を引き、対応 skill を決定的に特定して `Skill` ツールで起動する。
   `nextPhase` が `null` の場合は skill を起動せず、`reason` に応じた次手（表1 の右列）を実行する。
3. `Requirements`・`Reviewing` は `next` を経由しない。**表2** のタイミングで orchestrator が文脈判断で起動する。
4. 段を誰が担うかを引くときは **表3** を見て、手順は所在の側を読む。

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
