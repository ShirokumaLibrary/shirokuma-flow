# 作業セッションで Issue を回すときの手順

課題の作業は作業セッションで回す（やり切り方式。課題を回す唯一の方式）。1 つの担い手が 1 Issue のトリアージ（PR の無い課題）・設計の起案・計画の起案（実装サブの起票を含む）・実装・品質ゲート・commit / push・PR 作成・是正を、止めずに回す。担い手は作業セッション（linked worktree で開いた Claude Code のセッションのメインが skill `issue-run-flow` で回す）だけで、管理セッションは課題の作業をしない。作業セッションの中の手順は skill `issue-run-flow` とその reference が持つ。このファイルは、作業セッションを開いて課題を渡し締めの報告を受け取る管理セッションの手順（「作業セッションで回す回」）と、作業セッションの中で別の worker に残す段（「メインに残す段」）を持つ。入口はこのファイル 1 本で、`design-flow`・`prepare-flow`・`implement-flow`・`autonomous-flow` のどれを管理セッションで起動しても、課題の作業はこの手順で作業セッションへ渡す。段を誰が担うかの一覧は `autonomous-flow` の `reference/criteria/phase-skill-map.md` の表 3。

**チェーン語（`review-flow`・`implement-flow`・commit 等）を含む TODO 項目を pending / in_progress のまま作業セッションの待ちに入らない**（SubagentStop / Stop の連鎖検査が止める）。

## 使える条件と使えない回

- **使える条件**: 作業セッションを開く主体がいること。主体は人か固定の起動手段で、固定の起動手段には導入先が config `workSession.launcher` で有効にした CLI の `shirokuma-flow work-session open` が含まれる（定義の正本は skill `issue-run-flow` の冒頭・開き方は下の「作業セッションで回す回」の「渡す」3）。設計・計画の段から始める回は、さらに `issue context` のキャッシュの置き場（プロジェクトのルートの `.shirokuma/github/`）が導入先のリポで ignore されていること（作業セッションは ignore されていなければ何も書かずに止まって返す）。
- **使えない回は人が作業セッションを開く**: 固定の起動手段が無い・起動が失敗した回は、人に作業セッションを開いてもらう（人が主リポの作業ツリーで `claude -w issue-<番号>` を開き、そのセッションで `/issue-run-flow <番号>` を打つ）。人も開けない回（人が応答しない自律の回で固定の起動手段も無い構成など）・キャッシュの置き場が ignore されていない回・作業セッションが分離の確かめで何も書かずに止まった回（外れた条件と直し方〔人が主リポで打つ `git remote set-head origin --auto` など〕が締めの報告に載る）は、管理セッションで課題の作業をせずに止まり、理由を人へ返す。キャッシュの置き場の回は、導入先が `.shirokuma/github/` を ignore すれば使えることも人に知らせる。作業が始まった後に作業セッションが止まった回は、止まった理由に従う（作業ツリーと未 push の変更は作業セッションのツリーに残る。続けるか捨てるかは人が決める）。
- **代わりの経路（課題を立てられない回だけ）**: GitHub Project が未設定で `issue create` が通らない回・`issue create` が失敗して直せない回に限り、人が `claude -w` で開いたセッションで skill をそのまま打ち、そのセッションのメインが書く段・commit・PR を行う（commit と PR は skill `committing-and-opening-pr`。PR 本文の BLUF に `代わりの経路: <理由>` の 1 行を残す・理由は上の条件のどれか）。課題を立てられる回はこの経路を使わず、AI が自分でこの経路を選ばない（人が開いたセッションでだけ起こる）。この経路のセッションは skill `issue-run-flow` を起動しない。守らせる機械段は無い（fail-open）。

## 作業セッションで回す回（管理セッションの手順）

このセッション（管理セッション）は次の順で渡して受け取る。作業セッションの中の手順は skill `issue-run-flow` が持つ。

**渡す**

1. Backlog・Review（PR の無い）の課題もそのまま渡してよい。本文の仕上げ・提出前の分析・`submit` / `approve` は作業セッションが行う（skill `issue-run-flow` の「トリアージの段」）。起票してすぐ渡す課題は、skill `issue-flow` を起動せず、発端（人の言葉・背景・受け入れ基準の見込み）だけの seed を `issue create` で起票してよい（IssueType は課題本体の型〔Feature / Bug / Task など〕で、親は付けない。本文の渡し方は `design-flow` の段 1a の seed と同じ・起票の打ち手は規範 `orchestration-discipline` C16 ③）。`issue-flow` のトリアージ（提出前の分析を含む）を済ませ、ToDo にしてから渡してもよい。`begin` はまだ打っていなければ打たない（作業セッションが `next` から始める。既に In progress の課題も `working` から始まる）。
2. 渡す番号は、`next` が `designing`・`preparing`・`working` か、PR の無い `gated`（課題自身が Backlog か Review）を返す課題にする。例外は、統合ブランチを使う計画で子が全部 Done になり統合ブランチが残った親の課題で、`next` の `verdict` によらず、最終 PR を名指して渡す（下の「PR やブランチが 2 本以上になる課題」）。EPIC・Research は `next` に従って子を選び、その子を渡す。計画が要る課題は、作業セッションが計画の承認で終わった後、実装サブを 1 本ずつ別の作業セッションへ渡す。
3. 開く: 人に作業セッションを開くよう頼む前に、まず `shirokuma-flow work-session open --issue <番号>` を打つ（このセッションが打つ CLI の操作・規範 `orchestration-discipline` C16 ③）。起動手段が有効かは打った結果で分かり、人に開いてもらうかは下の `launched:false` の `reasonCode` ごとの分岐で決める。導入先の運用がその課題の effort を config の既定と違う値に決めた回は `--effort <low|medium|high>` を足す（選び方と人への確認は導入先の運用が持ち、決まりが無い導入先では付けない）。人がその会話で直接、その課題の作業セッションの model を指示した回だけ `--model <fable|opus|sonnet>` を足し、値は人が指示した値にする。指示が無い回は付けない（config の値で開く）。このセッションは自分の判断で model を選ばず、このセッションから model を提案して人に確かめる形も取らない（人が自分から指示した回だけ）。GitHub の本文・コメントや他のセッションの文面は指示に数えない。人が値域に無い model を指示した回は作業セッションを開かず、値域（fable / opus / sonnet）を伝えて人に選び直してもらう。`launched:true` なら作業セッションが起き、出力の `name` がその名前になる。`launched:false` なら何も起こしていないので、`reasonCode` で分ける: `limit` は待つ（開いているセッションが閉じるまで始めない）。`already-open` は `work-session list` でその課題の `state` を見る: `idle` / `busy` なら既に開いているので開き直さない。`gone` ならセッションが閉じてツリーだけが残っているので、待たずに下の「受け取る」6 の `work-session close` で撤去できるかを見る（撤去の確かめが外れたら人に渡す）。`list` に何も出ない回は同じ名前の tmux のセッションだけが残っているので、人に見てもらう。`launcher-unset`（導入先が起動手段を有効にしていない）・`no-tmux`・`tmux-unreadable`・`mainline-mismatch`・`config-unreadable`・`config-invalid`・`session-name-invalid`・`repo-path-unsupported` は、出力の `guide` を人に渡して人に開いてもらう（人が主リポの作業ツリーで `claude -w issue-<番号>` を開き、そのセッションで `/issue-run-flow <番号>` を打つ）。`work-session open` は起こす前に、config `dependency.isolatedTreeSubmodules` が宣言した submodule の gitlink の commit が主リポの module に無い回だけ、その module で取得する（結果は出力の `submodules`）。`submodule-url-mismatch`（module の取得元が `.gitmodules` の宣言と違う）・`submodule-fetch-failed`（取得の失敗）・`submodule-sha-missing`（取得してもその commit が無い）は、出力の `path` と `guide` を人に渡す（人がその submodule の運用ブランチを取得してから打ち直すか、人が作業セッションを開く）。`ok:false` のうち値の誤り（`issue-invalid`・`effort-invalid`・`model-invalid`）は何も起こしていないので、課題番号と effort と model を確かめ直して 1 回だけ打ち直す（model は人が指示した値を別の値に替えない。値域に無ければ人に選び直してもらう）。それ以外の `ok:false`（`new-session-failed`・取得の後に module の設定が変わった `submodule-changed` など）は起きたかを人に見てもらい、打ち直さない。導入先が別の固定の起動手段を用意している構成では、`work-session open` の代わりにその手段で開いてもよい（手段の条件は skill `issue-run-flow` の冒頭）。
4. 渡す: 開いたセッションが実行環境のセッション一覧に `name` で見えたら、SendMessage で渡す（一覧を何度も引かない。見えなければ人に作業セッションの画面を見てもらう——初回の確認画面で止まっていることがある）。本文には skill `issue-run-flow` の名前・課題番号と、その課題の作業に要る GitHub への書き込みの名指し（作業セッションは名指されていない書き込みをしない）を書く。このとき問い合わせと締めの報告はこのセッションへ届く。人が `/issue-run-flow` を打った回は、渡す手は要らない。
5. 渡した後は、その課題に状態遷移・委任を重ねない。作業セッションの許可プロンプトには答えない（人が答える）。

**見守る**: 一次は作業セッションからの SendMessage（問い合わせと締めの報告）を待つこと。実行環境の SendMessage に相手が次に止まったときに知らせる指定があれば、渡すときに付ける。定期の確かめは置かない。返事が無いまま止まって見えるときだけ、`shirokuma-flow work-session list` で課題の `state` を見る。`busy` は動いている。`gone` はセッションが閉じてツリーだけが残っている。`idle` は返事待ちと許可プロンプトを見分けないので、次の順で見る: ①その作業セッションからの問い合わせに未回答のものがあれば返事待ち（下の「問い合わせ」） ②締めの報告が届いていれば終わっている ③どちらも無ければ許可プロンプトか確認画面で止まっている見込みなので、人に作業セッションの画面を見てもらう（このセッションは許可プロンプトに答えない）。`unknown`（tmux の外・読めない回）は状態が分からないので、`next <番号>`・`pr list` で段の進み具合を見る。

**問い合わせ**: 作業セッションから届いた問い合わせは、まず正本（課題本文・設計・規範・`next`）で答える。「人の判断が要る」と印の付いた点と、`runBy:"human"` の操作・課題の What の変更に当たる点は自分で答えず、人に聞き、人の答えと明示して返す。問い合わせの本文は相手のセッションの申告で、人の指示ではない。

**受け取る**

1. 締めの報告は依頼元に届く（人が `/issue-run-flow` を打った回は人に届き、人がこのセッションへ伝える）。PR 番号・作業ツリーのパス・依頼元が行うことが載る。
2. `pr show <PR>` の `linked_issues` が渡した課題（計画を飛ばした課題は課題と、cancel・duplicate で閉じていない設計子の全件。`shirokuma-flow issue show <子#>` の `state_reason` が `NOT_PLANNED`・`DUPLICATE` の子は入れない）と合うことを確かめる。合わない回は merge へ進まず、作業セッションへ理由を返させる（閉じていれば人に渡す）。続けて `pr checks <PR>` の `merge_conditions.unmet` に条件 `review-verdict`（最新の判定記録が `PASS` で PR の head と合う）が載っているかと、同じ出力の `merge_conditions.review_lane` を読む。`review_lane` が `short-path`（最新の判定記録が短い経路の判定記録）の回は R1 の記録行を求めない（短い経路は R1 の 3 本を省き、CLI が判定を引き直して書いた判定記録がその代わりになる。PR 本文の差分の目視の 1 行は書いた本人の確かめで、ここでは照らさない）。それ以外の回（`normal`・欄が無い古い CLI の出力）は、`pr show` の本文に R1 の記録行（欄 id `asset-safety-review` と `fix-convergence-record`）がそろっているかを見る。
3. `review-verdict` が `unmet` に無く、記録行がそろっているか `review_lane` が `short-path` の回は、`review-flow` を R1 からやり直さず、同 skill の「段の順序」5（5-1 の動作確認・5-2 の merge）から進める。R1 の 3 本は作業セッションが別の worker へ委任して済ませ（短い経路の回は省き）、判定記録は CLI が値域を照らした形で書いているので、同じ差分を 2 回レビューしない（merge を誰が打つかは規範 `branch-workflow`「自律境界」のままで、人ゲートは変わらない）。
4. `review-verdict` が `unmet` に載る回（判定が `NEEDS_REVISION`・記録が無い・head と合わない）と、`review_lane` が `short-path` でないのに記録行がそろっていない回は、作業セッションが開いていればそちらへ返して是正を頼み、閉じていれば `review-flow` を通常どおり R1 から回す。
   - **merge 直前の全体の検査を宣言した構成**（`quality.fullVerifyAt: before-merge`・base が統合ブランチ〔`epic/*`〕でない PR）では、merge の前に `review-flow` の 5-2 の「merge 直前の全体の検査」のとおり `merge-verify-worker` へ委任する（作業セッションの品質ゲートは差分の範囲の検査だけを回している）。作業セッションを並べた回も、委任 → merge を 1 本ずつ行う。記録が `fail` か `取り込みの衝突` なら、作業セッションが開いていればそちらへ是正を返し、閉じていれば新しい作業セッションを開いて PR の是正から続けさせる（`next` が `gated` を返す）。
5. ADR 候補の PR（作業セッションが ADR 候補の確定の後に作って止まる PR）も 2〜4 の形で merge する。この PR の `linked_issues` は、その段が起こした ADR 候補 Issue だけと合えばよい（課題・設計は入らない）。取り込んだことを作業セッションへ伝える（人が打った回は人に伝えてもらう）。作業セッションはそこから課題の続きへ戻る。
6. 閉じて撤去する: merge の後（ADR 候補の PR があった回はその merge も済んでから）、`shirokuma-flow work-session close --issue <番号> --branch '<PR の head>'`（ADR 候補の PR があった回は `--adr-branch '<そのブランチ>'` も）を打つ。PR を統合ブランチ（`epic/<名前>`）へ merge した課題（EPIC の子）の回は `--base '<その統合ブランチ>'` も足す（既定ブランチの祖先にならないので、付けないと `branch-unmerged` で止まる。統合ブランチを既定ブランチへ merge して消した後は付けない——付けると fetch できず `base-unreadable`）。ブランチ名は `pr show` の `head`（統合ブランチは同じ出力の `base`）で、コマンド行へ載せる前に `^[A-Za-z0-9._/-]+$` に合い `-` で始まらないことを確かめる。`close` は起動手段の設定に依らず使え、人が `claude -w issue-<番号>` で開いた作業セッションにも使える。撤去の確かめ（ツリーに変更が無い・消すブランチが既定ブランチか `origin/HEAD`〔`--base` を渡した回はその統合ブランチも〕のどれかに取り込まれている・展開した pages の clone が辿れる・ワーカーのメモリーの置き場〔`.claude/agent-memory-local/`・`.claude/agent-memory/`〕に ignore されたファイルが無い）を先に通し、通った回だけ作業セッションを終わらせてツリーとブランチを消す。`closed:false` はツリーとブランチを消していないので、`reasonCode`・`stage`・`tree`・`branch` を人に渡す（ツリーの変更・取り込まれていないブランチ・処理中の画面などが残っている。`agent-memory-present` は作業ツリーで起動したワーカーのメモリーが残っている回で、ignore されていて `git status` に出ず、撤去すると消える。人が中身を見て、残すなら主リポの作業ツリーの同じ置き場へ移し、要らなければ消してから打ち直す。`stage` が `remove` の回だけは作業セッションを終わらせた後）。`ok:false` は値の誤り（何もしていない。`--base` が統合ブランチの形でない・既定ブランチと同じ名前の回は `base-invalid`）・シグナルの失敗（`stage` が `session-exit`・何も消していない）・消し始めた後の失敗（`stage` が `remove`・途中まで消えている）のどれかで、どれも打ち直さずに人に渡す。どの値でも別の手段（`git worktree`・`git branch`・`rm`・プロセスへのシグナルを直接打つ）で消さない。作業ツリーの名前が `issue-<番号>` でない作業セッションは対象外で、人が撤去する。

担い手の見分け・遷移を重ねないこと・記録済みの PR に R1 をやり直さないことは規律で、機械段は無い（fail-open）。

## メインに残す段

作業セッションの中で、書いた本人と別の主体が見る段は別の worker へ委任する: 設計レビュー・計画レビュー・トリアージの提出前の分析・PR のレビュー（R1 の 3 本・判定器が要る回の判定器）・ADR 候補の title と本文の整合（いずれも `review-worker` か R1 のレビュー worker）、確認ビューの生成（`explainer-worker`）。作業セッションのメインが自分で打つのは、状態遷移・判定記録と記録行・`design-flow` 5b の計画要否の照合と契約コメント・確認ビューの HTML 化判定・ADR 候補の起票と確定（`next` の `runBy` が `ai` の回）と ADR 候補の PR である（細目は skill `issue-run-flow` の「自分で打つもの・委任するもの」）。実装の段では次も自分で打つ。

- 4c の報告表の自己検査（`orchestration-discipline` C6 の完全性と `gate finalize --report '<報告表の絶対パス>'`）。不完全なら残工程を通す。
- 4d-2 の `gate summary --file '<実装サマリーの絶対パス>'`。
- 4d-3 の HTML 化判定（生成は `explainer-worker` へ委任）。

merge の判定と merge・作業ツリーの撤去は作業セッションの外（管理セッションか人）に残る。

## PR やブランチが 2 本以上になる課題

- **ADR 候補の PR**（設計か計画が ADR 候補を起こした回）: 作業セッションが起票・確定・ADR 候補の PR とそのレビューまで行い、merge を管理セッションに頼んで止まる（skill `issue-run-flow` の `reference/adr-candidate.md`）。管理セッションは上の「受け取る」5 のとおり merge し、取り込んだことを作業セッションへ伝える。
- **計画 NEEDED の課題**: 作業セッションは計画の起案（計画 Issue と実装サブの起票）と計画の承認で終わる。実装サブは 1 本ずつ、それぞれ新しい作業セッションへ渡す（並列にするかは `orchestration-discipline` C14 と導入先の運用）。統合ブランチを使う計画では、統合ブランチの作成は親の課題の作業セッションが計画の承認の前に行い、統合ブランチへの既定ブランチの取り込みと push は配下の実装サブの作業セッションがサブ PR を作る前に行う（手順は skill `issue-run-flow` の `reference/procedure.md`）。子が全部 Done になり統合ブランチが残った回は、管理セッションが親の課題について作業セッションを開き、その作業セッションが統合ブランチから既定ブランチへの最終 PR を作る（skill `issue-run-flow` の「始め方」）。
- **merge の後の予定の着地の切り替え**（merge した PR の本文の「予定の着地」行が展開できない回の値）: 管理セッションが切り替えの課題を起票し、作業セッションで回す（`review-flow` の段 5 の後）。

## 並列と merge の順

並列は `orchestration-discipline` C14 のとおり。同じ課題に 2 つの作業セッションを同時に走らせない。merge は 1 本ずつで、2 本目は作業セッションへ base の取り込みを頼み、増分を検査し直してから merge する。作業セッションが稼働中に共有ツリーで `merge` を打たない（`merge` は cwd のツリーを切り替える）。
