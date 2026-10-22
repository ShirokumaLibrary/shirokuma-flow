---
name: issue-flow
description: 課題を Issue 化しトリアージして次フェーズへ誘導する入口。Use when 課題を Issue 化するとき、トリアージするとき、次フェーズへ誘導するとき。
model: opus
---

# issue-flow（入口・トリアージ）

## 起動直後

Bash で `shirokuma-flow rules inject --scope orchestrator --rules trust-boundary,measurement-claims,completion-report-style,permission-boundary,gh-to-verb-map,rule-evolution,orchestration-discipline,next-routing-contract,status-policy,issuetype-hierarchy` を実行し、**出力の `<rule-file>` 要素を本タスクの規範として読む**。`<rule-file>` の外（ヘッダ行）に規範は載らない。

**参照する規範**

- `concept-gap-to-adr`: 本文に横断の判断（既存 ADR の変更・規約の確立）を含む
- `html-report-criteria`: 「確認ビュー」節で生成条件を判定する
- `confirmation-style`: 確認モードの解決値を委任ブリーフへ書く／確認モードの回に人へ確認を出す

参照集合（常時は注入しない。契機に当たったら `<rule-index>` の `file` から Read する）。

## 流れ

階層は 課題 > 設計(0..1) > 計画(0..n) > 実装サブ(0..n)（計画と実装サブは PR を 2 本以上に分ける課題だけに作る）。本 skill は課題本体 Issue を起票（IssueType = nature 型 Feature / Bug / Task…・`Backlog` で開始）し、トリアージで着手可能状態まで運ぶ。要件が曖昧なら `requirements-flow` を案内する。種別（kind）は GitHub の IssueType から導出する。

## 課題本体の本文の書き手と、提出前の分析

- **書き手は `requirements-worker`**: 課題本体の本文（起票時の本文と以後の更新）と論点のコメントは `requirements-worker` へ委任する。ブリーフには事実と論点を渡し、本文の見出しや形を決め打ちしない（[[orchestration-discipline]] C16）。起票は、worker が本文を書いたファイルのパスを返し、メインがそれを `shirokuma-flow issue create --body-file '<パス>'` に渡す（本文の無い課題を作らない）。パスは委任ブリーフで渡した作業用ディレクトリの配下で、シェルのメタ文字を含まないものだけを受け付け、単一引用符で囲んで渡す。
- **トリアージ提出の前に analyze-issue を通す**: AI が課題本体の本文を書いた回は、`submit` の前に skill `analyze-issue`（`review-worker`・対象種別「要件」）を通す。委任ブリーフには analyze-issue の SKILL.md の絶対パス（本 skill のディレクトリの隣）を渡す。レビュー結果が `NEEDS_REVISION` なら `requirements-worker` へ直しを委任して analyze-issue をもう一度通し、2 回目も `NEEDS_REVISION` なら `submit` せずに止まり人へ渡す。この回の設計要否・計画要否の判定行が課題の要否の判定を兼ねる（`next` は信頼投稿者の最新の判定を読むので、回し直した回の判定が前の回を上書きする）。
- **限界**: この段が掛かるのは本 skill を通る起票だけで、本 skill を通らない起票とトリアージ後の本文の更新には掛からない。段を飛ばした回を検知する機械段は無い（fail-open）。

## routing

1. `shirokuma-flow next <課題#>` を引く（確認モードの回は `--guided` を付ける）。
2. **手順の正本は注入される rule `next-routing-contract`**（`ok:false` の扱い・`verdict` の下表引き・`nextActions[]` の辿り方・`limits[]` の解決・確認モードの中継、ここには写さない）。

| verdict | 次手 |
|---|---|
| `gated` | `nextActions` が指す `submit` / `approve` を打つ（下記「状態遷移」の条件つき） |
| `designing` / `preparing` / `working` / `requirements` | 対応フェーズの skill へ渡す（表引きの正本は `autonomous-flow` の `reference/criteria/phase-skill-map.md`） |
| `select_child` / `all_children_done` / `leaf` / `reclassify` | `nextActions` に従う |

## 状態遷移（打ち方）

- **トリアージ提出**: `shirokuma-flow submit <n>`（Backlog → Review）。AI が課題本体の本文を書いた回は、上の提出前の analyze-issue を通してから打つ。
- **トリアージ approve**: **既定（自律）は orchestrator が `shirokuma-flow approve <n>`（Review → ToDo）を打つ**。`IssueType=ADR` の候補 Issue を含む `approve` の既定・人が打つ条件・判別手順の正本は [[status-policy]]（詳しい手順は `requirements-flow`）。
- **確認モードの回は人の `approve` を待って止まる**（止まるときは確認対象の所在と確認後に打つ verb を添える。逐語は `next --guided` の `nextActions[].runBy:"human"` が運ぶ）。

## 確認ビュー

確認用 What（Issue 要件）は HTML 化要否・生成の発火条件（既定は生成しない）・記録行の欄 id（`confirmation-view-record` / `decision-hesitation`）と値域・生成の委任先の正本は [[html-report-criteria]]（ここには写さない）。**記録行の書き込み・生成・`pages push` は、生成しない回も含めて正本の定める委任先へ委任する**（メインは本文も pages も書かない。委任先と順序は正本から引く）。委任ブリーフには skill `writing-html-explainer` の SKILL.md の絶対パス（本 skill のディレクトリの隣）を渡す。以下の書き込み経路と順序は委任先が通す（メインは打たない）。**書き込み経路**: 生成した回も生成しなかった回も `issue context <n>` → 本文編集 → `issue push <n>`（状態は触らない）で対象 Issue 本文の BLUF 位置へ記録行を残す（行の有無を生成／非生成の分岐に依存させない）。**確認ビューのリポジトリ内パスは生成より前に**本文へ書き（`pages-issue-drift` が本文の sha256 を焼き込むため）、**URL は本文へ書かない**（`preview-url-guard` が拒否する）。

## 停止境界

`ok:false` の回・`verdict` が上表に無い回・`nextActions` に `runBy:"human"` が現れた回・**ADR 候補の確定**（打ち手は `next` の `runBy` に従い、`runBy:"human"` に解決された確定で止まる。形と主体の正本は [[status-policy]] の `approve` 条項、AI に開く条件の正本は [[permission-boundary]]「verb 名では見分けられない副作用」節で、ここには条件を写さない）・確定を人が持つ ADR 候補に依存する課題を次の段へ進める回（順序の正本は [[concept-gap-to-adr]] 手順 5。他の課題は止めない）・提出前の analyze-issue が 2 回目も `NEEDS_REVISION` を返した回。境界の定義そのものは注入される rules の自律境界節が正本で、ここには写さない。状態遷移は `flow` verb のみ。
