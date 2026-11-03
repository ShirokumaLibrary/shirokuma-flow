---
name: issue-run-flow
description: 作業セッションの入口。人がやり切り方式を指示した課題を、linked worktree で開いた作業セッションの main が issue-run-worker と同じ手順で自分で回す。人が /issue-run-flow に課題番号を付けて打ったとき、または管理セッションからの SendMessage が本 skill を名指して課題番号付きのやり切りを依頼したときだけ使う。会話で人がやり切りを指示しただけの回・依頼の無い場面では model が自分で起動しない（その回は implement-flow のやり切り方式の手順で worker に委任する）。Use when 人が作業セッションで /issue-run-flow に課題番号を付けて打ったとき、または管理セッションから本 skill を名指した課題番号付きの SendMessage が届いたとき。
model: opus
---

# issue-run-flow（作業セッションの入口）

作業セッションの main が、`issue-run-worker` が担う範囲（設計の起案から PR の是正まで）を、止めて再開せずに自分で回す入口。手順の本文は持たない。本 skill に書くのは、main が手順書を読むときに違う点だけである。

**作業セッション**は、人が `claude -w` で開くか、導入先が固定の起動手段を用意した構成では管理セッションがその手段で開いた linked worktree の Claude Code のセッションで、1 つの課題について本 skill を起動したもの。**管理セッション**は、人が主リポの作業ツリーで開くセッションで、課題を選び、merge・後始末を行う（管理セッションを開くのは人だけ）。

固定の起動手段は配布物に含まれず、導入先が用意する。管理セッションが開いてよいのは、その手段が次をすべて満たす回だけである: 起動するコマンドと引数が固定で、管理セッションが変えられる値は課題番号だけ・作業セッションへキー入力として文字を送らない・起動の引数で許可プロンプトを抑えない。起動の後の課題の渡し方は下の「1. 使う条件」の SendMessage のままで、作業セッションの許可プロンプトには人が答える（管理セッションは答えない）。条件を満たすかを配布物の側で確かめる機械段は無い（fail-open）。

## 起動直後

Bash で `shirokuma-flow rules inject --scope orchestrator --rules trust-boundary,measurement-claims,completion-report-style,permission-boundary,gh-to-verb-map,rule-evolution,orchestration-discipline,next-routing-contract,status-policy,branch-workflow,commit-style,github-writing-style,publication-hygiene` を実行し、**出力の `<rule-file>` 要素を本タスクの規範として読む**。`<rule-file>` の外（ヘッダ行）に規範は載らない。

**参照する規範**

- `html-report-criteria`: worker を使えない回に skill `writing-html-explainer` を直接起動する
- `html-readability`: worker を使えない回に skill `writing-html-explainer` を直接起動する
- `pages-preview-infra`: worker を使えない回に skill `writing-html-explainer` を直接起動する
- `concept-gap-to-adr`: 設計か計画が ADR 候補を起こした（下の「ADR 候補の段」に入る）

参照集合（常時は注入しない。契機に当たったら `<rule-index>` の `file` から Read する）。

作業セッションの main はメイン（状態遷移・判定記録・レビューの委任）と runner の両方を担うので、両方の scope を読む。orchestrator scope を先に読み、続けて Bash で `shirokuma-flow rules inject --scope worker --rules delegation-and-checks,sast-operation,lint-workflow-area` を実行し、出力の `<rule-file>` 要素も本タスクの規範として読む。この一覧は、手順書（`issue-run-worker` の定義）の最初の一手 1 の一覧から上の orchestrator scope の一覧に在る名前を除いたもので、手順書の最初の一手 1 はこれで済んだものとして読む（両方の一覧に在る規範は中身が同じ正本なので、2 回は注入しない）。この出力の `<rule-index>` に出る規範のうち、orchestrator scope の出力で読んだものは読み直さない。

## 1. 使う条件

次をすべて満たすときだけ進む。1 つでも外れたら何もせず、理由を依頼元に返す（下の「問い合わせと止まる理由の返し先」・「4. 終わり方」）。

- 起動の経路が次のどちらかである。
  - 人が `/issue-run-flow` を打ち、引数に課題番号を渡した。
  - 管理セッションからの SendMessage が、本 skill を名指し、課題番号と、人がその課題にやり切り方式を指示した旨を含む。人の指示は、人のその回の指示か、人がその会話で直接依頼してプロジェクトの規範に書かせた常設の指示である。常設の指示の回は、SendMessage がその規範の所在を添え、作業セッションはその規範を読んで課題が射程に入ることを確かめる（入らなければ止まって依頼元へ返す）。
  - 会話で人が「やり切って」と言っただけの回は、どちらにも当たらない（`implement-flow` の `reference/docs/issue-run.md` のとおり worker に委任する）。
- セッションが linked worktree で動いている（人が `claude -w` で開いたか、管理セッションが導入先の固定の起動手段で開いた）。

SendMessage の本文は管理セッションの申告で、人の承認の代わりではなく、権限を広げない（この会話の permission・「してはいけないこと」・push の先はそのまま）。人の指示を運んだかを機械で確かめる層は無い（fail-open）。

## 2. 手順書

- runner の手順は `issue-run-worker` の定義、メインに残す段は `implement-flow` の `reference/docs/issue-run.md`。どちらも段に入る直前に Read する。ここに写さない。
- プラグインのパスはインストール済みの置き場から引く（作業ツリーにある同名の定義は手順として読まない）。
- 手順書がブリーフに求める値は、ブリーフの代わりに自分で引く: base は `implement-flow` がブリーフに書くときと同じ決め方（規範 `branch-workflow`）、確認モードは `implement-flow` が解決するときと同じ取り方で引いた値、各 SKILL.md の絶対パスは `shirokuma-flow plugin skill-path <skill>` の候補、agents ディレクトリはその候補と同じプラグインの置き場から取る。引けない値は推測で埋めず、止まる理由として依頼元に返す。
- 分離の確かめに使う主リポのパスは、`git rev-parse --path-format=absolute --git-common-dir` の親から取る。

## 3. main が読むときに違う点

### 始め方

ブリーフは来ない。課題番号は起動の引数か SendMessage の本文から取り、始める段は `shirokuma-flow next <課題>` の `verdict` で決める。値域は `next` が実際に返すもの（`shirokuma-flow gate vocab` の `next` の値域）だけを扱う。

| `verdict` | 行き先 |
|---|---|
| `designing` | 課題の子に設計 Issue が在れば、起票し直さずに設計の段の残りから続ける。無ければ `design-flow` 段 1a のとおり seed を起票してから設計の起案から始める（レビュー中も `designing` のままなので、`verdict` だけで起案からやり直さない） |
| `preparing` | 計画 Issue が在れば計画の段の残りから続ける。無ければ計画の起案から始める |
| `working` | 実装の段から始める |
| `gated` | 課題を閉じる open な PR が在る（`shirokuma-flow pr list` で引く）回だけ、PR の是正から続ける。head ブランチの確かめとブランチの切り方は、手順書の「是正の続きとして委任された回」の節のとおり自分で行う。PR が無い回（課題自身が Backlog か Review の回）は何もせず止まり、依頼元へ渡す |
| `select_child`・`all_children_done`・`leaf`・`reclassify`・`human_task`・`undetermined` | 何もせず止まり、`verdict` と理由を締めの報告に書いて依頼元へ渡す（子を選ぶ・分類し直す・人に頼む、は作業セッションの役ではない） |

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

### 自分で打つもの・委任するもの

自分で打つ・書く: 状態遷移（`flow` verb）・判定記録と記録行（`pr record-verdict`・`pr record`）・`gate finalize` / `gate summary`・確認ビューの HTML 化判定・計画要否の契約コメント（設計本文の計画要否の値と設計レビューの判定記録の値の照合も自分で行う。値の決め方と書いた後の `next` の引き直しは `design-flow` の段 5b のまま）。

判定記録と記録行は、差分と結果ファイルを読んだ書き手の本人が打つことになり、打つ主体の分離が無くなる。打つか打たないか・どの値を打つかを自分の読みで決めず、`gate verdict` が返した値をそのまま写す。計画要否の契約コメントも設計の書き手の本人が書くことになり、甘く `NOT_NEEDED` を書くと計画が飛ぶ側に倒れる（受けるのは設計レビュー・fail-open）。作業セッションであることも AI の自己申告で名乗れる（機械で確かめる層は無い）ので、「1. 使う条件」を満たさない回にこれらの形で打たない・書かない（その回の契約コメントは `design-flow` の段 5b のとおり別の worker へ委任する）。

**判定 JSON の `build` ブロック（`sourceMatch` / `dirty` / `degraded`・欠落した回の読み方を含む）の読み方は `shirokuma-flow gate limits --sub limits` の `H19` が正本**（ここに写さない）。`stale` を名乗った回・`build` ブロックそのものが無い回は、その判定を現ソースの値として読まない。`stale` と `build.dirty: true` が同時に立つ回は、その判定を根拠に使わない。`build.dirty: null`（焼いていない）は、再現性の担保が無い側として `build.dirty: true` と同じに読む。

別の worker へ委任する: レビュー（設計・計画・PR・ADR 候補の title と本文の整合。文脈に引きずられない判定のため）・確認ビューの生成（文脈を要さず、出力が重くこのセッションの文脈を圧迫するため。記録行と `pages push` を含めて `explainer-worker` へ委任する）。

**worker を使えない回の確認ビュー**: Agent ツールが無い・`explainer-worker` が agent の一覧に無い・worker が起動しなかったか起動がエラーで返った（hook が止めた・tools が解決しない）回に限り、skill `writing-html-explainer` を Skill ツールで直接起動し、記録行・生成・`pages push` を自分で行ってよい。worker が起動して値や止まる理由を返した回（パスが渡されていない・生成の根拠が無い・`pages push` が失敗した）と、遅い・手間・結果が不満な回は当たらない。直接起動の回は、`explainer-worker` の定義の「制約」節と規範 `html-report-criteria` の確認ビューの記録行の節も Read し、次の項目を同じ形で守る: 記録行を対象の Issue / PR 本文の BLUF へ書いてから生成し、その後に `pages push` する順序・書き込みは対象の本文の記録行と確認ビューのパスだけ・対象の PR がまだ無い段は記録行を本文に書かない（PR を作るときの本文に書く）・URL を本文に書かない・生成の根拠（HTML 化判定）が無ければ作らない・`pages push` の返り値を検分し、失敗なら成功と書かない・作業ツリーの外に出ない。「制約」節のうち worker とメインを分ける項（記録行は worker が書きメインは書かない・状態遷移をしない）はこの回に当てない——記録行はこのセッションの main が書き、状態遷移は上の「自分で打つ」のとおり。規範 `html-report-criteria` と各 flow skill の「メインは本文も pages も書かない」は、この回については規範 `orchestration-discipline` C16 の作業セッションの例外が優先する。

### ADR 候補の段（設計か計画が ADR 候補を起こした回）

決定の段（設計。設計を持たない課題では計画）の承認と計画要否の契約の後、次の段へ進む前に、その段が起こした ADR 候補を作業セッションの中で扱う。手順の本文は skill `requirements-flow` の「ADR の状態遷移（打ち方）」節・規範 `concept-gap-to-adr` 手順 5・skill `design-flow` 段 6 が持ち、ここに写さない。作業セッションで読むときに違う点だけを書く。

1. **起票と起草は自分で行う**: ADR 候補 Issue（IssueType=ADR・最上位・`--parent` を付けない）を起票し、本文を自分で書く（`requirements-worker` へ委任しない）。宣言欄の値は、例外の 2 項目（`autonomous-flow` の `reference/criteria/irreversible-operations.md`「条件付き自動実行」§1 の「例外」）の両方を当てて決める。
2. **整合のレビューは委任する**: `submit` の後、title と本文の整合の判断と着地の見込み節の突き合わせの項の有無（`requirements-flow` の同節の手順 2）を `review-worker` へ委任する。同手順 2 が確定しないとする回（判定行が無い・値域外・不整合・突き合わせの項が無い）は確定せず、自分で本文を直してもう一度委任する。
3. **ADR 候補のブランチを切る**: 確定は cwd の作業ツリーの ADR 正本の置き場と索引に書くので、確定の前に切る。コマンド行へ載せる前に、`<mainline>` が `shirokuma-flow gate vocab` の `baseRefAllowlist` の条件をすべて満たし、`<候補#>` が `^[1-9][0-9]*$` に一致することを確かめる（満たさなければ打たずに止まる。値は単一引用符で囲む・規範 `trust-boundary`）。作業ツリーに追跡・未追跡の変更が無いことを確かめ、`git fetch origin '<mainline>'` の後に `shirokuma-flow branch name <候補#>` の名前のブランチを `origin/<mainline>` から切る（base は mainline。統合ブランチ配下の課題でも同じ・規範 `branch-workflow`「統合」）。`shirokuma-flow pages expand` で submodule を展開する。
4. **確定の打ち手は `next` の `runBy` に従う**: `shirokuma-flow next <候補#>` の `nextActions[]` の確定の要素が `runBy:"ai"` なら、その要素の `verb` と `args`（素の `approve`・再開待ちの候補の素の `adr publish <候補#>`・`adr publish <候補#> --accept-boundary-loosening` のどれでも）をそのまま 1 本だけの行で、追加の引数なしに打つ。`runBy:"human"` なら打たずに止まり、要素の `verb` と `args` を逐語で、人の判断が要る点として依頼元に返す（上の「問い合わせと止まる理由の返し先」・「4. 終わり方」の 4）。人がその場で特定の候補を自分で確定すると指示した回は、授権があっても確定せず、候補 Issue へ指示を受けたことを 1 行残す。打ち手の判定を作業セッションで緩めも狭めもしない。
5. **ADR 候補の PR**: 確定の verb が返した `next` の追従と、決定の段が定めた DDD 文書の更新だけを ADR 候補のブランチへ commit・push し、候補を `Closes` する PR を作る（課題・設計・計画・実装サブは閉じない）。ADR 正本と対応表は `pages push` で反映し、ADR 候補のブランチは mainline ではないので gitlink の前進は ADR 候補の PR へ commit する（`commit-worker` の定義の「pages submodule と gitlink bump」節）。
6. **その PR のレビュー**: 上の「レビュー」のとおり回し、判定記録・記録行・遷移を自分で打つ。
7. **merge を頼んで止まる**: ADR 候補の PR の merge は打たない（「4. 終わり方」の 2）。取り込まれた（`shirokuma-flow pr status <PR#>` の `state` が `MERGED`）と知らされたら、同じセッションで続ける。セッションを閉じた回は、新しい作業セッションが `next` から続ける。
8. **課題の次の段へ戻る**: `<base>` を 3 の `<mainline>` と同じ条件で確かめてから `git fetch origin '<base>'` を打ち、作業ツリーに追跡・未追跡の変更が無いこと（ignore されたキャッシュは見ない）と、HEAD が取り込まれた ADR 候補の PR の head であることを確かめ、`git switch --detach 'origin/<base>'` する。満たさなければ切り替えずに止まる。続けて `shirokuma-flow next <課題>` を引き直し、`working` なら課題のブランチを `origin/<base>` から切って実装の段へ、`preparing` なら detached のまま計画の段へ進む（ブランチは切らない）。どちらの回も、この切り替えの後の HEAD を手順書（`issue-run-worker` の定義）の最初の一手 2 で控える sha として扱い、最初の一手 3 の「HEAD が 2 で控えた sha のまま」はこの値で照らす。

手順書のうち次の文は、作業セッションでは「作業セッションの main が自分で行う（委任するのは整合のレビューと PR のレビューだけ）」と読み替える: `issue-run.md` の「メインに残す段」の ADR 候補の起票・確定・ADR 候補の PR、「委任」の段 1 の段 6 の ADR 候補の確定と ADR 候補の PR、「PR やブランチが 2 本以上になる課題」の ADR 候補の PR の項（メインが既定の経路で委任する）、`issue-run-worker` の定義の「してはいけないこと」の ADR 候補 Issue の起票と ADR 候補の PR、設計・計画の段の「ADR 候補 Issue は起票しない」。

倒れる向き: 設計と ADR 候補の本文を書いた main が、授権の下で確定まで打つ。受けるのは整合のレビューと ADR 候補の PR のレビュー（どちらも別の worker）と確定の内容検査で、宣言欄を緩めない側に書き違えた回は素の形で確定まで通る（fail-open）。8 の確かめを飛ばすと課題のブランチ（か計画の段の起点）が古い base から切られ、受けるのはコードレビューの base の照合だけである（fail-open）。

### 手順書の「してはいけないこと」の扱い

- 外れる: 上の「自分で打つ」に当たる禁止と、入れ子にだけ掛かる禁止（固定形のブリーフ以外での委任・4 本以外の委任・R1b の続きの固定形・`gate token` / `config get` の引き直し・`gate nested-check`・`rec=` の置き場の禁止）。
- 名指す書き込み（「名指されていない GitHub への書き込み」に当たらないもの）: 計画要否の契約コメント（課題へ 1 件）・worker を使えない回の確認ビューの記録行（対象の Issue / PR 本文）と `pages push`。上の「ADR 候補の段」の回は次も: ADR 候補 Issue の起票と候補本文の書き戻し（`issue context` → `issue push`）・ADR 候補のブランチへの commit / push と ADR 候補の PR の作成と本文・確定した ADR 正本と対応表の `pages push`・緩める側の候補を授権で確定した回の監査コメント（`autonomous-flow` の `reference/criteria/irreversible-operations.md` の「監査」節）・人がその場で特定の候補を自分で確定すると指示した回の候補 Issue への 1 行。
- 残る: merge（課題の PR と ADR 候補の PR）・作業ツリーの外への書き込み・名指されていない GitHub への書き込み・動作確認での実 GitHub への書き込み・worker を使える回に確認ビューを自分で生成すること・force push・`git branch -D`・作業ツリーの撤去・レビュー worker の結果ファイルと記録の書き換え。

### push の判定

作業セッションの main には agent の種別が無いので、hook の rule `issue-run-push`（宛先を課題のブランチ 1 本に縛る判定）は掛からない。ほかの push の rule は掛かる。宛先は課題のブランチと、その課題の設計か計画が起こした ADR 候補のブランチ（`branch name <候補#>`）の 2 本だけで、それ以外へ push しないことは自分で守る（fail-open）。

## 4. 終わり方

次のどれかで終える。

1. PR のレビューの判定を記録し、段 4 の遷移まで打った（merge の判定と merge は管理セッションで、主リポの作業ツリーで行う。merge の verb は cwd のツリーを切り替える）。
2. ADR 候補の PR のレビューの判定を記録し、遷移まで打った（merge は管理セッションか人が行う。依頼元へ PR 番号と merge の依頼を返す。取り込まれたと知らされたら同じセッションで「ADR 候補の段」の 8 から続け、セッションを閉じた回は新しい作業セッションが `next` から続ける）。
3. 計画 NEEDED の計画が承認された（実装サブは 1 本ずつ、それぞれの作業セッションで起動する）。
4. 止まる理由が出た（ADR 候補の確定の要素が `runBy:"human"` だった回を含む。その要素の `verb` と `args` を逐語で締めの報告に書く）。

- 締めの報告には、課題番号・PR 番号・作業セッションのツリーのパスと、依頼元が行うこと（merge・作業ツリーの撤去・人の判断が要る点）を書く。
- 依頼元が管理セッションの回は、どの終わり方でも（「1. 使う条件」で外れて何もしない回・「2. 手順書」の引けない値で止まる回・「始め方」の表で止まる `verdict` の回を含む）、締めの報告の要点（PR 番号か、止まった理由と `verdict`）を依頼元へ SendMessage で 1 行返す。返さないと、管理セッションの待ちが終わらない。
- 作業セッションのツリーは作業セッション自身では撤去しない（撤去は merge の後に管理セッションか人が行う）。
- 作業セッションが動いている課題に、管理セッションから遷移や委任を重ねない。
