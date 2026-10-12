---
name: implement-flow
description: Working フェーズを統括し、ToDo の Issue を実装して PR を作りレビュー人ゲートまで進める（実作業は worker に委任）。Use when Issue を実装するとき、PR を作るとき、Working フェーズを進めるとき。
model: opus
---

# implement-flow（Working フェーズ）

## 起動直後

Bash で `shirokuma-flow rules inject --scope orchestrator` を実行し、**出力の `<rule-file>` 要素を本タスクの規範として読む**。`<rule-file>` の外（ヘッダ行）に規範は載らない。

## 流れ

階層は 課題 > 設計(0..1) > 計画(1..n) > 実装サブ(1..n)。本 skill は ToDo の Issue を **実装 → PR → レビュー待ち**まで進める。**実作業のうち Creator-Checker 分離が要る段と、独立で規模の大きい作業はサブエージェントへ委任する**（レビュー層は PR 作成後の `review-flow` が委任する。どの段を誰が実行するかは下記「レーン（軽量 / 標準）」節が正本——標準レーンではコードは `coding-worker`、コミットは `commit-worker`、PR は `pr-worker` に委任する）。状態遷移は `flow` CLI verb のみ。flow CLI の実行には Projects v2 を読み書きできるトークンが要る。終端は PR 作成と、同じ応答の中での `review-flow` の起動（手順 6。merge を誰が打つかは手順 7 が指す正本で判定し、既定は人ゲート・コード差分を持たないサブは `done` で終端する）。

## routing

1. `shirokuma-flow next <n>` を引く（確認モードの回は `--guided` を付ける）。着手前の Status は `shirokuma-flow status <n>` で引く。
2. **手順の正本は注入される rule `next-routing-contract`**（`ok:false` の扱い・`verdict` の下表引き・`nextActions[]` の辿り方・`limits[]` の解決・確認モードの中継、ここには写さない）。

| verdict | 次手 |
|---|---|
| `working`（上から順に当てる） | ① `descendTo` がある → 段の順序に入らず、`nextActions` の `next <descendTo>` を打ち、降りた先の verdict でこの表を引き直す<br>② reason が `sub_started` → 段の順序に入らず、[reference/docs/recovery.md](reference/docs/recovery.md)「実装サブを In progress から再開する」から再開する（`begin` は打たない）<br>③ reason が `sub_ready` / `design_skipped_not_needed` / `plan_skipped_not_needed` / `no_sub_child` → 下記「段の順序」へ入る<br>④ それ以外 → 停止して報告する |
| `gated` | `nextActions` が指す `submit` / `approve` を打つ（下記「入口の状態遷移」の条件つき） |
| `designing` / `preparing` | 対応フェーズ skill へ渡す（本 skill は着手しない） |
| `select_child` / `all_children_done` / `leaf` | `nextActions` に従う |

①で降りた回と②の回は、段 1〜5 の `<n>`（`status <n>`・`begin <n>`・`branch name <n>`・PR 本文の `Closes`・終端の `done <サブ番号>`）をすべて降りた先のサブの番号に置き換える。最初に渡された課題や計画の番号は使わない。

### 入口の状態遷移（打ち方）

- **既定（自律）は orchestrator が `shirokuma-flow approve <n>` を打って進む**。`IssueType=ADR` の候補 Issue を含む `approve` の既定・人が打つ条件・判別手順の正本は [[status-policy]]（詳しい手順は `requirements-flow`）。
- **確認モードの回は人の `approve` を待って止まる**（確認対象の所在と確認後に打つ verb を添える。逐語は `next --guided` の `nextActions[].runBy:"human"` が運ぶ）。
- **見るのは対象 Issue 自身の Status だけ**——関連する ADR 候補 Issue が `Backlog` / `Review` のままでも実装は進める（射程の正本は [[concept-gap-to-adr]] 手順 5）。

## レーン（軽量 / 標準）

**本節の「軽量レーンを選ぶ条件」をすべて満たす回は軽量レーンが既定**である（条件の正本は本節で、他所へ写さない）。**満たさない回・判定がつかない回は標準レーンへ倒す**（fail-closed）。標準レーンの段構成は下記「段の順序」である。**軽量レーンは委任の対象をレビュー層だけに絞るレーン**であって、レビューを飛ばすレーンではない。

- **判定軸は「委任が要るか」だけ**で、要否は**段の性質**で決まる。機械段（品質ゲートの実行・コミット・PR 作成）は結果が終了コードと出力で機械的に検証でき実行者が誰でも同じ結果になるので**委任しない**。レビュー層は**書いた本人とは別の読み手であること自体が検査の中身**なので**委任する**。**この軸が決めるのは各段を誰が実行するかだけで、段を落とすかは決めない。**
- **大きさ（行数・ファイル数・件数）では判定しない**。大きさは段の性質を動かさないので、判定軸にすると「小さいから検査を減らす」に化ける。
- **軽量レーンを選ぶ条件（すべて満たす回だけ）**: ① 実行者自身が機械段をその作業ツリーで直接実行できる（CI 等価検査の単一エントリを引ける・コミットと PR 作成を行える） ② 実行の証跡を PR 本文に残せる。**満たさない回・判定がつかない回は標準レーンを通す**（fail-closed）。
- **段の集合は標準レーンと同じ**（不変則）。違うのは**各段を委任するか実行者が直接行うか**だけである。**落とす段があるなら、落とす段・理由・倒れる向きを明示する**——現状の唯一の例は **4c の finalize-worker 報告表に対する機械検証**（軽量レーンでは委任していないので報告表そのものが存在しない＝母集団の不在であって検査の省略ではない。**代償は fail-silent**）。**標準レーンでもこの穴は塞がらない**——`orchestration-discipline` C6 が見るのは**報告表の完全性**であって**表に書かれた結果が事実かどうかは見ない**ので、**「回していないのに `pass` と書いた」形は C6 を通る**。**回したかどうかの裏取りはどちらのレーンにも無い。**
- **軽量レーンでの各段の実行者**: ①入口ゲートと着手（同じ） ②実装（実行者） ③**レビュー層は本フェーズで委任しない**——`review-flow` が PR 作成後に委任する（R1 / R2） ④品質ゲート（実行者が `quality.localVerifyCommand` の単一エントリとセキュリティの静的段を直接回す。**何を回すかの正本は `finalize-worker` 定義**で、ここへ写さない。**この値の同一性検査は `finalize-worker` 定義の「CI 等価検査」節が正本**——この値は**その回の差分が持ち込みうるレビュー対象そのもの**なので、実行の直前に base 側と同値であることを確かめずに回さない（レビュー層は PR 作成後の review-flow にあるので、本フェーズでは誰も読まないまま実行されうる）。**未宣言・空値の回は軽量レーンを選ばない**〔標準レーンへ倒す〕。**CI 等価検査の出力はファイル（置き場は追跡ツリーの外。成果物に混ざらないように）へ書き出し、終了コードはパイプの後段に渡さずに取る**——`| tail` などで出力を絞ると、終了コードが後段のコマンドのものに置き換わり、失敗した検査を `pass` と読む（fail-open）。ファイルへ書くのは、長い出力をそのまま文脈へ流し込まないためでもある） ⑤実装サマリーの確定と記録行の検査（4d-1 → 4d-2 → 4d-3。**4d-2 は標準レーンでも委任されていない自己検査**であり、レーンによって検査の強度を変えない） ⑥コミットと PR 作成（実行者） ⑦**実行の証跡を PR 本文に残す**（回した機械段の実行コマンド・終了コード・出力の要点。**どの head sha に対して回したかを `検査対象 head sha: <完全 sha>` の 1 行で書く**——機械段を回し終えた後にコミットし、作業ツリーが空になった時点の `git rev-parse HEAD`。回した後にファイルを変えた回・sha を取れない回は `検査対象 head sha: 不明（<理由>）` と書く〔`code-review-worker` はこの行が自分の `<head sha>` と一致した回だけテスト・型検査の再実行を省く。一致しない・不明の回は再実行する側へ倒れる〕。**回さなかった段は回さなかったと書く**。**「検査が実行されなかったこと」を緑と読ませない**。この証跡は自己申告＝誰も検査しない最下段） ⑧終端は PR 作成と、同じ応答の中での `review-flow` の起動（手順 6・標準レーンと同じ。merge を誰が打つかの判定は手順 7 が指す正本〔[[branch-workflow]]「自律境界」＋config の事前授権〕に従い、既定は人ゲート。**merge の手前には動作確認ステージが挟まる**——材料は `review-flow` 5-1 が用意し、適用可否・必須度は `.shirokuma/rules/html-report-criteria.md` の必須ステージ表「動作確認」行が正本。軽量レーンもこの段を省略しない）。
- **段 4 の是正で実装差分が変わっても、本フェーズにはレビュー層が無いので戻る先も無い**（レビューは PR 作成後の `review-flow` R1 / R2 が一手に持つ）。**したがって本フェーズにレビューのループ上限は無い**——上限 2 回は R2 が持つ。
- **通したレーンは記録行として残るが、裏取りにはならない**——値を書くのは実行者自身なので、**軽量レーンを通したのに標準レーンの値を書いても値域内なので素通りする**（**fail-silent**）。全件は `shirokuma-flow gate limits --sub summary` が正本。

## 段の順序（標準レーン）

1. **状態確認**: `shirokuma-flow status <n>`（Status / kind / 親子 / 許可遷移を取得）。routing ③ で入った回に限り、`ToDo` でなければ中断（誤呼び出し）。
2. **着手**: `shirokuma-flow begin <n>`（ToDo → In progress）。
3. **実装を委任**（`coding-worker`）。委任ブリーフに下表の reference パス（TDD 詳細・委任判定）と**当該 worker scope の規範要旨**（正本 [[skill-authoring]]）を明示し、「**動作確認・テストで実 GitHub に書き込まない**（CLI 実走検証は `--fixture`・実書き込みが必要なら実行せず理由を添えて返す）」を添える。リポにドメイン拡張（nextjs / infra）が見えるなら「拡張プラグイン候補」のヒントを書く——**判定はしない**（拡張併用の判定は worker の自己判定）。worker は**圧縮サマリー**を返す。orchestrator はコードを直接編集しない。
   - **作業ブランチの用意（委任の前提）**: 委任前に現在ブランチを確認し、mainline（config `project.defaultBranch ?? "main"`）上なら**先に作業ブランチへ切り替える**。ブランチ名は `shirokuma-flow branch name <n>` で導出し（**手組みしない**）、サブ Issue で統合ブランチを使う場合は [[branch-workflow]] の検出順に従う。**mainline 上で実装を進めると PR による人ゲートを迂回する**ため、この前提が満たされない限り段 5 の commit-worker は commit せず差し戻す。
   - **並行実装時の作業ツリー分離**: 複数サブ Issue を**並行**して実装する場合は、各サブを**別々の作業ツリー**（`git worktree add` 等）に分離し、その**パスを coding-worker / commit-worker の cwd として**委任ブリーフに明示する。責務分担は **orchestrator が分離を用意しパスを渡す／worker はそのツリー内で作業する**。**注記（分離ツリーで走る検査の射程）**: `git worktree add` では submodule は展開されない（gitlink は空ディレクトリのまま）。そのツリーで走る **submodule 配下を読む検査は黙って skip され、skip は終了コードに出ない**（**fail-open**）。分離ツリーで得た緑を、それらの検査まで含む緑と読まない。その skip を閉じるために分離ツリーへ submodule を展開するときは、次の形に限る。
     - **ネットワーク取得をしない**（`git submodule update` / `clone` / `fetch` を展開に使わない）。展開は `git -C "<submodule の絶対パス>" worktree add --detach -- "<分離ツリーの絶対パス>/<submodule パス>" "<SHA>"` だけで行う。
     - **差し込む値は、コマンド行へ載せる前に形を確かめる**。`<SHA>` は分離ツリー自身の `git -C "<分離ツリーの絶対パス>" ls-files -s -- "<submodule パス>"` から読んだ gitlink の値で、空でなく 16 進数字（`0`〜`9` / `a`〜`f`）だけからなること。`<分離ツリーの絶対パス>` は自分が用意した分離ツリーの絶対パスに限り、`shirokuma-flow gate vocab` の `isolatedTreeRootAllowlist` の条件を満たすこと。`<submodule パス>` はリポジトリ相対パスで、`gate vocab` の `isolatedTreeSubmodulesAllowlist` の条件（許可する文字・`/` や `-` で始まらない・`..` を含まない など）を満たすこと——値は二重引用符の中に置くが、二重引用符は `$(…)` やバッククォートの展開を止めないので、条件を満たさない値を引用で無害にできると読まない。満たさない値は載せず、その submodule を未展開として申告する。
     - **展開する前に、人の作業ツリーで submodule が展開済みであることを確かめる**（`<submodule の絶対パス>/.git` が在る）。展開済みでない・その SHA が submodule に無い（`add` が非 0）回は展開せず、**未展開として申告する**（その submodule 配下を読む検査は skip されたままである）。
     - **撤去は submodule 側の worktree を、親の分離ツリーより先に** `git -C "<submodule の絶対パス>" worktree remove --force -- "<分離ツリーの絶対パス>/<submodule パス>"` で外す（逆順にすると submodule 側の登録が孤立する）。`worktree remove --force` の対象は、この手順で自分が作った分離ツリー側の worktree に限る（人の作業ツリーの worktree を対象にしない）。
4. **品質ゲート（機械段のみ）**: 4c（finalize）→ 4d（実装サマリーの確定と HTML 化判定）の順で通す。**レビュー層 3 本と差し戻し判定は `review-flow` が持つ**——**深いレビューの置き場は PR 作成後**で、本フェーズの終端は「finalize 緑＋PR 作成」である。**手順・分岐・記録行の正本は [reference/docs/quality-gate.md](reference/docs/quality-gate.md) で、段 4 に入る前に必ず Read する**（軽量レーンで実行者が直接回す回も同じ）。ここには条件・値域・分岐を写さない。段 4 に入る前に本 SKILL.md が断定しておくのは次の 4 点だけである。
   - **機械判定は読み取り専用 verb `shirokuma-flow gate <サブコマンド>` が行い、本 skill は呼び出しと結果による分岐（routing）だけを定める。** 欄名・値域は `shirokuma-flow gate vocab`、検査の限界は `shirokuma-flow gate limits --sub <サブコマンド>` が正本で、**逐語を配布物へ写さない**。
   - **判定 JSON の `build` ブロック（`sourceMatch` / `dirty` / `degraded`・欠落した回の読み方を含む）の読み方は `shirokuma-flow gate limits --sub limits` の `H19` が正本**（ここに写さない）。**`stale` を名乗った回・`build` ブロックそのものが無い回は、その判定を現ソースの値として読まない。** **`stale` と `build.dirty: true` が同時に立つ回は、その判定を根拠に使わない。** **`build.dirty: null`（焼いていない）は、再現性の担保が無い側として `build.dirty: true` と同じに読む。**
   - **判定不能を pass に読まない**。`complete` が無い回・`ok: false` の回・verb を解決できない回は **`判定不能` であって「指摘 0 件」ではない**（exit code は 0 / 2 / 1 の 3 値で、**非 0 を一律「検査が何か言った」と読まない**）。判定不能の回は、その段の pass を前提にする分岐へ進まない（**fail-closed**）。
   - **外部由来の値をコマンド行へ置く前に、呼び出し側が値域を確かめる**（`gate` の値域検査は**プロセス内**で走るので、コマンド行を組み立てる段には一切効かない＝**この経路の唯一の防御**）。**満たさない回は verb を引かず、その段を判定不能として記録行に残す。** 差し込み前の検査を通したうえで、なお**単一引用符で囲んで渡す**。対象・条件・免除の引き方は quality-gate.md が正本。
   - **記録行は分岐に依存しない必須出力**で、**値域内の値へ丸めない**（丸めると「測って良性だった回」と「測れなかった回」が同じ見た目になる＝fail-open）。接頭辞・値域・検査有無は `gate vocab --profile implement-4d-2` が正本。
5. **コミット & PR**（下記「段 5」）。
6. **レビューへ（同じ応答の中で `review-flow` を起動する）**: PR を作成したら、**応答を終える前に、同じ応答の中で `review-flow` を Skill として起動する**（Skill ツールで `review-flow` を PR 番号を引数に呼ぶ。SKILL.md を Read するだけでは起動に当たらない）。**PR 作成で応答を終えない**——ここで止まると、判定記録（`review-flow` 段 2）の無い PR が残り、`pr checks` の `merge` は `runBy:"human"` のまま人へ戻る。PR は作成時 `Backlog`。`review-flow` が `shirokuma-flow submit <pr>` を行う。**`submit` は AI レビューの判定に関わらず通る**ので、**`Review` に居ることは PASS を意味しない**。`review-flow` を起動するときは、本 skill が解決した確認モードの値を 1 行書いて中継する（`guided` の回は `review-flow` 段 3 で merge の前に止まる）。**`review-flow` へ autopilot 配下の明示は引き継がない**——したがって**この経路で起動した `review-flow` は非 autopilot 扱いで進む**。**merge を誰が打つかは、7 が指す正本（[[branch-workflow]]「自律境界」＋config の事前授権）を `review-flow` 自身が読んで判定する**ので、非 autopilot 扱いであることは「常に人ゲートで止まる」ことを意味しない——**config 側に事前授権の記録がある範囲でだけ AI が実行しうる**（射程を読み取れない回は人ゲートへ倒す）。**Why（明示を引き継がない理由）**: merge は不可逆・外向きで、`autonomous-flow` の `reference/criteria/irreversible-operations.md`「マージの安全装置」節の連言（起動時の包括委任だけでは AI レビューのみで人レビューの無い PR の `merge` は実行できない・可否が自律側でも本節が掛かれば実行しない）がそのまま掛かる。引き継ぎを足すと、autopilot の明示だけで自律境界の判定手順を経ずに merge が実行される経路ができる。
7. **merge の判定**: 既定は人ゲート。**`merge`（PR）を誰が打つかの判定の正本は [[branch-workflow]]「自律境界」**（配布先の**既定は人ゲート**で、プロジェクトの config 側に事前授権の記録がある範囲でだけ AI が実行しうる。射程を読み取れない回は既定へ倒す）。**merge の手前には動作確認ステージが挟まる**（`review-flow` 5-1 が材料を用意する。適用されるか・必須度は `.shirokuma/rules/html-report-criteria.md` の必須ステージ表「動作確認」行が正本——本フェーズは予告するだけで条件を写さない）。
   - **7a. reconcile --fix（統合 PR の mainline merge 直後は必須）**: 統合 PR が **mainline に merge された場合**、続けて `shirokuma-flow reconcile <親課題番号> --fix` を**必須実行**する。**mainline の具体名は config `project.defaultBranch`（未設定なら既定 `main`）が正本**で、発火条件は「base が mainline と一致するか」であって特定のブランチ名ではない。**サブ Issue の PR（base が `epic/*`）merge では実行しない**（epic 期の抑制中・[[workflow-reconcile]]）。
8. **クローズ提案（advisory・統合 PR の mainline merge 直後のみ）**: 7a の後に `shirokuma-flow closure-suggest <統合で閉じた Plan 等の子孫番号>` を実行する。`candidates` が空（`[]`）なら**無音終了**（追加の発話やコメントもしない）。候補があれば `whyNotAutoClosed`・残件サマリー・`recommendedAction`（`keep` / `done` の **2 値のみ**）を要約して**人へクローズ可否を提案する**。**ここで AI は提案のみ**——機械的に `done` / `close` しない（**包括委任配下でも同じ**）。**Why**: `recommendedAction=done` が付く候補は必ず「非完了 close（cancel / duplicate）の子を持つ親」で、その据え置きは、差し替えの子を作る余地を残すために人の判断に残す。**人が close する際に `done` と `cancel` のどちらを使うかは人の判断。** 提示形式は `writing-html-explainer` に委ね、**委任時にモードを「提案」と明示する**。

### 段 5. コミット & PR

`commit-worker` で確定し、`pr-worker` で PR を作成する。サブ Issue は親の `epic/{親番号}-{slug}` をターゲット（[[branch-workflow]]）。4d で HTML 化した回は PR 本文の最上部（BLUF）へ**確認ビューのリポジトリ内パス**を添付する（**URL は書かない**）。**コード差分を持たないサブはこの段から段 7 までに乗らない**（下記「PR を伴わないサブの終端」）。

- **`Closes` の書き方**: **計画スキップ経路の課題**（`next` が `plan_skipped_not_needed` を返し、normal 直下に承認済みの設計子だけが在る回）は PR 本文の `Closes` に **normal と設計子の両方**を素の行で並べる——計画が無いので cascade の起点が無く、並べないと設計子が誰にも閉じられない（書き忘れて normal だけが Done になった回は `reconcile` が `plan-skip-design-not-done` として報告する。`--fix` では直さない）。計画が実在する通常経路ではサブ自身だけを `Closes` する。
- **配布物を変更した PR は反映遅延を PR 本文へ 1 行で明示する（要否は 4d-1 の記録行が決める）**: **判定をここで取り直さない**（同じ判定を 2 箇所で持つと食い違う）。**記録行の母集団は `plugin/**` に固定されている**ので、プラグインのソースを別の置き場に持つ導入先では記録行が「変更なし」に倒れ、この 1 行は出ない（fail-open）。値が `plugin/**` の変更ありを表すものの回に、次の 1 行を pr-worker へのブリーフに逐語で渡す:

  ```
  > 反映遅延の注記: 本 PR は配布物（`plugin/**`）を変更する。実行中の worker / skill が読む定義は**現行セッションのスナップショット**であり、**それ以降の変更は実行時に反映されない**——本 PR が追加・変更した検査は、本 PR 自身の品質ゲートでは働いていない可能性がある。スナップショットが何を契機に取られるかは**未確定**で、少なくともセッション中の merge では更新されない（Claude Code のプラグインキャッシュについて確かめた範囲で、版によって変わりうる）。
  ```

  **「次のリリースまで反映されない」とは書かない**——キャッシュがリリースに固定されているのは事実だが、**実行時の定義がそのキャッシュであるとは限らない**。**契機を断定しない。**
- **gitlink 集約遅延の整合注記（委任のみ）**: commit-worker への委任ブリーフに「**サブ PR の base が `epic/*`（統合ブランチ）のとき親リポ `.shirokuma/pages` gitlink bump は行わず統合集約まで遅延し、submodule の内容（HTML）push は base に関わらず維持する**」を添える。判定・実行は commit-worker の責務。

## 確認ビュー（4d-3）

**4d-3. 実装サマリー HTML 化判定**: 4d-1 で確定した作業ファイルを入力として要否を判定する。**HTML 化要否・生成の発火条件（既定は生成しない）・記録行の欄 id（`confirmation-view-record` / `decision-hesitation`）と値域・生成の委任先の正本は [[html-report-criteria]]（ここには写さない）**（軽微＝typo 修正級は PR 本文の Markdown 要約で足りる）。**書き込み経路**: 生成した回も生成しなかった回も `pr context` → 編集 → `pr push`（段 5 の PR 本文編集にまとめる）で対象 PR 本文の BLUF へ記録行を残す（行の有無を生成／非生成の分岐に依存させない。**書き落としを検知する機械段は無い**＝**fail-silent**）。生成した回は**確認ビューのリポジトリ内パス**（`.shirokuma/pages/<カテゴリ>/<スラッグ>/index.html`）を同じ BLUF に添付する。**URL は本文へ書かない**——`preview-url-guard` が `pages.baseUrl` 起点の URL を本文へ新たに書く回を拒否するので、書くと `pr push` が通らない。**倒れる向きの申告**: 記録行と直下の字下げ行を同じ作業ファイルへ集めることは criteria が測る量を**単調に増やす**——判定条件そのものは変えないが、変化するとすれば **HTML 化する側が増える一方向**で、減る方向には動かない。

## PR を伴わないサブの終端（コード差分ゼロ）

成果物が GitHub 上のアイテムだけでコード差分を持たないサブ Issue（ADR / 決定の起票・Issue 化・調査など）は、段 5〜7 に乗らない。段 1〜2 と成果物の作成まで進めたら、次で終端する。

- **終端は `shirokuma-flow done <サブ番号>` だけで足りる**。`done` は Done+close の成功後に親 Done カスケードを gate 付きで発火するので、**`done` の後に手動で `reconcile --fix` を回さない**。発火したか抑制されたかは `done` の `sideEffects` に載るので確認する。
- **epic 期（統合ブランチ運用中）は、統合 PR（draft 可）を先に立ててから PR なしサブを `done` する**。**Why**: カスケードの抑制 gate は「親に open な closing PR が残っているか」を epic 期のシグナルにしている。統合 PR 未作成の窓で `done` すると抑制シグナルが無く、コードが統合ブランチ止まりのまま親が Done+close されうる（premature-Done）。**`done` はサブ終端に必須の verb で毎回無条件に発火するため控える規律が使えない**——だから先に統合 PR を立てて抑制シグナルを成立させる**作為型**の手順にする。
- 抑制されたカスケードは、統合 PR が mainline へ merge された後の**段 7a の `reconcile --fix` で再発火する**。

## 委任先 worker

`coding-worker`（実装）/ `commit-worker`（コミット）/ `pr-worker`（PR）/ `finalize-worker`（品質ゲート）/ `research-worker`（技術調査・必要時）。

> **レビュー層 3 本（`security-review-worker` / `code-review-worker` / `asset-safety-review-worker`）は本フェーズの委任先ではない**——`review-flow` の R1 の委任先である。**PR 作成前に深いレビューを走らせない**（同じ差分を 2 回精読する形を避けるため、PR を唯一のレビュー面にする）。

## 停止境界

`ok:false` の回・`verdict` が上表に無い回・`nextActions` に `runBy:"human"` が現れた回・`quality.localVerifyCommand` の同一性が成立しない回・PR 作成後の merge。境界の定義そのものは注入される rules の自律境界節が正本で、ここには写さない。

**締めの報告で人に出す項目**は [[orchestration-discipline]] C13 に従う（`next` / `pr checks` の `nextActions[]` のうち `runBy:"human"` の要素から引き、`verb` を訳語で言い換えない）。規則はそちらが正本で、ここには写さない。

## リファレンスドキュメント

補助知識・判定基準は本 SKILL.md と同階層の `reference/` 配下。委任ブリーフにパスを明示し、coding-worker が必要時に Read で読む（常時注入しない）。

| ドキュメント | 内容 | 読むタイミング |
|------------|------|--------------|
| [reference/criteria/delegation.md](reference/criteria/delegation.md) | 委任判定規則（リポ依存×対象パターンの 2 段判定・拡張併読の実行機構） | 段 3 の委任ブリーフ作成時・worker の拡張併用自己判定時 |
| [reference/docs/quality-gate.md](reference/docs/quality-gate.md) | 段 4 の詳細手順（`gate` の呼び方の機械契約・コマンド行への差し込み前検査・4c / 4d の分岐と記録行） | **段 4 に入る前（毎回）**・軽量レーンで実行者が直接回すとき |
| [reference/docs/tdd.md](reference/docs/tdd.md) | TDD ワークフロー詳細（red→green→refactor の刻み方・テスト粒度・@testdoc） | 段 3 の実装委任時（毎回ブリーフに明示） |
| [reference/docs/recovery.md](reference/docs/recovery.md) | 中断回復手順（中断点別の状態検出チェックリスト・冪等性表） | チェーン中断からの再開時（orchestrator が読む） |

> 不変則: **実作業のうち Creator-Checker 分離が要る段と、独立で規模の大きい作業はサブエージェント**（どの段を誰が実行するかは「レーン（軽量 / 標準）」節が正本）。skill 自体はツール制限が効かないため、これは運用規範であり、機構的強制は **worker(agent) 側の tools 制限**で担保する。状態遷移は `flow` verb のみ。判定は `shirokuma-flow next` に一元化。
>
> チェーン規律: 継続（C1）・全ステップの事前登録（C2）・判定の構造化文字列（C3）・指摘の処理（C12）は rule `orchestration-discipline` が正本（ここには写さない）。
