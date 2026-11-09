---
name: issue-run-flow
description: 作業セッションの入口。人がやり切り方式を指示した課題を、linked worktree で開いた作業セッションの main が issue-run-worker と同じ手順で自分で回す。人が /issue-run-flow に課題番号を付けて打ったとき、または管理セッションからの SendMessage が本 skill を名指して課題番号付きのやり切りを依頼したときだけ使う。会話で人がやり切りを指示しただけの回・依頼の無い場面では model が自分で起動しない（その回は implement-flow の reference/docs/issue-run.md の「方式の選び方」で担い手を選ぶ）。Use when 人が作業セッションで /issue-run-flow に課題番号を付けて打ったとき、または管理セッションから本 skill を名指した課題番号付きの SendMessage が届いたとき。
model: opus
---

# issue-run-flow（作業セッションの入口）

作業セッションの main が、課題自身が Backlog か Review の回のトリアージ（下の「トリアージの段」）と、`issue-run-worker` が担う範囲（設計の起案から PR の是正まで）を、止めて再開せずに自分で回す入口。手順の本文は持たない。本 skill に書くのは、main が手順書を読むときに違う点だけである。

**作業セッション**は、人が `claude -w` で開くか、導入先が固定の起動手段を用意した構成では管理セッションがその手段で開いた linked worktree の Claude Code のセッションで、1 つの課題について本 skill を起動したもの。**管理セッション**は、人が主リポの作業ツリーで開くセッションで、課題を選び、merge・後始末を行う（管理セッションを開くのは人だけ）。管理セッションが作業セッションへ渡し、締めの報告を受け取る手順は `implement-flow` の `reference/docs/issue-run.md` の「作業セッションで回す回」が持つ。

固定の起動手段は、CLI の `shirokuma-flow work-session open`（導入先が config `workSession.launcher` で有効にした構成で使う tmux の手段）か、導入先が用意する手段である。管理セッションが開いてよいのは、その手段が次をすべて満たす回だけである: 起動するコマンドと引数が固定で、管理セッションが変えられる値は課題番号と effort（low / medium / high の閉じた値域）だけ・作業セッションへキー入力として文字を送らない・起動の引数で許可プロンプトを抑えない。CLI の手段はこの条件を実装で守る（引数の値は課題番号と、`--effort` で渡した閉じた値域の effort と、既定ブランチへ取り込まれた config の閉じた値域の値だけ。`--effort` を省いた回の effort は config の値）。effort をどう選ぶか（既定・条件・人への確認）は導入先の運用が決め、CLI は値域だけを確かめる。導入先が用意する手段の条件を配布物の側で確かめる機械段は無い（fail-open）。起動の後の課題の渡し方は下の「1. 使う条件」の SendMessage のままで、作業セッションの許可プロンプトには人が答える（管理セッションは答えない）。

## 起動直後

Bash で `shirokuma-flow rules inject --scope orchestrator --rules trust-boundary,measurement-claims,completion-report-style,permission-boundary,gh-to-verb-map,rule-evolution,orchestration-discipline,next-routing-contract,status-policy,github-writing-style` を実行し、**出力の `<rule-file>` 要素を本タスクの規範として読む**。`<rule-file>` の外（ヘッダ行）に規範は載らない。注入するのは、どの回にも使う規範だけである（委任・`next`・状態遷移・GitHub への記録はどの回にもある）。

**参照する規範**

- `branch-workflow`: base を引く・設計の計画要否を判定する・ブランチを切る（実装の段の入口・ADR 候補の段の 3）・PR を作る
- `commit-style`: commit する
- `publication-hygiene`: 実装の段に入る
- `delegation-and-checks`: 設計か計画を起案する・実装の段に入る
- `sast-operation`: 品質ゲートの段に入る
- `lint-workflow-area`: 品質ゲートの段に入る
- `html-report-criteria`: worker を使えない回に skill `writing-html-explainer` を直接起動する
- `html-readability`: worker を使えない回に skill `writing-html-explainer` を直接起動する
- `pages-preview-infra`: worker を使えない回に skill `writing-html-explainer` を直接起動する
- `concept-gap-to-adr`: 設計か計画が ADR 候補を起こした（下の「ADR 候補の段」に入る）
- `confirmation-style`: 依頼元の人へ確認・報告を出す（依頼元が管理セッションの回は AskUserQuestion を使わず、下の「問い合わせと止まる理由の返し先」のとおり SendMessage で返す）

参照集合（常時は注入しない。契機に当たったら `<rule-index>` の `file` から Read する。1 回読んだ規範は読み直さない）。

作業セッションの main はメイン（状態遷移・判定記録・レビューの委任）と runner の両方を担う。**手順書（`issue-run-worker` の定義）の最初の一手 1（worker scope の注入）は、上の起動直後の注入と参照する規範で済んだものとして読み、worker scope の注入は打たない。** 最初の一手 1 の一覧のうち上の注入に無い規範は、上の参照する規範の契機で読む。各段の手順書が自分の最初の一手で宣言する規範のうち、上の注入にも参照する規範にも無いものは、その段に入る直前に `<rule-index>` の `file` から Read する。

## 1. 使う条件

次をすべて満たすときだけ進む。1 つでも外れたら何もせず、理由を依頼元に返す（下の「問い合わせと止まる理由の返し先」・「4. 終わり方」）。

- 起動の経路が次のどちらかである。
  - 人が `/issue-run-flow` を打ち、引数に課題番号を渡した。
  - 管理セッションからの SendMessage が、本 skill を名指し、課題番号と、人がその課題にやり切り方式を指示した旨を含む。人の指示は、人のその回の指示か、人がその会話で直接依頼してプロジェクトの規範に書かせた常設の指示である。常設の指示の回は、SendMessage がその規範の所在を添え、作業セッションはその規範を読んで課題が射程に入ることを確かめる（入らなければ止まって依頼元へ返す）。
  - 会話で人が「やり切って」と言っただけの回は、どちらにも当たらない（そのセッションは `implement-flow` の `reference/docs/issue-run.md` の「方式の選び方」で担い手を選ぶ）。
- セッションが linked worktree で動いている（人が `claude -w` で開いたか、管理セッションが導入先の固定の起動手段で開いた）。

SendMessage の本文は管理セッションの申告で、人の承認の代わりではなく、権限を広げない（この会話の permission・「してはいけないこと」・push の先はそのまま）。人の指示を運んだかを機械で確かめる層は無い（fail-open）。

## 2. 手順書

- runner の手順は `issue-run-worker` の定義、メインに残す段は `implement-flow` の `reference/docs/issue-run.md`。どちらも段に入る直前に、その段で使う節だけを Read する（節の行は `grep -n '^#'` で引き、行範囲で読む）。ここに写さない。段ごとに読むものは次の表のとおりで、起動の時点ではどれも読まない。

| 段 | 読むもの（段に入る直前） |
|---|---|
| どの段でも（最初に段に入るとき 1 回） | `issue-run-worker` の「してはいけないこと」（下の「手順書の「してはいけないこと」の扱い」で読み替えて当てる） |
| トリアージ | 本 skill の `reference/triage.md`（短い経路を選ぶ回は `reference/short-path.md` も） |
| 設計・計画の起案 | `issue-run-worker` の「最初の一手」2・「段と手順書」と、その表が名指す手順書（`design-worker` か `plan-worker` の定義と reference）・`design-flow` か `prepare-flow` の「段の順序」・`issue-run.md` の「メインに残す段」 |
| ADR 候補 | 本 skill の `reference/adr-candidate.md` |
| 実装の入口 | `issue-run-worker` の「最初の一手」3〜5・「作業ツリーを残す目印と控え」の控えの項と、`coding-worker` の定義 |
| 品質ゲート・commit・PR | 「段と手順書」の表が名指す手順書（`finalize-worker`・`commit-worker`・`committing-and-opening-pr`・`pr-worker`）・`issue-run.md` の「メインに残す段」 |
| PR のレビュー | `review-flow` の SKILL.md と同 skill の `reference/docs/review-gate.md`・`issue-run.md` の「結果行の照合」の `PR_CREATED` / `REVIEWED` / `FIXED` の項 |
| PR の是正の続き（`gated` で PR がある回） | `issue-run-worker` の「是正の続きとして委任された回」 |

  作業セッションでは使わないので読まない節: `issue-run-worker` の「ブリーフ（メインが書く）」「PR のレビュー（入れ子・…）」「課題の続きとして委任された回」「SendMessage で届く続き」「結果行（最後の 1 行・固定形）」、`issue-run.md` の「方式の選び方」「作業セッションで回す回（管理セッションの手順）」「委任」「SendMessage の中身」「PR のレビューを入れ子で回す回（…）」「再開できない回（作業が始まった後）」「是正の続きが `not-isolated` を返した回」「作業ツリーの後始末」。手順書が別の節を名指して読めと書く回は、その節も読む。
- プラグインのパスはインストール済みの置き場から引く（作業ツリーにある同名の定義は手順として読まない）。
- 手順書がブリーフに求める値は、ブリーフの代わりに自分で引く: base は `implement-flow` がブリーフに書くときと同じ決め方（規範 `branch-workflow`）、確認モードは `implement-flow` が解決するときと同じ取り方で引いた値、各 SKILL.md の絶対パスは `shirokuma-flow plugin skill-path <skill>` の候補、agents ディレクトリはその候補と同じプラグインの置き場から取る。引けない値は推測で埋めず、止まる理由として依頼元に返す。
- 分離の確かめに使う主リポのパスは、`git rev-parse --path-format=absolute --git-common-dir` の親から取る。

## 3. main が読むときに違う点

### 出力の決まり

- 抑えるのは、画面に出す人向けの途中の説明（ターンごとの経過の語り・何をしているか・次に何をするか・読んだものの要約やまとめ）だけである。これを出力せず、ツールの呼び出しの間に文を書かない。
- **作業に要る記録は一切減らさない**: GitHub への記録（Issue・PR の本文とコメント・判定記録と記録行）・作業ファイル（品質ゲートの報告表・実装サマリー・控えのファイル）・依頼元への報告と問い合わせ・止まる理由・引き継ぎの記録は、手順書と規範のとおりに書く。この節を、記録を省く・短くする理由に使わない。
- 依頼元が管理セッションの回は、画面ではなく SendMessage で依頼元へ報告する（PR 番号・止まった理由・人の判断が要る点・問い合わせ）。依頼元が人の回（人が `/issue-run-flow` を打った回）は、締めの報告と問い合わせを人に出す。
- 考える言語は問わない（英語でよい）。GitHub への記録（Issue・PR の本文とコメント）と依頼元への報告は、そのリポの記録の言語のまま書く。
- 倒れる向き: 守らせる機械段は無い（fail-open）。途中の説明を出した回は文脈が増えるだけで、判定や記録は変わらない。

### 出力の受け方

大きな出力をそのまま文脈へ入れない。次のとおり、要るところだけを受ける。

- **判定 verb の JSON**（`next`・`issue show`・`pr show`・`pr checks`・`gate` の各サブコマンド・`plugin skill-path` など）は、`jq` のパス式で要る欄だけを取り出す（例: `shirokuma-flow plugin skill-path <skill> | jq -r '.candidates[0].path'`）。手順書と規範が読むと書いている欄は落とさない（`next`・`pr checks` は `ok`・`verdict`・`reason`・`nextActions`・`limits`・`build`。`gate verdict` は `fields`・`nextActions`。`gate short-path` は判定値と手順書が読む `result` の欄）。`jq` に渡すのは欄を選ぶパス式だけで、変換の処理を書かない。`jq` が無い環境では全文を読む（量が増える側に倒れる）。
- **`gate vocab`** は `--field <欄 id>` か `--profile <名前>` で引き、要る欄の値だけを読む。
- **検査**（テスト・lint・品質ゲートのコマンド）は、出力を作業ツリーの外のファイルへ書き、終了コードと要約の行（件数・失敗の名前）だけを読む。終了コードはパイプで失わない形で取る。失敗した回だけ、失敗の箇所をファイルから読む。
- **差分**は名前の一覧（`pr diff <n> --name-only`・`git diff --stat`）から入り、要るファイルだけ中身を見る。
- **実行環境が大きな出力をファイルへ退避した回**は、全文を Read せず、検索か行範囲で要るところだけ読む。例外は起動直後と参照する規範の注入の出力で、`<rule-file>` を全文読む。
- 倒れる向き: 欄を落として判定を読み違えるのを止める機械段は無い（fail-open）。迷ったら全文を読む。

### 始め方

ブリーフは来ない。課題番号は起動の引数か SendMessage の本文から取り、始める段は `shirokuma-flow next <課題>` の `verdict` で決める。値域は `next` が実際に返すもの（`shirokuma-flow gate vocab` の `next` の値域）だけを扱う。

| `verdict` | 行き先 |
|---|---|
| `designing` | 課題の子に設計 Issue が在れば、起票し直さずに設計の段の残りから続ける。無ければ `design-flow` 段 1a のとおり seed を起票してから設計の起案から始める（レビュー中も `designing` のままなので、`verdict` だけで起案からやり直さない） |
| `preparing` | 計画 Issue が在れば計画の段の残りから続ける。無ければ計画の起案から始める |
| `working` | 実装の段から始める |
| `gated` | 課題を閉じる open な PR が在る（`shirokuma-flow pr list` で引く）回だけ、PR の是正から続ける。head ブランチの確かめとブランチの切り方は、手順書の「是正の続きとして委任された回」の節のとおり自分で行う。PR が無い回（課題自身が Backlog か Review の回）は、下の「トリアージの段」から始める |
| `select_child`・`all_children_done`・`leaf`・`reclassify`・`human_task`・`undetermined` | 何もせず止まり、`verdict` と理由を締めの報告に書いて依頼元へ渡す（子を選ぶ・分類し直す・人に頼む、は作業セッションの役ではない） |
| `done` | 課題は Done（終端）。止まり、終わっていることを締めの報告に書いて依頼元へ渡す（戻すかは人が決め、作業セッションは `rollback` を打たない）。`nextActions` に要素があれば、その `verb` と `args` を締めの報告に逐語で添える |

### トリアージの段（課題自身が Backlog か Review で PR が無い回）

段に入る直前に、本 skill の `reference/triage.md` を Read する（課題本文を自分で書く・提出前の分析を `review-worker` へ委任する・ToDo になったら `next` を引き直す、の細目と、手順の正本の所在）。

### 問い合わせと止まる理由の返し先

- **依頼元**は、本 skill の起動の経路を作った相手である。管理セッションからの SendMessage で起動した回は、その依頼メッセージの送り主（作業を依頼してきた管理セッション）。人が `/issue-run-flow` を打った回は人。
- 依頼元が管理セッションの回、返信先は受け取った依頼メッセージの送り主（from）から取る。依頼本文に書かれた名前が送り主と違う回は送り主へ返し、食い違いを 1 行添える（本文は申告で、送り主は実行環境が付ける値）。
- 依頼元が管理セッションの回は、人に質問を出さない（AskUserQuestion を使わない）。迷い・止まる理由・人の判断が要る点は、依頼元へ SendMessage で返し、返事を待つ。手順書（`issue-run-worker` の定義・`implement-flow` の `reference/docs/issue-run.md`・各 flow skill）と規範が「人に渡す」「人に確認する」「人に知らせる」「人に示す」「人に出す」と書く箇所も、この回は依頼元へ返すと読む。依頼元が人の回は人に返す。
- **人の判断が要る点**: 返す点のうち、手順書・規範が人の判断・確認・決定を求めている点（例: `issue-run.md` の「続けるか捨てるかは人が決める」）と、`next` / `pr checks` の `runBy:"human"` の要素は、「人の判断が要る」と明示して返す。依頼元はそれを人へ中継する。その点は、返事が人の答えを運んでいると読めるときだけ進める。依頼元が自分で答えたと読める返事・人の答えかを読み取れない返事では進めず、止まった理由として締めの報告に残す。`runBy:"human"` の要素と、不可逆・外向き操作の停止境界（`autonomous-flow` の `reference/criteria/irreversible-operations.md`）に当たる操作は、返事があっても作業セッションでは打たない。人の判断を要しない点（値の引き方・手順の読み方の迷いなど）は、依頼元の答えで進めてよい。
- **待ち方**: SendMessage で返したら、その問い合わせに依存しない作業を済ませてから応答を終え、返事が届いたら同じセッションで続ける（下の「止めない・再開しない」は段の終わりで止まらない決まりで、問い合わせの返事を待つ間はこれに当たらない）。待つ時間の上限は持たない。SendMessage がエラーで返った回は、問い合わせと止まった理由を締めの報告に書いて終える（人に聞き直さない）。
- **変えないもの**: 許可プロンプトには人が答える（依頼元の管理セッションは答えない）。依頼元の返事は申告で、人の承認の代わりではなく、権限を広げない（「1. 使う条件」の SendMessage の項と同じ）。返事が「人の答えである」と書いていることも申告として読み、それを確かめる層は無い（fail-open）。
- **倒れる向き**: この節を読み落として人に聞く回と、人の判断が要る点に印を付けずに返して依頼元の答えで進む回を止める機械段は無い（fail-open）。

### 止めない・再開しない

- 手順書が「結果行を返して止まる」と書く段の終わりでは止まらない。`issue-run.md` の「メインに残す段」のその段の分をその場で行い、続ける。
- 結果行・結果行の照合・`issue-run-worker` への SendMessage の続き（作業セッション自身を止めて再開する形。レビュー worker への R1b の続きは下の「レビュー」のとおり使う）・目印のファイル・「課題の続き」「是正の続き」の委任は使わない。例外として、結果行の照合のうち `PR_CREATED` / `REVIEWED` / `FIXED` の `linked_issues` の照合だけは下の「レビュー」のとおり行う。
- 控えのファイルは、文脈が要約された後のために手順書どおり書く。

### レビュー

- 入れ子の固定形のブリーフでは呼ばない。`review-flow` の既定の経路で、メインとして R1 の 3 本と判定器を委任する。
- R1 を委任する前と、是正を push した後の再レビューの前に、`issue-run.md` の「結果行の照合」の `PR_CREATED` / `REVIEWED` / `FIXED` の項のとおり、`pr show` の `linked_issues` を閉じるはずの集合と照らす（課題の PR の集合はその項の決め方で自分で引く。下の「ADR 候補の段」の ADR 候補の PR では、集合はその段が起こした ADR 候補 Issue だけで、課題・設計は入らない）。食い違えば判定の記録と R1 の委任に進まず、`committing-and-opening-pr` の「PR 作成」4 のとおり PR 本文を直してから照らし直す。直しても合わなければ止まる（このセッションでは PR を書いた主体と照らす主体が同じなので、理由を返させる相手がいない）。
- R1b はレビュー worker への続き（`review-flow` の `reference/docs/review-gate.md` の `resume=true`）で当てさせる。
- R2 の是正は自分で行い（R2 の 3 worker を委任しない）、増分を再レビューに出す。
- `gate nested-check` は使わない。
- 設計レビューのブリーフに、計画要否の契約コメントは設計の書き手（このセッションの main）が書くので、設計本文の計画要否の判定を必ず見る（`design-flow` の判定基準の計画要否の宣言の項）と書く。

### 短い経路（文書だけ・コメントだけ・テストの期待値の置き換えだけを変える課題）

提出前の分析と R1 の 3 本を省いた短い経路を選ぶ回（文書だけ・コメントだけ・テストの期待値の置き換えだけを変える課題）は、トリアージの段で本 skill の `reference/short-path.md` を Read してその手順で通す（入れないもの・入り方・判定・差分の目視・量・判定記録・戻し方）。迷えば通常の経路。

### 自分で打つもの・委任するもの

自分で打つ・書く: 状態遷移（`flow` verb）・判定記録と記録行（`pr record-verdict`・`pr record`）・`gate finalize` / `gate summary`・確認ビューの HTML 化判定・計画要否の契約コメント（設計本文の計画要否の値と設計レビューの判定記録の値の照合も自分で行う。値の決め方と書いた後の `next` の引き直しは `design-flow` の段 5b のまま）。

判定記録と記録行は、差分と結果ファイルを読んだ書き手の本人が打つことになり、打つ主体の分離が無くなる。打つか打たないか・どの値を打つかを自分の読みで決めず、`gate verdict` が返した値をそのまま写す。計画要否の契約コメントも設計の書き手の本人が書くことになり、甘く `NOT_NEEDED` を書くと計画が飛ぶ側に倒れる（受けるのは設計レビュー・fail-open）。作業セッションであることも AI の自己申告で名乗れる（機械で確かめる層は無い）ので、「1. 使う条件」を満たさない回にこれらの形で打たない・書かない（その回の契約コメントは `design-flow` の段 5b のとおり別の worker へ委任する）。

**判定 JSON の `build` ブロック（`sourceMatch` / `dirty` / `degraded`・欠落した回の読み方を含む）の読み方は `shirokuma-flow gate limits --sub limits` の `H19` が正本**（ここに写さない）。`stale` を名乗った回・`build` ブロックそのものが無い回は、その判定を現ソースの値として読まない。`stale` と `build.dirty: true` が同時に立つ回は、その判定を根拠に使わない。`build.dirty: null`（焼いていない）は、再現性の担保が無い側として `build.dirty: true` と同じに読む。

別の worker へ委任する: レビュー（トリアージの段の要件の分析・設計・計画・PR・ADR 候補の title と本文の整合。文脈に引きずられない判定のため）・確認ビューの生成（文脈を要さず、出力が重くこのセッションの文脈を圧迫するため。記録行と `pages push` を含めて `explainer-worker` へ委任する）。

**worker を使えない回の確認ビュー**: Agent ツールが無い・`explainer-worker` が agent の一覧に無い・worker が起動しなかったか起動がエラーで返った（hook が止めた・tools が解決しない）回に限り、本 skill の `reference/explainer-fallback.md` を Read して、skill `writing-html-explainer` を直接起動してよい。worker が起動して値や止まる理由を返した回と、遅い・手間・結果が不満な回は当たらない。

### ADR 候補の段（設計か計画が ADR 候補を起こした回）

設計か計画が ADR 候補を起こした回は、決定の段（設計。設計を持たない課題では計画）の承認と計画要否の契約の後、次の段へ進む前に、本 skill の `reference/adr-candidate.md` を Read してその手順で扱う（ADR 候補の起票・起草・整合のレビューの委任・ADR 候補のブランチ・確定の打ち手・ADR 候補の PR・merge を頼んで止まる・課題の次の段へ戻る）。

### 手順書の「してはいけないこと」の扱い

- 外れる: 上の「自分で打つ」に当たる禁止と、入れ子にだけ掛かる禁止（固定形のブリーフ以外での委任・4 本以外の委任・R1b の続きの固定形・`gate token` / `config get` の引き直し・`gate nested-check`・`rec=` の置き場の禁止）。
- 名指す書き込み（「名指されていない GitHub への書き込み」に当たらないもの）: 計画要否の契約コメント（課題へ 1 件）・worker を使えない回の確認ビューの記録行（対象の Issue / PR 本文）と `pages push`。上の「トリアージの段」の回は次も: 課題本文の書き戻し（`issue context` → `issue push`）・題名の `issue retitle`・IssueType の `issue retype`。上の「ADR 候補の段」の回は次も: ADR 候補 Issue の起票と候補本文の書き戻し（`issue context` → `issue push`）・ADR 候補のブランチへの commit / push と ADR 候補の PR の作成と本文・確定した ADR 正本と対応表の `pages push`・緩める側の候補を授権で確定した回の監査コメント（`autonomous-flow` の `reference/criteria/irreversible-operations.md` の「監査」節）・人がその場で特定の候補を自分で確定すると指示した回の候補 Issue への 1 行。
- 残る: merge（課題の PR と ADR 候補の PR）・作業ツリーの外への書き込み・名指されていない GitHub への書き込み・動作確認での実 GitHub への書き込み・worker を使える回に確認ビューを自分で生成すること・force push・`git branch -D`・作業ツリーの撤去・レビュー worker の結果ファイルと記録の書き換え。

### push の判定

作業セッションの main には agent の種別が無いので、hook の rule `issue-run-push`（宛先を課題のブランチ 1 本に縛る判定）は掛からない。ほかの push の rule は掛かる。宛先は課題のブランチと、その課題の設計か計画が起こした ADR 候補のブランチ（`branch name <候補#>`）の 2 本だけで、それ以外へ push しないことは自分で守る（fail-open）。

## 4. 終わり方

次のどれかで終える。

1. PR のレビューの判定を記録し、段 4 の遷移まで打った（merge の判定と merge は管理セッションで、主リポの作業ツリーで行う。merge の verb は cwd のツリーを切り替える）。
2. ADR 候補の PR のレビューの判定を記録し、遷移まで打った（merge は管理セッションか人が行う。依頼元へ PR 番号と merge の依頼を返す。取り込まれたと知らされたら同じセッションで本 skill の `reference/adr-candidate.md` の 8 から続け、セッションを閉じた回は新しい作業セッションが `next` から続ける）。
3. 計画 NEEDED の計画が承認された（実装サブは 1 本ずつ、それぞれの作業セッションで起動する）。
4. 止まる理由が出た（ADR 候補の確定の要素が `runBy:"human"` だった回を含む。その要素の `verb` と `args` を逐語で締めの報告に書く）。

- 締めの報告には、課題番号・PR 番号・作業セッションのツリーのパスと、依頼元が行うこと（merge・作業ツリーの撤去・人の判断が要る点）を書く。
- 依頼元が管理セッションの回は、どの終わり方でも（「1. 使う条件」で外れて何もしない回・「2. 手順書」の引けない値で止まる回・「始め方」の表で止まる `verdict` の回を含む）、締めの報告の要点（PR 番号か、止まった理由と `verdict`）を依頼元へ SendMessage で 1 行返す。返さないと、管理セッションの待ちが終わらない。
- 作業セッションのツリーは作業セッション自身では撤去しない（撤去は merge の後に管理セッションが `shirokuma-flow work-session close` で行うか、人が行う）。
- 作業セッションが動いている課題に、管理セッションから遷移や委任を重ねない。
