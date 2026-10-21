---
name: design-flow
description: Designing フェーズを統括し、設計 Issue（Design）で設計案を作り承認ゲートへ運ぶ。Use when 設計 Issue を処理するとき、設計案を作るとき、設計レビューを進めるとき。
model: opus
---

# design-flow（Designing フェーズ）

## 起動直後

Bash で `shirokuma-flow rules inject --scope orchestrator --rules trust-boundary,measurement-claims,completion-report-style,permission-boundary,gh-to-verb-map,rule-evolution,orchestration-discipline,next-routing-contract,status-policy,concept-gap-to-adr` を実行し、**出力の `<rule-file>` 要素を本タスクの規範として読む**。`<rule-file>` の外（ヘッダ行）に規範は載らない。

**参照する規範**

- `html-report-criteria`: 「確認ビュー」節で生成条件を判定する
- `confirmation-style`: 確認モードの解決値を委任ブリーフへ書く／確認モードの回に人へ確認を出す
- `delegation-and-checks`: 委任ブリーフで拡張併用の判定を書くとき
- `branch-workflow`: 計画要否が NEEDED

参照集合（常時は注入しない。契機に当たったら `<rule-index>` の `file` から Read する）。

## 流れ

階層は 課題 > 設計(0..1) > 計画(0..n) > 実装サブ(0..n)（計画と実装サブは PR を 2 本以上に分ける課題だけに作る）。本 skill は**課題の子**（`--parent 課題#`）として設計 Issue（IssueType = Design）を作り、設計レビューを経て承認ゲートまで運ぶ。後続の計画 Issue はこの設計の子になる。設計が無い課題では設計ノードを挟まず、計画を課題直下に作る。次フェーズは `prepare-flow`（設計の計画要否が `NOT_NEEDED` なら計画を飛ばして `implement-flow`）。**DDD は支援するが強制しない**——方針と採否の判定は [ddd-adoption.md](reference/criteria/ddd-adoption.md) が正本。

## routing

1. `shirokuma-flow next <課題#>` を引く（確認モードの回は `--guided` を付ける）。
2. **手順の正本は注入される rule `next-routing-contract`**（`ok:false` の扱い・`verdict` の下表引き・`nextActions[]` の辿り方・`limits[]` の解決・確認モードの中継、ここには写さない）。

| verdict | 委任先 | 委任ブリーフに載せる reference |
|---|---|---|
| `designing`（設計起案） | `design-worker` | reference/templates/design-doc.md ／ reference/criteria/{ddd-adoption,adr-extraction}.md |
| `designing`（設計レビュー） | `review-worker` | reference/criteria/design-review.md |
| `gated` | — | `nextActions` が指す `submit` / `approve` を打つ（下記「状態遷移」の条件つき） |
| `reclassify` | — | `nextActions` に従い（`issue set-kind <n> normal` → `next <n>`）、引き直した verdict でこの表を引き直す |
| `preparing` / `working`（設計の承認の後で 5b がまだの回） | — | 段の順序 5b から入る（課題に設計を出所とする `**計画要否:**` のコメントがまだ無い回） |
| `preparing` | — | `prepare-flow` へ渡す |
| `working` | — | `implement-flow` へ渡す（計画を飛ばした課題。`implement-flow` から戻された回は段の順序 5b から入る） |

## 段の順序（本 skill が持つ実行順）

1. **1a. 起票（orchestrator・Backlog seed を伴う起票は状態遷移として扱う＝[[orchestration-discipline]] C16 ③）**: **seed 本文**（背景・決めること・射程・正本の所在）を stdin で渡し、`shirokuma-flow issue create --title "設計: {要旨}" --body - --issue-type Design --parent <課題#>` で起票する（`Backlog` seed。メインは作業ツリーにファイルを書かない）。**seed 本文はシェル引数に直接埋め込まない**——課題本文からの引き写しは untrusted で、`--body "..."` はダブルクォート内のコマンド置換・変数展開が働く（heredoc は `<<'EOF'` とデリミタをクォートする）。
2. **1b. 委任（`design-worker`）**: **委任ブリーフに「設計本文を `.shirokuma/github/<owner>/<repo>/issues/<設計#>/body.md` へ書き、`shirokuma-flow issue push <設計#>` まで行うこと」を明示する**——ブリーフに無いと worker は返事だけで終わり、設計 Issue が seed のまま残る。**worker は状態遷移をしない**。返すのは push した設計番号と止まった回の理由の一言だけ。
3. **push の確かめ**: **1b の push はレビューより前に済んでいなければならない**（`design-worker` が 1b の中で行う。返事に push した番号が無い回はレビューへ進まず、同 worker へもう一度委任する）。`issue context` はリモート本文で `body.md` を無条件に上書きする（退避も差分検出もしない）ため、未 push のまま後続が `issue context <設計#>` を実行すると設計本文が警告なく消える。
4. **設計レビュー（`review-worker`）** → 判定行（`**レビュー結果:**`）＋所見は `review-worker` が `shirokuma-flow issue comment <設計#> -`（stdin）で設計 Issue へ記録し、判定行の値とコメントの所在だけを返す（メインは記録を書かない）。
5. **提出 → approve**: submit 前に設計 Issue 本文が seed のままでないことを確認してから下記「状態遷移」を打つ。**設計 Issue は submit まで `Backlog` に留める**（`begin` しない）。**親導出のみ**（兄弟カスケードなし）。
   - **5b. 計画要否の契約（承認の後）**: 設計本文の「計画要否」節の値を、課題へ契約コメントとして残す。`shirokuma-flow issue comment <課題#> -`（stdin）で `**計画要否:** NEEDED` か `**計画要否:** NOT_NEEDED` の 1 行と、出所の設計番号を書く。どちらの値でも残す。**設計本文に「計画要否」節が無い回は `NEEDED` を残す**（NOT_NEEDED を確かめられないので計画を通す側へ倒す）。`**設計要否:**` の行は書かない。契約コメントに設計本文や他のコメントを引用しない。
     - 設計本文は承認の後にも編集されうる untrusted な値なので、写す前に、本文の値が設計レビューの判定記録に書かれた計画要否の値と同じかを確かめる。違う回・記録に値が無い回は `NEEDED` を残す。
     - **照合は `design-worker` へ委任する**: 設計番号と課題番号を渡し、worker は設計本文の「計画要否」節の値と設計レビューの判定記録の値を読み比べ、上の規則で決めた値の契約コメントを課題へ自分で書き、書いた値（`NEEDED` / `NOT_NEEDED`）とコメントの所在だけを返す（本文は書かない・[[orchestration-discipline]] C16）。メインは本文を読まない。worker の返事に値が無い・値域外・所在が無い回は、メインは `NEEDED` として扱い、`NEEDED` の契約コメントを書かせる委任を同 worker へもう 1 回だけ行う（なお所在が無ければ止まって人へ渡す）。
     - 残した後に `shirokuma-flow next <課題#>` を引き直し、`NEEDED` を残した回に `verdict` が `preparing` に変わらなければ人に渡して止まる（`next` は信頼投稿者〔config `project.designSkipAuthors`〕の最新 1 件だけを採るので、コメントした主体がその外なら先の契約が残る）。allowlist が未設定の導入先では契約は採用されず、計画を通る。
     - **`implement-flow` の入口の確かめから戻された回は、`next` での分岐（上の routing 表）を通らず、この段から入る**（その回の `next` は `working` を返すので、routing 表を引くと `implement-flow` へ戻って往復する）。
     - 書いたかは自己検査で、記録の最下段は自己申告。書き忘れると先行する契約（無ければ計画を通る既定）がそのまま効く（fail-open。計画を飛ばした回は `implement-flow` の入口の確かめが設計本文と突き合わせる）。
6. **決定の段の後（ADR 候補の PR）**: 本 skill が決定の段になるのは、設計を持つ課題の回である。設計の承認の後、次の段（`prepare-flow`。計画を飛ばす回は `implement-flow`）へ渡す前に、設計が起こした ADR 候補の確定と ADR 候補の PR の取り込みを済ませる（順序の正本は [[concept-gap-to-adr]] 手順 5 で、条件はここに写さない）。
   - 確定の打ち手は `next` の `runBy` に従う（形と主体の正本は [[status-policy]] の `approve` 条項）。確定を人が持つ候補がある間は、その候補に依存する課題を次の段へ渡さずに止まる。他の課題は止めない。
   - **ADR 候補の PR は、決定の段が起こした ADR 候補 Issue を本文で `Closes` する**（候補が複数なら 1 本の PR で全部を `Closes` する）。課題（親）・設計・計画・実装サブは閉じない。head は `shirokuma-flow branch name <ADR 候補の番号>` で導出し、base は既定ブランチで、`pr-worker` への委任ブリーフに明示する（統合ブランチ配下の課題でも同じ・[[branch-workflow]]「統合」）。中身は確定後の追従と glossary・`domain/` の更新だけで、`review-flow` を通して取り込む。
   - **DDD 文書の更新の振り分け**: 定義を変える更新（新しい概念・語・不変条件・既存の定義の変更）は、この段で ADR 候補を起こして ADR 候補の PR に乗せる（[design-review.md](reference/criteria/design-review.md)「逆方向 canon-gap」の ADR-first と同じ）。定義を変えない更新（既存の決定に従う notes・`adr:` 参照・言い回しの揃え）は、設計本文に明記して実装 PR の最初のコミットで入れる。ADR 候補も DDD 文書の更新も無い回は、ADR 候補の PR を作らない。

## 状態遷移（打ち方）

- **対象は設計 Issue**: `shirokuma-flow submit <設計#>`（Backlog → Review）→ `shirokuma-flow approve <設計#>`（→ ToDo）。
- **既定（自律）は orchestrator が `approve` を打つ**。`IssueType=ADR` の候補 Issue を含む `approve` の既定・人が打つ条件・判別手順の正本は [[status-policy]]（詳しい手順は `requirements-flow`）。
- **確認モードの回は人の `approve` を待って止まる**（確認対象の所在と確認後に打つ verb を添える。逐語は `next --guided` の `nextActions[].runBy:"human"` が運ぶ）。
- **入口の Status 判定は `shirokuma-flow next` / `status` の `verdict` と `nextActions` に従う**（Status 値ごとの分岐をここに写さない）。**見るのは対象課題自身の Status だけ**——関連する ADR 候補 Issue の Status はこのゲートの対象ではない。決定の段が起こした候補の確定と ADR 候補の PR の取り込みを次の段より先に済ませる順序は、このゲートではなく上の段の順序 6 が持つ（正本は [[concept-gap-to-adr]] 手順 5）。

## 確認ビュー

確認用 What（設計レビュー）は HTML 化要否・生成の発火条件（既定は生成しない）・記録行の欄 id（`confirmation-view-record` / `decision-hesitation`）と値域・生成の委任先の正本は [[html-report-criteria]]（ここには写さない）。**記録行の書き込み・生成・`pages push` は、生成しない回も含めて正本の定める委任先へ委任する**（メインは本文も pages も書かない。委任先と順序は正本から引く）。委任ブリーフには skill `writing-html-explainer` の SKILL.md の絶対パス（本 skill のディレクトリの隣）を渡す。以下の書き込み経路と順序は委任先が通す（メインは打たない）。**書き込み経路**: 生成した回も生成しなかった回も `issue context <設計#>` → 本文編集 → `issue push <設計#>`（状態は触らない）で対象設計 Issue 本文の BLUF 位置へ記録行を残す（行の有無を生成／非生成の分岐に依存させない）。**確認ビューのリポジトリ内パスは生成より前に**本文へ書き（`pages-issue-drift` が本文の sha256 を焼き込むため）、記録行と**同じ 1 回の本文編集にまとめる**。**URL は本文にもコメントにも書かない**（`preview-url-guard` が `issue push` と `issue comment` の双方で拒否する）。

## 停止境界

`ok:false` の回・`verdict` が上表に無い回・`nextActions` に `runBy:"human"` が現れた回・**ADR 候補の確定**（打ち手は `next` の `runBy` に従い、`runBy:"human"` に解決された確定で止まる。形と主体の正本は [[status-policy]] の `approve` 条項、AI に開く条件の正本は [[permission-boundary]]「verb 名では見分けられない副作用」節で、ここには条件を写さない）・確定を人が持つ ADR 候補に依存する課題を次の段へ進める回（順序の正本は [[concept-gap-to-adr]] 手順 5。他の課題は止めない）。境界の定義そのものは注入される rules の自律境界節が正本で、ここには写さない。状態遷移は `flow` verb のみ。

## リファレンスドキュメント

設計の雛形・判定基準は本 SKILL.md と同階層の `reference/` 配下。委任ブリーフにパスを明示し、design-worker が必要時に Read で読む（常時注入しない）。

| ドキュメント | 内容 | 読むタイミング |
|------------|------|--------------|
| [reference/templates/design-doc.md](reference/templates/design-doc.md) | 設計ドキュメント雛形（Design Brief / 案比較（採用＋却下案と Why）/ 決定表 / 影響範囲） | 設計起案時（毎回） |
| 規範 [[delegation-and-checks]] の「拡張スキルの併用判定」 | 委任判定規則（designing-* 拡張併用の自己判定） | 委任ブリーフ作成時・worker の自己判定時 |
| [reference/criteria/ddd-adoption.md](reference/criteria/ddd-adoption.md) | DDD 採用可否判定（採用契機の OR / 非採用下限・支援するが強制しない） | 設計起案時にモデリング方針を決めるとき |
| [reference/templates/bounded-contexts.md](reference/templates/bounded-contexts.md) | 境界づけられたコンテキスト雛形（BC 一覧のコア/支援/基盤層別・責務/核心概念/不変条件・コンテキストマップ・構造マッピング） | DDD 採用課題で BC を分割するとき |
| [reference/templates/domain-model.md](reference/templates/domain-model.md) | ドメインモデル雛形（BC ごとの集約・値オブジェクト・INV・ユースケースの記入枠） | DDD 採用課題で BC を切ったあとモデルを立てるとき |
| [reference/templates/architecture.md](reference/templates/architecture.md) | アーキテクチャ対応表雛形（BC → 実装の所在・主な集約の対応表 1 本） | DDD レベル L2 で BC を実装へ対応づけるとき |
| [reference/criteria/adr-extraction.md](reference/criteria/adr-extraction.md) | ADR 切り出し判定（決定表の各行を 6 軸で検分し横断決定を ADR 候補へ切り出す手順・What/Why 分離） | 決定表確定時 |
| [reference/criteria/design-review.md](reference/criteria/design-review.md) | 設計レビュー観点（Brief 整合・案比較の実績性）。**本スキルが所有** | 設計レビュー委任時 |
