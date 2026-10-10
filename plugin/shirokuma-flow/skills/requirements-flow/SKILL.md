---
name: requirements-flow
description: Requirements フェーズを独立に扱い、要件定義・仕様策定と ADR 候補の審議を行う。Use when 要件を定義するとき、仕様を策定するとき、ADR 候補を審議するとき。
model: opus
---

# requirements-flow（Requirements・独立フェーズ）

## 起動直後

Bash で `shirokuma-flow rules inject --scope orchestrator` を実行し、**出力の `<rule-file>` 要素を本タスクの規範として読む**。`<rule-file>` の外（ヘッダ行）に規範は載らない。

## 流れ

要件・意思決定・仕様を固める orchestrator。**要件 / 仕様は Status を操作しない**（statusレス）。ただし **ADR は候補 Issue の状態機械で扱う**（候補=Issue・確定=正本ファイル `adr.dir`・Discussions は一方向ミラー・**番号は ADR ID が正本**）。要件・仕様の策定は `requirements-worker`、AgDR の Why 調査は `research-worker` へ委任する（委任ブリーフに**当該 worker scope の規範要旨**を明記する・正本 [[skill-authoring]]）。

## routing

本 skill は `next` 非経由で起動する（正本は `autonomous-flow` の `reference/criteria/phase-skill-map.md` 表2）。`next` は `requirements` を返さない。

1. **先に要件作業**（`requirements-worker` へ委任。ADR 候補の進行は `shirokuma-flow status <候補#>`）。起動された回は要件が未確定である前提で入る。
2. 要件・ADR の作業が一段落したら `shirokuma-flow next <n>` を引く（確認モードの回は `--guided` を付ける）。受け渡し先を決めるためだけに使う。
3. **手順の正本は注入される rule `next-routing-contract`**（`ok:false` の扱い・`verdict` の下表引き・`nextActions[]` の辿り方・`limits[]` の解決・確認モードの中継、ここには写さない）。

| verdict | 次手 |
|---|---|
| `gated` | `nextActions` が指す `submit` / `approve` を打つ（下記「ADR の状態遷移」の条件つき） |
| `designing` / `preparing` / `working` | 完了後の受け渡し先（`design-flow` / `prepare-flow` / `implement-flow`） |
| `select_child` / `all_children_done` / `leaf` | `nextActions` に従う |

## ADR の状態遷移（打ち方）

不可逆 / 構造的な決定は **候補 Issue（IssueType `ADR`）** で起票する。本文=決定の枠、**Why 審議・却下トレイルは Issue コメント**に積む（対話駆動）。

1. `shirokuma-flow submit <候補#>`。
2. **approve（確定）の直前チェック**: 候補 Issue の **title ↔ body の決定内容が整合**しているか（title が body で固めた決定を正しく表すか）を確認し、不整合なら approve せず title / body を先に訂正する（確定後の訂正は `adr publish --amend`）。
3. **`approve` は既定で orchestrator が打つ**。`IssueType=ADR` 候補の `approve` の既定・人が Accept する条件・判別欄（`shirokuma-flow gate vocab --field adr-autonomy-boundary`）の正本は [[status-policy]]（ここには写さない）。**宣言は空行で挟んだ単独の 1 行として書き、本文の他の場所で欄名の字を並べて書かない**——装飾・引用・HTML タグの中でも「宣言に見える行」として数えられ、素の宣言 1 行と併記すると「欄が複数」で deny される（規範の定型句をそのまま候補本文へ引用するとこれに当たりうる。触れる必要があるときは別の語で書く）。通せない回・判定に迷う回は止めて人に確認する（**`--force` で通さない**）。**宣言が緩める側の候補は `approve` では確定しない**——人が `shirokuma-flow adr publish <候補#> --accept-boundary-loosening` で確定する（素の `approve` / 素の `adr publish` は人が打っても CLI が拒否する）。人が打つ形は `shirokuma-flow next <候補#>` の `nextActions[]` の `adr publish` 要素の `args` が運ぶ（`runBy:"human"` と組で読む値で、AI は打たない）。宣言に不備（欠落・値域外・複数）がある候補では、`next` は候補本文の宣言を直す次手を返す。
4. **公開は手順 3 の `approve` 自体が行う**（ADR 候補への `approve` は Status 遷移だけでなく、内部で確定版を Discussion(adr) へ公開＋Issue ⇄ Discussion リンク＋索引追記まで実行し `done` へ運ぶ）。**この公開処理は審議を経た `Review` からの `approve` に限る**（遷移元が `Review` の回だけ公開する）——`Backlog` から `submit` を飛ばして `approve` した回は公開せず汎用パスで `ToDo` へ進むだけなので、本 skill の手順（1 の `submit` を先に打つ）どおりに進めること。**`shirokuma-flow adr publish <候補#>` の直打ちは既定では人専有**——この verb 名は候補ごとの条件を持たないため（`.shirokuma/rules/permission-boundary.md` 該当条項・hook `adr-publish`）。**手順 3 で通した `approve` が結果として同じ公開処理を行う**のであって、通常の経路で AI が別途 `adr publish` verb を呼ぶことはない（授権のある構成での例外は手順 5 に閉じる）。却下は **`cancel`**（Discussion を作らず閉じた Issue が墓場）。
5. **ADR の手作業（Discussion 本文書換・`gh api`）はしない**——「緩めない」と宣言した候補の確定は手順 3 の `approve` に集約する（緩める側の候補は手順 3 の人が打つ形）。**`adr publish` の直打ちは既定では人専有**で、プロジェクトの config が事前授権している構成でだけ（打ってよいかは `shirokuma-flow next <候補#>` の `nextActions[]` の `adr publish` 要素が `runBy:"ai"` であることで引く——授権・宣言欄・未確定・未 publish の連言を解決した値）、**自律の境界を緩めないと宣言欄で宣言した未確定の候補（Issue が OPEN・対応表に未記載か、載っていても対応表の行と正本ファイルの両方で Discussion が未記録の再開待ち＝採番済みで、Discussion の作成前、または作成後・記録前に止まった回）を素の形（`shirokuma-flow adr publish <候補#>` を 1 本だけの行で・追加の引数なし）で確定する回に限り** AI も打ってよい——hook の guard が同じ条件で判定し、それ以外は deny する。**打つ前に停止境界 criteria §1 の内容検査（決定文の全要素・5 観点）を授権下でも課す**（授権で変わるのは実行主体だけで、検査は落とさない）。授権を自分で書き足さない（正本は [[permission-boundary]]）。再公開・訂正が要る回（`adr publish --amend` 等）は授権の有無によらず人が行う。
6. **確定できる候補が複数あるときは、先にまとめて確定し、確定後の追従は最後に 1 回で済ませる**。人へ渡す候補があるときは、AI が確定できる分の追従を待たせずに済ませる（人の確定の時期は AI からは決められないので、2 回目の追従が生じうる）。
7. **確定後の追従の手順は、確定の verb が返す `next`（行う順のリスト）が正本**——その順に行う（ここには写さない）。

**候補から派生する実装 Issue / EPIC は、候補が Accept / publish されるのを待たずに起票・着手してよい**（Why が候補 Issue に記録されていれば足りる・[[concept-gap-to-adr]] 手順 5）。起票した派生課題は ADR（候補 Issue／公開済みなら Discussion）へリンクする。

## 確認ビュー

要件レビューは HTML 化要否・生成の発火条件（既定は生成しない）・記録行の欄 id（`confirmation-view-record` / `decision-hesitation`）と値域・生成の委任先の正本は [[html-report-criteria]]（ここには写さない）。**書き込み経路**: 生成した回も生成しなかった回も `issue context <n>` → 本文編集 → `issue push <n>`（状態は触らない）で対象 Issue 本文の BLUF 位置へ記録行を残す（行の有無を生成／非生成の分岐に依存させない）。

## 停止境界

`ok:false` の回・`verdict` が上表に無い回・`nextActions` に `runBy:"human"` が現れた回・**自律の境界を緩める ADR 候補の確定**（宣言欄が緩める側の回。人が確定する形は [[status-policy]] の `approve` 条項が正本で、素の `approve` ではない。**緩めない側の候補は停止境界ではない**）・`adr publish` の直打ち（IssueType によらず既定は人専有。config の事前授権がある構成で AI に開く条件は [[permission-boundary]]「verb 名では見分けられない副作用」節が正本）。境界の定義そのものは注入される rules の自律境界節が正本で、ここには写さない。

**締めの報告で人に出す項目**は [[orchestration-discipline]] C13 に従う（`next` / `pr checks` の `nextActions[]` のうち `runBy:"human"` の要素から引き、`verb` を訳語で言い換えない）。規則はそちらが正本で、ここには写さない。

## リファレンスドキュメント

本 SKILL.md と同階層の `reference/` 配下。委任ブリーフにパスを明示し、必要時に Read で読む（常時注入しない）。

| ドキュメント | 内容 | 読むタイミング |
|------------|------|--------------|
| [reference/criteria/adr-triage.md](reference/criteria/adr-triage.md) | ADR 起票判定基準（候補 Issue を作るか／通常進行で足りるか・Why-first 原則・候補 Issue の階層配置・知識の配置境界） | 起票要否判定時 |
| [reference/templates/adr-candidate.md](reference/templates/adr-candidate.md) | ADR 候補 Issue 本文雛形（Why/決定/却下案/帰結・公開前の What として起案する形・軽量版あり） | ADR 候補 Issue 起案時 |
