# やり切り方式で Issue を回すときのメインの手順

やり切り方式は、1 つの worker（`issue-run-worker`）が 1 Issue の設計の起案・計画の起案（実装サブの起票を含む）・実装・品質ゲート・commit / push・PR 作成・是正を、段ごとの worker（`design-worker`・`plan-worker`・`coding-worker`・`finalize-worker`・`commit-worker`・`pr-worker`）の定義を手順書として読んで回す方式。PR のレビュー（R1 の 3 本・R1b / R2 の巡・判定器が要る回の判定器）は、worker がレビュー worker を固定形のブリーフで入れ子に呼んで回す（下の「PR のレビューを入れ子で回す回」）。設計レビュー・計画レビュー・判定記録・状態遷移・merge の判定はメインと別の worker に残る（下の「メインに残す段」）。worker 側の約束（ブリーフ・止まり方・結果行・SendMessage の形）は `issue-run-worker` の定義が持つ。入口はこのファイル 1 本で、`design-flow`・`prepare-flow`・`implement-flow` のどこから入っても、やり切り方式の回はこの手順で委任する。

**やり切り方式の PR では R2 の 3 worker（`coding-worker`・`finalize-worker`・`commit-worker`）を委任しない**（同じ作業ツリーに 2 主体が書く。書く `issue-run-worker` が残っていない下の「是正の続きが `not-isolated` を返した回」を除く）。是正は同じ `issue-run-worker` への SendMessage で頼む。

**チェーン語（`review-flow`・`pr-worker`・commit 等）を含む TODO 項目を pending / in_progress のまま worker の待ちに入らない**（SubagentStop / Stop の連鎖検査が止める）。

## 方式の選び方

- **既定は段ごとの委任**（`implement-flow` の「誰が何を行うか」）。やり切り方式は、人がその回（その課題、または人が範囲を言った会話の範囲）にやり切り方式を指示したとき、または人がその会話で直接依頼してプロジェクトの規範に書かせた常設の指示があるときだけ使う。常設の指示は、依頼を受けたかの判断をその会話のメインが行い、規範に書くのは書き手（worker か作業セッションのメイン）でよい。規範への書き込みは通常の変更（課題・PR・レビュー）で入れ、取り込まれてから効く。規範には依頼の出所（日付と課題）と射程（掛かる課題・掛からない回）を書く。人が依頼したかを機械で確かめる層は無い（fail-open）。`autonomous-flow` 配下でも、人の起動時の指示に含まれていなければ既定で回す。
- **指示の形**: 会話での指示に加え、skill の起動の引数に語 `issue-run` がある回を指示ありと読む。どちらで選んだかを締めの報告に書く。人の指示は課題に掛かり、その課題の計画の実装サブにも掛かる。
- **使える条件**: 設計・計画の段から始める回は、`issue context` のキャッシュの置き場（プロジェクトのルートの `.shirokuma/github/`）が導入先のリポで ignore されていること。ignore されていなければ worker は何も書かずに `cache-not-ignored` で返る（下の ③）。
- 判断材料: 開発側の資料で 2 方式を比べ、差ははっきりしなかった。導入先の入力では確かめていない。採否は使いながら決める。
- **既定の方式へ戻すのは、作業がまだ何も始まっていない回だけ**: ①最初の委任で worker が `BLOCKED reason=not-isolated` を返した（分離が効かない版・構成。作業ツリーが `origin/<base>` の先端でも `origin/HEAD` から作ったばかりのブランチでもない回・`origin/HEAD` が無い手元を含む。何も書かずに返る。worker が結果行の前に書いた外れた条件と直し方〔人が主リポで打つ `git remote set-head origin --auto` など〕は、締めの報告で人に渡す） ②実行環境に SendMessage の道具が無い（委任の前に分かる） ③最初の委任で worker が `BLOCKED reason=cache-not-ignored` を返した。その課題を最初から既定の方式（設計の段からなら `design-worker`・計画の段からなら `plan-worker` から段ごとの委任）で回し、戻したことと理由を締めの報告に書く。③の回は、導入先が `.shirokuma/github/` を ignore すれば使えることも人に知らせる。作業が始まった後の失敗は下の「再開できない回」に従う（PR 作成の後に是正の続きの委任が `not-isolated` を返した回だけ、その PR の残りを既定の方式の R2 で続ける＝下の「是正の続きが `not-isolated` を返した回」）。どの op でも worker が `BLOCKED reason=push-denied-by-hook` を返した回は、下の「hook が push を止めた回」に従う。

## 委任

`next` / `begin` まで今までどおり打ち、`issue-run-worker` を委任する。始める段は委任の時点の `next` の `verdict` で決め、ブリーフの `start=` に書く: `designing` なら `design`（先に `design-flow` 段 1a のとおり設計 Issue の seed を起票し、設計番号を渡す）、`preparing` なら `plan`、`working` なら `implement`。ブリーフの項目は worker 定義の「ブリーフ」節（skill `implement-flow` と `committing-and-opening-pr` の SKILL.md の絶対パス・インストール済みプラグインの agents ディレクトリ、設計・計画の段から始める回は `design-flow`・`prepare-flow` の SKILL.md の絶対パスと作業記憶の項目を含む）。作業ファイル 2 つのパスは渡さない（worker が自分の作業ツリーの `.shirokuma/tmp/` に置き、結果行で返す。`quality-gate.md` 4d-1 の「パスはメインが確定する」の例外）。agent ID を控える（SendMessage に使う）。

ブリーフに書いた後に worker の作業ツリーが消えないよう、worker は結果行の直前に目印のファイル（`.shirokuma-issue-run-keep`・未追跡で ignore されない）を置き、続きの最初に消す。設計・計画の段の後も同じ agent ID への SendMessage で続ける。

段の進め方（各段の状態遷移・停止境界は各 `*-flow` の段の順序のまま）:

1. **設計**（`start=design`）: `DESIGN_PUSHED` → 設計レビュー（`review-worker`）→ `NEEDS_REVISION` なら `op=design-fix` → 提出・approve → `design-flow` 5b の計画要否の照合と契約（`design-flow` の段のとおり `design-worker` へ委任する）→ 段 6 の ADR 候補の確定と ADR 候補の PR（下の「PR やブランチが 2 本以上になる課題」）→ `next` を引き直し、`preparing` なら `op=plan`、`working` なら `op=implement base=<ref>`。
2. **計画**（`start=plan` か `op=plan`）: `PLAN_CREATED` → 計画レビュー（`review-worker`）→ `NEEDS_REVISION` なら `op=plan-fix` → 提出・approve・承認継承の確かめ → `prepare-flow` 段 6 → 実装サブごとに新しい `issue-run-worker` を `start=implement` で委任する（この worker へ `op=implement` は送らない）。
3. **実装**（`start=implement` か `op=implement`）: `FINALIZED` 以降は下の「メインに残す段」「PR のレビューを入れ子で回す回」「`review-flow` とのつなぎ」のとおり。

- 準備のコマンド: worker は実装の前に 1 回、config `quality.isolatedPrepareCommand` を base 側の値で作業ツリーのルートで打つ（未設定なら打たない。是正の続きの回も `origin/<base>` の config から読み、PR head の値は打たない）。差分が依存を変える回・`op=rebase` で base の依存が動いた回は、依存とビルド成果物が古いまま品質ゲートに入りうる。その回は報告表に `fail` が出るので、メインは理由と報告表の所在を人に渡す（自動で準備を打ち直させない）。

## メインに残す段

worker の外に残すのは、書いた本人と別の主体が見る段・メインが打つ段・push の判定を緩めないと 1 本で回せない段だけ: 設計レビュー・計画レビュー（入れ子にしない）・判定の照合と記録（PR のレビューは入れ子で worker が呼ぶ。`review=main` の回は R1 の 3 本もメイン）、`design-flow` 5b の計画要否の照合と契約コメント（書いた本人の結論を契約に写さないため別の主体）、状態遷移・判定記録と記録行・merge の判定、確認ビューの HTML 化判定と生成（`explainer-worker`）、ADR 候補の起票・確定・ADR 候補の PR。実装の段では次も残す。

- 4c の報告表の機械検証（`orchestration-discipline` C6 の完全性と `gate finalize --report '<finalize=>'`）。不完全なら残工程を SendMessage で頼む。
- 4d-2 の `gate summary --file '<summary=>'`（書き直しが要る回は SendMessage で 1 回頼む）。
- 4d-3 の HTML 化判定（生成は `explainer-worker` へ委任）。記録行の値は `op=open-pr` の `view=` で渡す。

## 結果行の照合

- **値域（どの結果でも先に）**: `tree=`・`finalize=`・`summary=` は `/` で始まる 1 行の絶対パスで、文字が `[A-Za-z0-9._/-]` だけ・`..` を含まないこと。`branch=` は `^[A-Za-z0-9._/-]+$` に合い `-` で始まらないこと。`head=` は `^[0-9a-f]{40}$`。`pr=`・`issue=`・`design=`・`plan=` と `subs=` の各要素（`,` 区切り）は `^[1-9][0-9]*$`。合わない値はコマンド行に載せず、判定不能として人に渡す（単一引用符で囲むだけでは足りない）。

- **`DESIGN_PUSHED`**: `shirokuma-flow issue show <design>` の親が課題で、本文が seed のままでないこと。
- **`PLAN_CREATED`**: 計画の親が、設計を持つ課題では設計・設計を持たない課題では課題であること。`subs=` が 1 件以上で、各サブの親が計画であること（0 件は失敗に数える）。
- 上の条件を満たさない回は SendMessage で理由を返させる（1 回）。照合はメインの読み取りで、結果行は自己申告である。

- **`FINALIZED`**: ① `git worktree list --porcelain` に `tree=` が登録済みの worktree として在り、主リポの作業ツリーと違うこと ② `finalize=`・`summary=` が `<tree>/.shirokuma/tmp/finalize-<n>.md`・`impl-summary-<n>.md` と一致すること、を確かめてからメインに残す段を行う。満たさない回（一覧が 0 件・`tree=` が無い回を含む）はパスをコマンド行に載せず、読み替えず、SendMessage で理由を返させる。照合はメインの読み取りで、結果行は自己申告である。
- **`PR_CREATED` / `REVIEWED` / `FIXED`**: `shirokuma-flow pr show <pr>` の `head_oid` が結果行の `head` と一致し、`linked_issues` が閉じるはずの集合と集合として一致することを確かめる。閉じるはずの集合は `implement-flow` の SKILL.md の節 `### 段 5. コミット & PR` の項「`Closes` の書き方」が閉じるとする課題で、照合の直前にメインが自分で引く: `shirokuma-flow next <課題>` の `reason` が `plan_skipped_not_needed` なら、課題と `shirokuma-flow issue show <課題>` の `children` の全件（設計子。2 件以上でも全部）。それ以外（実装サブ・設計も計画も持たない課題など）はメインが委任した課題 1 件。集合を結果行から作らない（結果行の `issue` は委任した課題の番号と一致することだけを見る）。食い違えば（設計子が欠けた回を含む）記録も R1 の委任もせず理由を返させる（1 回）。`REVIEWED` の `files=`・`detectors=` の各要素は `tree=` と同じ値域で、`op=open-pr` で渡した `rec=` の配下であること。

## SendMessage の中身

固定形 1 通: `issue-run: op=<design-fix|plan|plan-fix|implement|open-pr|fix|commit|r1b-apply|rebase> round=<n> verdict=<判定行の値> files=<結果ファイルの絶対パス,…> comment=<コメントの所在> [carry-important=verbatim] [nit-candidates=merge] [base=<ref>] [view=<値>] [review=<nested|main>] [asset=<ok|skip>] [criteria=<パス|none>] [test-exec=<値|none>] [rec=<絶対パス>] [ref=<絶対パス>] [config=<絶対パス>] [stage=<報告段名>] [stage-file=<結果ファイルの絶対パス>] [human=<人の指摘>]`。

- `op=open-pr` には、メインが自分で引いた値を付ける: `review=`（既定 `nested`。下の「入れ子にしない回」は `main`）・`base=`・`asset=`（`review-gate.md`「3 本目の判定」の `gate token --kind criteria-path` の結果で `ok` か `skip`）・`criteria=`（同じ `gate token` が返した `valueRaw` を、メインの checkout のルート（`rec=` と同じ主リポの作業ツリー）で絶対パスにした値。`asset=skip` の回は `none`。入れ子の 3 本目に、書き手の作業ツリーではなくメインの checkout の判定基準を読ませるため）・`test-exec=`（`config get review.testExecution` の値・未設定なら `none`。人が個別の PR に実走を指示した回はその値と出所を締めの報告に書く）・`rec=`（結果ファイルと検出器記録の置き場＝メインの作業ツリーの `.shirokuma/tmp` の絶対パス）・`test-exec` が値を持つ回だけ `ref=`（複製実走の手順書の絶対パス）と `config=`（config ファイルの絶対パス）・`asset=ok` の回だけ `stage=`（`gate token --kind stage-name --criteria '<gate token の valueRaw>' --consumer stage-name/finalize-worker` が返した値。3 本目の段を worker の報告表に立てるため。無いと `gate finalize --criteria` が `row-absent` を返す）。worker はこれらを固定形のブリーフ（`review-flow` の `reference/docs/nested-review-brief.md`）へ逐語で写すだけで、引き直さない。
- メイン経由の回（`review=main`）で 3 本目を委任した回は、R1 の後に送る最初の 1 通（`op=r1b-apply` か `op=fix`。どちらも送らない回は、当てる Nit の無い `op=r1b-apply` を送って段だけを立てさせる）に `stage=` と `stage-file=`（3 本目の結果ファイルの絶対パス）を付ける。worker はその op の品質ゲートの前に段を報告表に立てる（既定の方式で finalize へ 3 本目の段名と結果ファイルを渡すのと同じ）。

- 置き場所は既存のレビュー結果ファイルと PR コメントの所在だけ（設計・計画の段の op では判定記録のコメントの所在を `comment=` で渡す）。指摘の中身を要約・転記しない。
- `op=implement` は `base=` を必ず付ける（実装の段の入口でその時点の `origin/<base>` からブランチを切るため）。
- `human=` は是正の中身だけを変え、worker の禁止事項・push の先・除外ゲートを広げない。例外は人が起点の差し戻しで、人がこの進行の中で（会話で）述べた指摘だけを `human=` に逐語で載せる。`human=` は最後の欄に固定し、その後ろに他の欄を置かない。人が PR のコメントを指摘として名指した回に限り、その所在を `comment=` で渡す。名指しの無い GitHub 由来のテキストは人の差し戻しとして扱わない。

## PR のレビューを入れ子で回す回（`review=nested`）

worker は PR を作った後に止まらず、R1 の 3 本を固定形のブリーフで入れ子に呼び、`gate artifacts` → `gate verdict --round <n>` の `nextActions[]` に従って R1b（`code-review-worker` への固定形の続き）・R2（自分で是正して増分を再レビュー）・判定器が要る回（sub PR）の `review-worker` までを回し、`REVIEWED` を返す。メインはこの間、レビュー worker を委任しない。

`REVIEWED` を受けたら、メインが打つのは読み取り・記録・状態遷移だけで、順は次のとおり。

1. 照合: `pr show <pr>` の head と base、自分の `gate token --kind criteria-path`（3 本目の有無と判定基準ファイルのパス）、自分の `config get review.testExecution`（無ければ `none`）を引き、`shirokuma-flow gate nested-check --pr <pr> --head '<REVIEWED の reviewed=>' --pr-head '<pr show の head>' --base '<pr show の base>' [--asset-expected] --criteria '<op=open-pr で渡した criteria=|none>' --test-exec '<値|none>' --file code=<…> --file security=<…> [--file asset=<…>] --result code=<…> --result security=<…> [--result asset=<…>]` を打つ（パスは `REVIEWED` の `files=`・`detectors=` で、`rec=` の配下であることを確かめた値。差し込む前に値域を確かめる）。`reviewed=` は書き手が返す値だが、照合が検出器記録と呼び出し記録にその head が在ることと、`pr show` の head の祖先であることを見る。出力の 8 つ（head・base・3 本目・判定基準ファイル・授権の行・巡の数・二次網・呼び出し記録）のどれかが合わない・exit が 0 でない回は記録せず、その PR を下の「入れ子にしない回」と同じメイン経由の形で R1 から回し直す（締めの報告に理由を書く）。
2. `gate artifacts`・`gate verdict` をメインの値で打ち直す: `--head` は 1 で照らした `reviewed=`（R1b で head が進んでいない回は `pr show` の head と同じ）、`--asset-expected` は自分の `gate token`、`--round` は 1 の出力の `derived.round`。worker の結果行の値は使わない。
3. 判定器を呼んだ回（sub PR）だけ、判定器の PR コメントを `pr comments` で読み、判定行（`PASS` / `NEEDS_REVISION`）を取って `--judged` に渡す。base が mainline の code の PR では `--judged` を付けない。
4. `gate finalize` / `gate summary`（報告表と実装サマリー）。
5. `pr record-verdict`・`pr record` の記録行 3 つ（`--worktree` は `tree=`）。`reviewed=` と `pr show` の head が違う回（R1b で Nit を当てて push した回）は、`review-gate.md`「判定記録（SKILL.md 段 2）の 2 つの sha が違う回」のとおり `--nit-files` を渡す。
6. 段 3 / 段 4 の遷移・5-1・5-2・merge の判定。

**判定 JSON の `build` ブロック（`sourceMatch` / `dirty` / `degraded`・欠落した回の読み方を含む）の読み方は `shirokuma-flow gate limits --sub limits` の `H19` が正本**（ここに写さない）。`stale` を名乗った回・`build` ブロックそのものが無い回は、その判定を現ソースの値として読まない。`stale` と `build.dirty: true` が同時に立つ回は、その判定を根拠に使わない。`build.dirty: null`（焼いていない）は、再現性の担保が無い側として `build.dirty: true` と同じに読む。

記録の後に指摘が残る回（人の差し戻し・判定の後の取り込み）は今どおり `op=fix` / `op=rebase` を送る。`op=fix` の後は worker が入れ子の再レビューへ続けてよく、`REVIEWED` を受けたら同じ 1〜6 を打つ。

**入れ子にしない回（`review=main`）**: 次の回は `op=open-pr` に `review=main` を付け、worker が `PR_CREATED` で止まった後に下の「`review-flow` とのつなぎ」の形でメインが R1 から回す。
- `test-exec` が値を持つ回（入れ子の `code-review-worker` が作業ツリーの外に隔離ツリーを作って複製実走できるかを確かめていない。通らなければ群 B の skip に倒れて検出が薄くなる）。
- worker が `PR_CREATED review=unavailable` か `REVIEWED review=unavailable` を返した回（入れ子の道具が無い・呼び出しが失敗した・hook が止めた・R1b の続きを送れない・二次網のサブタスクを起こせない）。`REVIEWED review=unavailable` の回は R1 から回し直す。以後のその PR の `op=fix` は `review=main`。締めの報告に書く。
- 1 の照合が合わなかった回。このときは R1 の前に、同じ worker へ `op=commit` を送る（`REVIEWED` の後の作業ツリーには目印のファイルが残っていて、`review-gate.md` の「`status --porcelain` が空」の確かめに当たるため。worker は続きの最初に目印を消し、変更が無ければ commit も push もせずに `FIXED` を返し、`FIXED` では目印を置かない）。`FIXED` の `head=` が `pr show` の head と一致することを確かめてから R1 を始める。
- 導入先が `shirokuma-hooks` を入れていない回（呼び出し記録が書かれないので、1 の照合が必ず止まる）。
- 導入先のプロジェクトの規範が入れ子にしない差分の型を定めている回。

入れ子の限界: 委任の主体が書き手の worker に移る。固定形と hook の guard（`gate limits` の項 `H30`）と 1 の照合（`gate limits --sub nested-check`）で補うが、照合が読む記録は書き手の手が届く場所にある（fail-open）。固定形は R2 の再委任の欄を運ばないので、入れ子の R2 の再レビューは全差分を母集団にする（`nested-review-brief.md`）。

## `review-flow` とのつなぎ

メイン経由で回す回（`review=main`）の形。`review-flow` の段の集合と `gate verdict` の `nextActions` はそのまま使う。**レビューの作業ツリーは結果行の `tree=`** で、`review-gate.md`「対象の確定」の `<head sha>` は `git -C '<tree>' rev-parse HEAD` で取る。worker は止まっている間に書かないので、R1 の 3 本が同じツリーを読んでも、R1b で Nit を当てても同時に 2 主体は書かない。置き換えるのは次の 4 か所。

| 既定の方式 | やり切り方式 |
|---|---|
| R2: `coding-worker` → `finalize-worker` → `commit-worker` | `op=fix`（`FINALIZED`）→ メインの 4c 検証 → `op=commit`（`FIXED`） |
| R1b の反映: `finalize-worker` → `commit-worker` | `op=r1b-apply`（`FINALIZED`）→ 報告表がすべて `pass` / `skip(理由)` の回だけ `op=commit`（`fail` があれば続きの `op=r1b-apply` で戻させる） |
| base を取り込む増分再レビューの前の取り込み | `op=rebase`（`FIXED`） |
| 人が起点の入口の連鎖 | R2 と同じ形。人の指摘は `op=fix` の `human=` に逐語で載せる |

増分の再レビュー・`--round`・ループ上限・`pr record-verdict`（`--worktree` は `tree=`）・記録行・動作確認・merge の判定は変えない。

- submodule: worker は実装の段の入口で `shirokuma-flow pages expand` を打ち、config `dependency.isolatedTreeSubmodules` の submodule を自分の作業ツリーへローカル clone で展開する。展開できた回は、`adr land`・差分で古くなった既存の specs ページと確認ビューの本文の更新・`pages push` も同じ worker が是正まで担う（確認ビューを作るか消すかの判定・生成・記録行はメインに残す）。展開できなかった回（報告表と実装サマリーに理由が残る）は、R1 の母集団で gitlink が `expanded:false` になる。メインはその回を「submodule 配下を読んでいないレビュー」として締めの報告で人に知らせ、展開してからの再レビューを頼むかを人に確認する。別の作業ツリーの既定の worker へ回すことを正規の手順にしない。
  - worker が展開した clone から `pages push` した commit は、人の作業ツリーの submodule（展開の取得元）に入らない。後段は worker の作業ツリーの clone から読む: 入れ子のレビューは worker の作業ツリーをそのまま読む。課題の続き・是正の続きとして新しい worker を委任する回は、ブリーフに前の worker の `tree=`（照合済みの値）を `prev-tree=` で書く（worker が `pages expand --source-tree` で展開する。ネットワークに出ない）。取得元を使えない回（`source-tree-*` の reasonCode）と merge の後の人の作業ツリーは、今どおり人が人の作業ツリーの submodule で運用ブランチを fetch するまで未展開になる（AI は人の作業ツリーで git を打たない）。

## PR やブランチが 2 本以上になる課題

push の判定（hook の rule `issue-run-push`・`gate limits` の項 `H29`）は 1 本の worker の push を課題のブランチ 1 本に限るので、2 本目以降の PR は worker の外で回す。

- **ADR 候補の PR**（設計か計画が ADR 候補を起こした回）: `issue-run-worker` は作らない。`design-flow` 段 6・`prepare-flow` 段 6 のとおりメインが既定の経路で委任し、その間 worker は止まっている（設計・計画の段では push もブランチもしていない）。取り込みの後に `op=plan` か `op=implement` を送る。
- **計画 NEEDED の課題**: worker は計画の起案（計画 Issue と実装サブの起票）までで終わる。計画の承認の後、実装サブごとに新しい `issue-run-worker` を `start=implement` で 1 本ずつ委任する（並列にするかは `orchestration-discipline` C14）。統合ブランチの作成と取り込み・統合ブランチから既定ブランチへの最終 PR は既定の経路のまま。

## 並列と merge の順

並列は `orchestration-discipline` C14 のとおり。同じ課題に 2 本の worker を同時に走らせない。merge は 1 本ずつで、2 本目は `op=rebase` で base を取り込ませ、増分を検査し直してから merge する。worker が稼働中に共有ツリーで `merge` を打たない（`merge` は cwd のツリーを切り替える）。

## 再開できない回（作業が始まった後）

SendMessage がエラーで返る・worker が `BLOCKED reason=resume-mismatch` を返す・セッションをまたいだ回。既定の方式へは戻さない。

- **設計・計画の段（`DESIGN_PUSHED` / `PLAN_CREATED` の後、実装の段の前）**: 成果は GitHub の本文にすべてあり、作業ツリーに未 push の変更は無い。課題を止めずに引き継ぐ。**`next` の `verdict` だけで `start=` を決めない**（レビュー中も `designing` / `preparing` のまま、提出の後は `gated` を返すので、起案からやり直して設計 seed・計画 Issue・実装サブを二重に起票しうる）。振り分けは段の成果の有無で行う:
  - 設計 Issue（計画の段なら計画 Issue）が既にある回は、seed も計画 Issue も起票し直さない。メインはその段の残り（レビュー・提出・approve・5b・段 6）を自分の手順のまま進め、worker が要る次の 1 通（`design-fix`・`plan-fix`・`plan`・`implement` のどれか）を送る時点で、新しい `issue-run-worker` を「課題 <n> の続き」として委任する。ブリーフに、その 1 通の中身と、ある成果の番号（設計番号・計画番号）と、前の worker の `tree=` が残っていれば `prev-tree=` を足す（worker 定義「課題の続きとして委任された回」）。`gated` の間は worker を委任しない（打つのはメインの状態遷移だけ）。
  - 成果がまだ無い回（seed を起票した直後に止まった回）だけ、上の「委任」のとおり `start=` で委任する。seed が既にあればその設計番号を渡し、もう 1 本起票しない。
  - 引き継いだことと引き継いだ段を締めの報告に書く。
- **実装の段の入口が `not-isolated` を返した回**（`op=implement` への返事）: 何も書かれていない。新しい `issue-run-worker` を `start=implement` で委任する（新しい作業ツリーは実行環境が作り、worker が分離の確かめの中で委任の時点の `origin/<base>` へ合わせてからブランチを切る）。その委任が `not-isolated` を返した回は、上の「既定の方式へ戻す」①のとおり実装から既定の方式で回す。
- **PR 作成の前（`FINALIZED` の後・`op=open-pr` の前）**: 変更は元の作業ツリーにしか無く push もされていない。AI は引き継がない。その課題を止め、元の `tree=`・`branch=` と「未 push の変更が残っている」ことを締めの報告で人に渡す（続けるか捨てるかは人が決める。やり直す回は、人が元のツリーを片付けた後に新しい `issue-run-worker` を最初から委任する）。
- **PR 作成の後（`PR_CREATED` / `REVIEWED` / `FIXED` の後）**: 新しい `issue-run-worker` に「PR <n> の是正の続き」として委任する。ブリーフに SendMessage の 1 通の中身と、前の worker の `tree=` を `prev-tree=` で（pages の取得元）、PR の head ブランチ名（`pr show` の `head`。差し込み前に `^[A-Za-z0-9._/-]+$`・`-` 始まりでない・base や保護ブランチでないことを確かめる）を足す。worker は別名のローカルブランチで続け、`HEAD:refs/heads/<head>` を force なしで push する（worker 定義）。どちらで回したかを記録に残す。その委任が `BLOCKED reason=not-isolated` を返した回は、下の「是正の続きが `not-isolated` を返した回」に従う。
- どの段でも `BLOCKED reason=push-denied-by-hook` が返った回は、下の「hook が push を止めた回」に従う。

## 是正の続きが `not-isolated` を返した回

元の worker は既に止まっていて、新しい worker は何も書いていない。メインは**最後に照合した結果行（`PR_CREATED` か `FIXED`）の `tree=`** を作業ツリーにして、その PR の残りの是正を既定の方式の R2（`coding-worker` → `finalize-worker` → `commit-worker`）で続ける。委任の前に、メインが読み取りだけで次をすべて確かめる。最初に `tree=` が上の「結果行の照合」の値域（`/` で始まる 1 行の絶対パスで、文字が `[A-Za-z0-9._/-]` だけ・`..` を含まない）に合うことを確かめ、合わなければコマンド行に載せず、判定不能として人に渡す（単一引用符で囲むだけでは足りない）。

- (a) `git worktree list --porcelain` に `tree=` が登録済みの worktree として在り、主リポの作業ツリーと違う。
- (b) `git -C '<tree>' symbolic-ref -q --short HEAD` が PR の head ブランチ名（`pr show` の `head`。差し込み前の値域検査は上の「PR 作成の後」と同じ）と一致する。
- (c) `git -C '<tree>' status --porcelain --untracked-files=all` が空。
- (d) `git -C '<tree>' rev-parse HEAD` が `pr show` の `head_oid` と一致する。

1 つでも満たさない回（`tree=` が撤去された・続きの回のローカル名 `<head>-cont-<k>` が checkout されている・未 commit の変更が残る・PR の head と食い違う）は自動で続けず、`tree=`・PR 番号・満たさなかった条件を締めの報告で人に渡す。満たした回は 3 worker のブリーフに作業ツリーとして `tree=` の絶対パスを渡し、途中から既定の方式へ移したことを締めの報告と PR の記録に書く。

## hook が push を止めた回

どの op でも worker が `BLOCKED reason=push-denied-by-hook` を返した回は、その課題を止め、拒否文・`tree=`・`branch=`・PR 番号（あれば）を締めの報告で人に渡す。実行環境の版か構成が判定の前提と合っていない印なので、メインが別の経路で push し直さない（判定の条件と限界は `gate limits` の項 `H29`）。

## 作業ツリーの後始末

配布物では撤去しない。変更の無かった作業ツリーは Claude Code が完了後に自動で消す（開発側で Claude Code 2.1.312 について確かめた範囲。版で変わりうる）。worker は段の終わりごとに目印のファイル `.shirokuma-issue-run-keep` を置くので、作業ツリーは課題を終えた後も残る（未追跡のファイルを変更に数えて残すかは確かめていない。消えた回は上の「再開できない回」に従う）。変更が残ったツリーは、merge の後（または既定の方式へ戻した後）に、残った `tree=` のパスとブランチ名を締めの報告で人に知らせる（撤去は人の判断）。設計・計画の段だけで終わった作業ツリー（計画 NEEDED の課題の worker）は ignore されたキャッシュだけを持ち、課題のブランチは無い。Claude Code がそれを変更の無いツリーとして自動で消すかは確かめていないので、残っていれば同じく `tree=` を人に知らせる。
