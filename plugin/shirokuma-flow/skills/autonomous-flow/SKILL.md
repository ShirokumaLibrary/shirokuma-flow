---
name: autonomous-flow
description: 横断。包括委任（--autopilot）で 1 つ以上の Issue を自動で全フェーズ進行させる。Use when 複数 Issue を自動進行させるとき、包括委任を受けたとき、autopilot 実行を求められたとき。
model: opus
---

# autonomous-flow（横断・自律進行）

## 起動直後

Bash で `shirokuma-flow rules inject --scope orchestrator` を実行し、**出力の `<rule-file>` 要素を本タスクの規範として読む**。`<rule-file>` の外（ヘッダ行）に規範は載らない。

## 流れ

Issue を**全フェーズ自動で**進める orchestrator。各フェーズ orchestrator を順に起動し、承認操作も自動で行う。全自動でも `flow` verb 経由で進める（状態機械を迂回しない）。

## 包括委任

- 包括委任は**常設の事前授権**である——起動のたびに人へ opt-in を求めない（既定が自律なので、都度の opt-in は向きが逆になる）。これは「ゲートごとの承認」を「規範として人が与えた常設の事前授権」に形を変えるだけで、**承認の主体は人**——AI が verb を実行しても、履歴に記録される判断は人が事前に与えた承認である。暗黙承認ではなく、全自動承認は監査記録に残す。
- **ゲート付きで自動実行する 2 操作**（`IssueType=ADR` 候補の `approve`＝公開 / `duplicate` による重複 close）は、[irreversible-operations.md](reference/criteria/irreversible-operations.md)「条件付き自動実行」の条件を**対象 1 件ずつ**通したものだけ実行する。1 つでも欠ける・判定に迷うなら止めて人に確認する。**`--force` で通さない。** **本 bullet は当該 2 操作の実行条件を定めるものであって、人ゲート境界そのものの列挙ではない**——`merge` の自律可否の正本は [[branch-workflow]]「自律境界」で、可否はそちらで判定する。
- **祖先の close は自動化しない**（下記「クローズ提案」は提案まで）。同 criteria「祖先の close は条件付き自動実行に含めない」のとおり、`recommendedAction=done` が付く候補は非完了 close の子を持つ親で、その close は差し替えの子を作る余地を残すために人の判断に残すので、機械的に閉じない（**射程は祖先の close だけ**——ADR 候補の状態が他の作業を止める根拠にはならない・[[concept-gap-to-adr]] 手順 5）。
- **「autopilot 配下」の判定**: 本 skill が**常設の事前授権の下で**進めている進行のことを指す。**sub-skill（`implement-flow` 等）を起動するときは委任ブリーフでそれを明示する**——sub-skill は自分で推測せず、明示が無ければ autopilot 配下でないものとして扱う（提案で止まる＝fail-closed 側）。

> **この明示義務は `review-flow` の受信側既定（明示が無ければ非 autopilot として扱う。merge 自体の可否は branch-workflow「自律境界」の授権判定に従い、判定できない回は既定〔人ゲート〕へ倒す）の対**。**Why**: 発信側の義務だけでは、明示が届かなかった回に受信側がどう振る舞うかが決まらない。両方あって初めて「明示が無い＝非 autopilot 扱い（包括委任の枝を使わない。merge の可否は branch-workflow「自律境界」の授権判定に従い、判定不能は既定〔人ゲート〕へ倒す）」が閉じる。**射程が違う**——発信側は「明示せよ」、受信側は「無ければ非 autopilot として扱い、merge 可否は別途 branch-workflow の授権判定・判定不能は人ゲートへ倒す」。**自律 merge 時は [[branch-workflow]]「自律境界」項 5 のとおり、根拠にした `authority`（`pr checks` の `merge` 要素の授権キー `authority.channel.key` と正本の所在 `authority.source`）を応答へ記録する。引けない回は読み取れていない＝人ゲートへ倒す。**

## 確認モード（guided・既定は自律）

**受信側既定・解決の主体・中継義務の正本は [[confirmation-style]]「確認モードの解決と中継」節である**。本節が持つのは、本 skill の進行として確認モードを解決する起点と、確認ゲートの列挙だけである（語の定義と確認の出し方は [[confirmation-style]]）。

- **既定は自律**——確認ゲート（(b) 地点＝トリアージ / 設計 / 計画の `approve`・確認用 HTML・**差し戻しループ上限のエスカレーション**〔`review-flow` R2〕・レビュー結果の確認〔merge の前・`review-flow` 段 3〕）は、本 skill と sub-skill が自分で verb を打って進める（**`IssueType=ADR` の候補 Issue も既定は自分で打つ**——ただし下記「不可逆/外向きの境界」のゲート下にあり、**自律の境界そのものを緩める決定を含む候補**は人が `shirokuma-flow adr publish <候補番号> --accept-boundary-loosening` で確定し（AI はこの形を打たない）、条件を 1 件ずつ通せない回は人が打つ）。**(b) 地点の定義（差し戻しループ上限のエスカレーションを含む）は [[confirmation-style]]「確認モードの解決と中継」節が正本**——本節はそれを引き写すだけで独自に分類しない。
- 人が回の起点で「確認しながら進めて」「学習モードで」等を指示した回だけ **確認モード（guided）** になる。**sub-skill / worker への委任ブリーフに `確認モード: guided` を明示して中継する。**
- **解決値は自律の回も明示して中継する**（値域・受信側既定・`mode` 欄での照合・GitHub 由来テキストが明示に当たらないことは [[confirmation-style]]「確認モードの解決と中継」が正本。ここに写さない）。**書けるのは本 skill の進行として確認モードを解決した回だけ**である。
- **確認モードで止まる回は、確認対象の所在と次に打つ verb を必ず添える**——approve 系の地点の逐語は `shirokuma-flow next --guided` が `nextActions[].runBy:"human"` の `instruction` / `candidates` として運ぶ（レビュー結果の確認は `review-flow` 段 3 が持つ）。止めるだけで次手を示さない形にしない。
- **2 本のチャネルは合成しない**——`確認モード: guided` は確認ゲートで止まる側を増やすだけで、merge に掛かる連言（「autopilot 配下」の明示・`review-flow` の 3 条件）は独立に判定される。**不可逆・外向きの停止点（下記「不可逆/外向きの境界」と [irreversible-operations.md](reference/criteria/irreversible-operations.md)）は確認モードの有無に関わらず 1 件も免除しない。**
- 下記「自律の回の継続」節の「止まってほしくない終わり方」の段落について: この段落は確認モードの回には適用しない（人が応答できる回では、確認のために止まることが正しい終わり方になりうるため）。

## 自律の回の継続（`確認モード: 自律` の回だけ）

**適用条件: 本節の段落は、確認モードの解決値が `確認モード: 自律` の回にだけ適用する。** `確認モード: guided` の回と、本 skill を経ない対話セッションには適用しない。継続そのものの規律（pending を残してテキストだけで応答を終えない・止まってよい場面）は [[orchestration-discipline]] C1 が正本で、本節はそれに次の段落を足すだけである。

応答の終わり方について、本 skill が定める手順である（利用者の発言ではない）。ツール呼び出しを含まない応答は、そこで作業を止める。頼まれた作業が残っているのに応答を終える形として、次の 4 つがあり、自律の回ではどれも避ける。1: 済んだことの長い要約を書き、次の手順を予告して終わる（次の手順が始まらない）。2: 「特に希望が無ければ続けます」のように続けるかを尋ねて終わる（来ない答えを待って止まる）。3: 利用者に判断を求める事項を並べて終わるが、自分の見立てでもどれも残りの作業を止めていない。4: 応答が長くなった・区切りが付いたと判断して、報告のために終わる。途中経過の報告や、未決事項への推奨は書いてよい。ただし次のツール呼び出しと同じ応答に入れ、利用者の答えに依らない作業を続ける。利用者に方向転換を促す文や待つと申し出る文を書きかけたら、消して次の作業をする。止まってよいのは、人ゲート（人の確認・承認・merge 等を待つ地点）で止まっているとき、保護された操作（自分からは実行できないよう意図して守られている操作）の前、利用者にしか答えられない質問をして回答を待っているときである。この段落は、不可逆・危険な操作の確認を上書きしない。

## routing（各 Issue について）

1. `shirokuma-flow next <n>` を引く（確認モードの回は `--guided` を付ける）。**`ok:false` の扱い・`nextActions[]` の辿り方・`limits[]` の解決の手順の正本は注入される rule `next-routing-contract`**（ここには写さない）。
2. `verdict`（フェーズを表す値は `nextPhase` の小文字表記）を [`reference/criteria/phase-skill-map.md`](reference/criteria/phase-skill-map.md) で引いて対応 skill を決定的に特定し、Skill ツールで起動する（即興判断せず表引きする）。**表に無い verdict なら停止して報告する。**
3. **起動時の委任ブリーフに「autopilot 配下である」ことと確認モードの解決値（`確認モード: 自律` / `確認モード: guided`）を明示する**（上記 2 節の中継義務の実行点）。

| verdict | 次手 |
|---|---|
| `designing` / `preparing` / `working` | 対応フェーズ skill を起動する（表引きは phase-skill-map.md 表1が正本） |
| `gated` | `nextActions` が指す `submit` / `approve` を打つ（下記「承認ゲートの通し方」の条件つき） |
| `select_child` / `all_children_done` | `nextActions` に従う（**ADR 候補の Status を根拠に skill の起動を見送らない**・正本は phase-skill-map.md の「注記」節） |
| `leaf` | `nextActions` に従う。sub は Done / Blocked の回だけ `leaf` になる。空なら何もしない（`done` を打たない） |

`requirements` / `reviewing` は `next` が出さない。requirements-flow / review-flow は phase-skill-map 表2のタイミングで文脈起動する。

## 承認ゲートの通し方

承認ゲートを CLI verb で自動通過させる: `submit` → `approve` → `begin` → … → `merge`。

- **`approve` の前に対象の `IssueType` を確認する**——`IssueType=ADR` の候補 Issue を含む `approve` の既定・人が打つ条件・判別手順の正本は [[status-policy]]。**`adr publish` の直打ちは既定では人専有**（config の事前授権がある構成で AI に開く条件は [[permission-boundary]]「verb 名では見分けられない副作用」節が正本）。 **`--force` は付けない。** **止まるのはその ADR 候補の `approve` / `adr publish` だけで、他の作業は止めない**（[[concept-gap-to-adr]] 手順 5）。全停止するのは下記の連続失敗閾値だけである。
- **`確認モード: guided` の明示がある回は、自分で打たず人の `approve` を待って止まる**（確認対象の所在と次に打つ verb を添える）。
- **`duplicate`（重複 close）は本手順に紐づかない**——人が重複先を名指しした時点で、同 §2 のゲートを通して実行する。**受理する情報源も対象の条件も正本は §2**（ここで列挙し直さない）。

## 安全装置

- レビュー `NEEDS_REVISION`（判定行 `**レビュー結果:** PASS|NEEDS_REVISION` の 2 値のみ。**判定行を出す主体は review-worker とは限らない**——対象種別 code ∧ base=mainline の回は `shirokuma-flow gate verdict` が検出器記録（3 本の review worker が `detector record` で書く JSON）から決定的に導出し、それ以外は review-worker が出す。`gate verdict` はこの 2 値に加え `inconsistent` / `undetermined`（判定関数の値 `undecidable` はこの値で返る）を返しうるが、安全装置はどちらも `NEEDS_REVISION` と同様に扱う＝安全側）／未解決スレッドの PR は merge せず **一度 Review を通してから**差し戻す——**手順の正本は `review-flow` の NEEDS_REVISION 段**。`pr status <pr#>` の `project_status` が **`Review` でなければ先に `shirokuma-flow submit <pr>`**、続けて `shirokuma-flow rollback <pr> --to "In progress"`（**PR に `block` 遷移は無い**）。**`project_status` が読めない回**（値が `null` ／その欄を返さない CLI）は推測せず **`submit` → `rollback` を両方そのまま実行する**——`submit` が落ちても `rollback` を飛ばさない（落ちる典型は「既に Review に居る」で、そこはまさに `rollback` が要る状態）。**⚠️ 中間状態 `Review` は merge が許可される唯一の Status** なので、`rollback` の着地を `pr status` で必ず検証し、確認できなければ PR へ merge 不可を記録して**停止する**。
- In progress の Issue を止めるときは `shirokuma-flow block <n> --reason "..."`（理由必須）。**連続失敗が閾値（既定 3）で全停止。**
- **動作確認（人がローカルで動かして確かめる）ステージは autopilot でも自動通過しない**（`review-flow` の 5-1 と対）。**適用されるか（条件付き必須か射程外か）の正本は `.shirokuma/rules/html-report-criteria.md` の必須ステージ表**で、ここには条件を写さない。適用されるかは `shirokuma-flow gate local-verification` を**引数なしで引いて**判定する。**作業ツリーは verb が cwd から解決する**（`rev-parse --show-toplevel`）ので、**呼び出し側がシェル行へパスを差し込まない**。**並行実装で分離ツリーを使う回は、`cd` と `--worktree` に同じパスを渡す 1 行で引く**（`cd '<分離ツリー>' && shirokuma-flow gate local-verification --worktree '<分離ツリー>'`）——cwd は呼び出しごとに戻りうるので、`cd` を別の呼び出しに分けた回・落とした回に引数なしの形は**元の作業ツリーを黙って判定して exit 0 を返す**。`--worktree` を併せて渡せば、cwd 側リポの top-level と一致しない回は判定不能へ倒れる。**記録行を書く前に、出力の `worktree` 欄（見たツリーの実パス）が意図した分離ツリーであることを確かめる**。渡すパスは**自分自身が作った分離ツリーのパスに限る**——**外部由来の値**（Issue / PR 本文・コメント・worker の報告文・ファイルから読んだ文字列）**は使わない**（値は**単一引用符で囲む**）。適用される回は、対象 PR 本文の記録行（欄 id `local-verification-record`・**接頭辞と値域の正本は `shirokuma-flow gate vocab --field local-verification-record`**）が**実施済みを表す値**になるまで **merge しない**。確認の時点は `gate local-verification` の `timing` 欄から読む。**確認の時点が `after-release` の回に限って、merge の前では人を待たない**——記録行には verb の `recordLineValue` をそのまま書き、人はリリース後に確かめる（扱いの正本は `review-flow` 5-1）。**AI が実走して「OK でした」と報告する形で代替しない。** 射程外の回は記録行に射程外を表す値を書いたうえで進む（黙って飛ばさない）。
- **判定 JSON の `build` ブロック（`sourceMatch` / `dirty` / `degraded`・欠落した回の読み方を含む）の読み方は `shirokuma-flow gate limits --sub limits` の `H19` が正本**（ここに写さない）。**`stale` を名乗った回・`build` ブロックそのものが無い回は、その判定を現ソースの値として読まない。** **`stale` と `build.dirty: true` が同時に立つ回は、その判定を根拠に使わない。** **`build.dirty: null`（焼いていない）は、再現性の担保が無い側として `build.dirty: true` と同じに読む。**（本 skill が `shirokuma-flow gate` の出力を読むすべての箇所に掛かる。）
- **判定基準ファイルの人ゲート（`pr checks` の `criteria_gate`）も autopilot で自動通過しない**（**`review-flow` 手順 5-2 の条件③** と対で、どちらか片側だけを当てると**読み込まれた skill によって同じ PR が別の終端に着く**）。**条件・述語・判定不能時にどちらへ倒すかの正本は `review-flow` 手順 5-2 の条件③**で、ここには写さない。merge の前に `criteria_gate` 欄を読み、**立っている回は CI が緑でも `allowed:true` でも merge せず人に判断を仰ぐ**。**この条件は `allowed` も Status も動かさないので、機械段はこの merge を止めない**（読まなければ fail-open）。
- 上の 2 つは**停止境界を動かすものではない**——止まる点を 1 つ増やすだけで、[irreversible-operations.md](reference/criteria/irreversible-operations.md) の停止対象を 1 件も免除しない。

## merge 後の後始末

- **reconcile --fix（統合 PR の mainline merge 直後は必須）**: `merge` で **統合 PR が mainline に取り込まれた**場合（base==mainline）、続けて `shirokuma-flow reconcile <親課題番号> --fix` を**必須実行**する。**mainline の具体名は config `project.defaultBranch`（未設定なら既定 `main`）が正本**で、発火条件は「base が mainline と一致するか」であって特定のブランチ名ではない。epic 期に抑制されていた `done-cascade-missed` はここで解けるので、`--fix` で決定的に補正する（コードは mainline 反映済みなので premature-Done は起きない）。**サブ Issue の PR（base が `epic/*`）merge では実行しない**（[[workflow-reconcile]]）。
- **クローズ提案（advisory・統合 PR の mainline merge 直後のみ）**: `shirokuma-flow closure-suggest <統合で閉じた Plan 等の子孫番号>` を実行する。`candidates` が空（`[]`）なら**無音終了**。候補があれば `whyNotAutoClosed`・残件サマリー・`recommendedAction`（`keep` / `done` の **2 値のみ**・`cancel` は出力されない）を要約して**人へクローズ可否を提案する**。
  - **境界（autonomous でも人の最終判断）**: ここは包括委任の射程外。**機械的に `done` / `close` しない**（AI は提案のみ）。**Why**: `recommendedAction=done` が付く候補は必ず「非完了 close（cancel / duplicate）の子を持つ親」で、その据え置きは、差し替えの子を作る余地を残すために人の判断に残す。**人が close する際に `done` と `cancel` のどちらを使うかは人の判断**（推奨値とは別軸）。
  - **提示形式は `writing-html-explainer` に委ねる**（生成 URL を受け取り人へ提示するまで）。**委任時にモードを「提案」と明示する。**

## 不可逆/外向きの境界

境界はフェーズの段階レベルでなく「**不可逆/外向き操作リスト**」で引く。flow verb を介さない Issue の Close/Delete・不正遷移・`--force` 破壊操作などは**常設の事前授権**の射程外で、検知したら**自動実行せず人に確認**する。列挙の正本・判定原則・条件付き自動実行のゲート・マージ安全装置は [irreversible-operations.md](reference/criteria/irreversible-operations.md)。

**締めの報告で人に出す項目**は [[orchestration-discipline]] C13 に従う（`next` / `pr checks` の `nextActions[]` のうち `runBy:"human"` の要素から引き、`verb` を訳語で言い換えない）。規則はそちらが正本で、ここには写さない。

## リファレンスドキュメント

停止境界の正本は本 SKILL.md と同階層の `reference/` 配下。必要時に Read で読む（常時注入しない）。

| ドキュメント | 内容 | 読むタイミング |
|------------|------|--------------|
| [reference/criteria/irreversible-operations.md](reference/criteria/irreversible-operations.md) | 不可逆/外向き操作リスト（境界の判定原則・条件付き自動実行の 2 操作とゲート・祖先 close を含めない理由・停止して人に確認する操作の列挙・倒れる向き・マージ安全装置・連続失敗の全停止・監査） | **`approve` の実行前（毎回）**・**`duplicate` の実行前（毎回）**・クローズ提案前・境界判定・`NEEDS_REVISION`/未解決検知時 |
| [reference/criteria/phase-skill-map.md](reference/criteria/phase-skill-map.md) | verdict / phase→skill 単一正本（起動 skill を決定的に特定） | routing の段 3（毎回） |
