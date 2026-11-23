---
name: prepare-flow
description: Preparing フェーズを統括し、計画 Issue（Plan）を作り承認ゲートへ運ぶ（承認で実装サブへ承認継承・計画の起案は作業セッションで回す）。Use when 計画 Issue を処理するとき、計画案を作るとき、計画レビューを進めるとき。
model: opus
---

# prepare-flow（Preparing フェーズ）

## 起動直後

追跡ツリーの外の作業用ディレクトリ（無ければ `mktemp -d` で作る）を使い（パスはコマンド行で単一引用符で囲む）、別の Bash 呼び出しで `shirokuma-flow rules inject --scope orchestrator --rules trust-boundary,measurement-claims,completion-report-style,permission-boundary,gh-to-verb-map,rule-evolution,orchestration-discipline,next-routing-contract,status-policy,issuetype-hierarchy > <作業用ディレクトリ>/rules-inject-prepare-flow.txt` を実行する。そのファイルを Read で末尾まで読み、**`<rule-file>` 要素を本タスクの規範として読む**。1 回で読めない大きさなら offset / limit で分けて続きを読み、`head` などで切って先へ進まない。Bash の結果に残る stderr のヘッダ行 `emitted=<件数>/…` の件数だけ `<rule-file>` を読んだことを確かめる。`<rule-file>` の外（ヘッダ行）に規範は載らない。

**参照する規範**

- `branch-workflow`: 「段の順序」節の計画要否の判定（Plan ケース）に入る
- `concept-gap-to-adr`: 計画が ADR 候補を含む
- `html-report-criteria`: 「確認ビュー」節で生成条件を判定する
- `confirmation-style`: 人へ確認・報告を出す（AskUserQuestion を含む）／確認モードの解決値を委任ブリーフへ書く

参照集合（常時は注入しない。契機に当たったら `<rule-index>` の `file` から Read する）。

## 流れ

階層は 課題 > 設計(0..1) > 計画(0..n) > 実装サブ(0..n)（計画と実装サブは PR を 2 本以上に分ける課題だけに作る）。本 skill は課題（設計がある場合は設計）の子として**計画 Issue（IssueType = Plan）**を作り、着手可能にする。実装サブは**計画の子**（`--parent 計画#`）。次フェーズは `implement-flow`。

**親が継続型（Epic / Research）の場合、Plan / Design を直接の子にはできない**（継続型の合法子は normal / sub のみ）。軽量なサブ作業は `継続型 > sub` で直接ぶら下げ可。分解が要る場合は `継続型 > 課題本体(normal) > (設計) > 計画(Plan) > サブ` の階層を踏む。

## routing

1. `shirokuma-flow next <課題#>` を引く（確認モードの回は `--guided` を付ける）。
2. **手順の正本は注入される rule `next-routing-contract`**（`ok:false` の扱い・`verdict` の下表引き・`nextActions[]` の辿り方・`limits[]` の解決・確認モードの中継、ここには写さない）。
3. **課題の作業は作業セッションで回す**: 管理セッションで起動した回は段の順序に入らず、skill `implement-flow` の `reference/docs/issue-run.md` を Read し、「作業セッションで回す回」の手順で作業セッションへ渡す（使える条件・使えない回の戻り先も同ファイル）。下の段の順序は作業セッションのメインが回す。

| verdict | 担い手 | 読む reference |
|---|---|---|
| `preparing`（計画立案） | 作業セッションのメイン（`reference/docs/drafting.md` を手順書として行う） | reference/templates/plan-issue.md ／ reference/criteria/decomposition.md |
| `preparing`（計画レビュー） | `review-worker` | reference/criteria/plan-review.md |
| `gated` | — | `nextActions` が指す `submit` / `approve` を打つ（下記「状態遷移」の条件つき） |
| `reclassify` | — | `nextActions` に従い（`issue set-kind <n> normal` → `next <n>`）、引き直した verdict でこの表を引き直す |
| `working` | — | `implement-flow` へ渡す（**計画を作らない**——`plan_skipped_not_needed` の課題は信頼投稿者の `**計画要否:** NOT_NEEDED` 契約〔analyze-issue、または設計の承認の後に design-flow が残す〕で計画フェーズがスキップされている） |
| `done` | — | 課題は Done（終端）。計画を起案せず、終わっていることを報告する（戻すかは人が決める）。`nextActions` に要素があれば規範 `next-routing-contract` 手順 3 のとおり辿る |

## 段の順序（本 skill が持つ実行順）

1. **計画の起案**（作業セッションのメインが `reference/docs/drafting.md` を手順書として行う・実装サブ Issue の分解を含む。作業記憶〔実行環境の永続メモリ〕のうち、この課題と変更対象に関わる項目を読む）。**サブは計画がまだ Backlog のうちに `--force` で起案する**——可否の正本は [[status-policy]]「入口ゲートの正規例外」で、これにより承認継承が発火する。スキップされるゲート全件は [decomposition.md](reference/criteria/decomposition.md)「計画 Backlog 中のサブ起案」。
2. **計画レビューを委任**（`review-worker`）。**approve でサブが一括 ToDo 昇格する前段なので、[plan-review.md](reference/criteria/plan-review.md) の「サブ Issue 本文の最低限確認」観点を含める。**
3. **レビュー結果を記録**: 判定行（`**レビュー結果:**`）＋所見は、段 2 の `review-worker` が `shirokuma-flow issue comment <計画#> -`（stdin）で計画 Issue へ記録し、判定行の値とコメントの所在だけを返す（メインは記録を書かない）。続けて「確認ビュー」節の記録行を委任先に残させる。
4. **提出 → approve**（下記「状態遷移」）。統合ブランチを使う計画（規範 `branch-workflow`「Plan ケース」）は、承認の前に作業セッションのメインが統合ブランチを作る（手順は skill `issue-run-flow` の `reference/procedure.md`）。
5. **承認継承の発火を出力 `sideEffects` で確認する**（[decomposition.md](reference/criteria/decomposition.md)）——**この確認はどちらのモードでも行う**（誰が `approve` を打ったかに関わらず発火の裏取りが要る）。
6. **決定の段の後（ADR 候補の PR）**: 本 skill が決定の段になるのは、設計を経ない課題の回である。計画の承認の後、`implement-flow` へ渡す前に、計画が起こした ADR 候補の確定と ADR 候補の PR の取り込みを済ませる（順序の正本は [[concept-gap-to-adr]] 手順 5 で、条件はここに写さない）。設計が決定の段だった回は、設計の側で済んでいることを計画レビューが確かめる（[plan-review.md](reference/criteria/plan-review.md) の決定の段の観点）。
   - 確定の打ち手は `next` の `runBy` に従う（形と主体の正本は [[status-policy]] の `approve` 条項）。確定を人が持つ候補がある間は、その候補に依存する課題を `implement-flow` へ渡さずに止まる。他の課題は止めない。
   - **ADR 候補の PR は、決定の段が起こした ADR 候補 Issue を本文で `Closes` する**（候補が複数なら 1 本の PR で全部を `Closes` する）。課題（親）・設計・計画・実装サブは閉じない。head は `shirokuma-flow branch name <ADR 候補の番号>` で導出し、base は既定ブランチで、PR を作るときに明示する（作るのは作業セッションのメイン・手順は skill `issue-run-flow` の `reference/adr-candidate.md`。統合ブランチ配下の課題でも同じ・[[branch-workflow]]「統合」）。中身は確定後の追従と glossary・`domain/` の更新だけで、`review-flow` を通して取り込む。
   - **DDD 文書の更新の振り分け**: 定義を変える更新（新しい概念・語・不変条件・既存の定義の変更）は、この段で ADR 候補を起こして ADR 候補の PR に乗せる。定義を変えない更新（既存の決定に従う notes・`adr:` 参照・言い回しの揃え）は、計画本文に明記して実装 PR の最初のコミットで入れる。ADR 候補も DDD 文書の更新も無い回は、ADR 候補の PR を作らない。

## 状態遷移（打ち方）

- `shirokuma-flow submit <計画#>`（Backlog → Review）→ `shirokuma-flow approve <計画#>`（→ ToDo・**承認継承**で計画自身の子の実装サブ〔Backlog〕が ToDo に上がり、**親導出**で親が前進する）。
- **既定（自律）は orchestrator が `approve` を打つ**（打ち手は `next` の `runBy` に従う）。`IssueType=ADR` の候補 Issue を含む `approve` の既定・人が打つ条件・判別手順の正本は [[status-policy]]（詳しい手順は `requirements-flow`）。
- **確認モードの回は人の `approve` を待って止まる**（確認対象の所在と確認後に打つ verb を添える。逐語は `next --guided` の `nextActions[].runBy:"human"` が運ぶ）。
- **入口の Status 判定は `shirokuma-flow next` / `status` の `verdict` と `nextActions` に従う**（Status 値ごとの分岐をここに写さない）。**見るのは対象課題自身の Status だけ**——関連する ADR 候補 Issue の Status はこのゲートの対象ではない。決定の段が起こした候補の確定と ADR 候補の PR の取り込みを次の段より先に済ませる順序は、このゲートではなく上の段の順序 6 と計画レビューが持つ（正本は [[concept-gap-to-adr]] 手順 5）。

## 確認ビュー

計画レビューの確認ビューは、HTML 化要否・生成の発火条件（既定は生成しない）・記録行の欄 id（`confirmation-view-record` / `decision-hesitation`）と値域・生成の委任先の正本を [[html-report-criteria]] に置く（ここには写さない）。**記録行の書き込み・生成・`pages push` は、生成しない回も含めて正本の定める委任先へ委任する**（メインは本文も pages も書かない。委任先と順序は正本から引く）。委任ブリーフには skill `writing-html-explainer` の SKILL.md の絶対パス（本 skill のディレクトリの隣）を渡す。以下の書き込み経路と順序は委任先が通す（メインは打たない）。置く時点は段の順序 3（レビュー結果の記録）の後で、確認モードの回は `approve` 待ちで止まる前。生成した回も生成しなかった回も `issue context <計画#>` → 本文編集 → `issue push <計画#>`（状態は触らない）で計画 Issue 本文の BLUF 位置へ記録行を残す。確認ビューのリポジトリ内パスは生成より前に本文へ書き（`pages-issue-drift` が本文の sha256 を焼き込むため）、記録行と同じ 1 回の本文編集にまとめる。URL は本文にもコメントにも書かない（`preview-url-guard` が `issue push` と `issue comment` の双方で拒否する）。

## 停止境界

`ok:false` の回・`verdict` が上表に無い回・`nextActions` に `runBy:"human"` が現れた回・**ADR 候補の確定**（打ち手は `next` の `runBy` に従い、`runBy:"human"` に解決された確定で止まる。形と主体の正本は [[status-policy]] の `approve` 条項、AI に開く条件の正本は [[permission-boundary]]「verb 名では見分けられない副作用」節で、ここには条件を写さない）・確定を人が持つ ADR 候補に依存する課題を次の段へ進める回（順序の正本は [[concept-gap-to-adr]] 手順 5。他の課題は止めない）。境界の定義そのものは注入される rules の自律境界節が正本で、ここには写さない。管理セッションのメインは実作業しない（計画本文は作業セッションのメイン・状態遷移は `flow` verb のみ）。

## リファレンスドキュメント

計画の雛形・分解基準・起案の手順は本 SKILL.md と同階層の `reference/` 配下。作業セッションのメインが段に入る直前に Read で読む（常時注入しない）。

| ドキュメント | 内容 | 読むタイミング |
|------------|------|--------------|
| [reference/docs/drafting.md](reference/docs/drafting.md) | 計画の起案の手順（計画本文・実装サブの起票・`--force` の正規用法） | 段 1 に入る前 |
| [reference/templates/plan-issue.md](reference/templates/plan-issue.md) | 計画 Issue 雛形（変更対象 / タスク分解 / リスク / 検証可能な受け入れ基準） | 計画起案時（毎回） |
| [reference/criteria/decomposition.md](reference/criteria/decomposition.md) | 分解粒度（サブの大きさの目安・系統ごとの分割）・親子構造（入れ子 4 階層・サブは計画の子）・承認継承の発火条件・sideEffects 確認手順 | サブ分解時・approve 後の発火確認時 |
| [reference/criteria/plan-review.md](reference/criteria/plan-review.md) | 計画レビュー観点カタログ（観測 ID 付き・件数は同ファイルに実在する「観点 N」見出しが正本で、ここには書かない）。**本スキルが所有** | 計画レビュー委任時 |
