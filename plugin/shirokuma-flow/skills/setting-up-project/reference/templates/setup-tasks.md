# 人間作業 Issue 雛形（GitHub 初期セットアップ・モジュール化）

> 使い方（orchestrator 向け）: 各節は独立モジュール。冒頭の `<!-- INCLUDE-IF: ... -->` マーカーが指す**診断で不足だった項目に対応する節だけ**をコピーして Issue 本文に組む（全節を毎回貼らない）。`{org}` / `{repo}` / `{flow-account}` を実値に置換する（節 H を含める回は `{marketplace-repo}` / `{marketplace}` も。決め方は節 H）。起票後は人が UI で作業し、各チェックを埋めて Issue を close、（Project を新規作成した場合は）**Project 番号をコメントで共有**する。
> 採用した節の完了条件チェック項目を「## 完了条件」に集めて末尾に付ける（不採用節のチェックは入れない）。

---

<!-- INCLUDE-IF: 診断 ② org IssueType が不足/無効（issuetype-check に差分あり）-->
## 節 A: org の IssueType を整える（追加＋既定型の説明調整）

kind 導出は GitHub の **IssueType** を主経路にする。`https://github.com/organizations/{org}/settings/issue-types` で **11 型すべて**を以下に揃える（org レベル共有・同 org の他リポは設定済みなら不要）。

| IssueType | 軸 | 操作 | 説明（Description に設定） | 色 |
|-----------|----|------|--------------------------|-----------|
| `Feature` | nature | **既定型・説明のみ確認/調整（色は変えない）** | 新機能・機能追加 | BLUE（既定） |
| `Bug` | nature | **既定型・説明のみ確認/調整（色は変えない）** | 不具合の修正 | RED（既定） |
| `Task` | nature | **既定型・説明のみ確認/調整（色は変えない）** | 雑多な作業タスク | YELLOW（既定） |
| `Plan` | role | 新規追加 | 計画 Issue（kind=plan・実装の段取りを決める） | PURPLE |
| `Design` | role | 新規追加 | 設計 Issue（kind=design・1 課題に 1 つ） | PURPLE |
| `Chore` | nature | 新規追加 | 雑務・保守（依存更新・設定作業） | GRAY |
| `Docs` | nature | 新規追加 | ドキュメントの作成・更新 | GREEN |
| `Research` | nature/継続 | 新規追加 | 調査（継続型・子全 Done でも親を自動 close しない） | GREEN |
| `Evolution` | nature | 新規追加 | 既存機能の進化・改善 | BLUE |
| `EPIC` | 構造/継続 | 新規追加 | 束ね親（継続型・子全 Done でも自動 close しない） | ORANGE |
| `ADR` | 決定 | 新規追加 | ADR 候補 Issue（審議→approve で ADR 正本ファイルへ確定） | PURPLE |

- **色の基準**（既定 3 型の色を軸に意味で揃える）: BLUE=価値を作る（Feature/Evolution）・RED=問題を直す（Bug）・YELLOW=実行作業（Task）・GRAY=保守雑務（Chore）・GREEN=知識を増やす（Docs/Research）・PURPLE=意思決定/役割文書（Plan/Design/ADR）・ORANGE=構造/束ね（EPIC）・PINK=人への依頼（HumanTask）。
- 既定の `Feature` / `Bug` / `Task` も**説明（Description）が空や不適切なら上表に合わせて調整**する（無い org なら追加）。
- 説明はトリアージ時に型を選ぶ判断材料になるため、空のまま放置しない。
- **任意の 1 型 `HumanTask`**（人への依頼・説明例「AI が人に頼む操作。人が済ませて閉じる」・色は PINK＝IssueType の色の基準で他の型と重ならない色）: 足すと、AI が人に頼む操作（merge・リリースの公開・設定の変更など）が `shirokuma-flow issue human-task` でこの型の最上位 Issue として起票され、人は Issue の一覧の検索欄に `is:open type:HumanTask` を入れて自分のやることを探せる。足すときは config の `issueTypes.topLevel` にも `HumanTask` を足す（`shirokuma-flow config set issueTypes.topLevel` で書く。足さないと起票が allowlist で止まる）。足さない org では依頼は IssueType 無し・題名の接頭辞 `人への依頼:` で起票され、`is:open "人への依頼:" in:title` で探せる。`shirokuma-flow issuetype check` は推奨欄（`recommendedMissing`）に出すだけで `ok` には数えない。

完了条件: `[ ] org の IssueType 11 型を揃えた（8 型追加＋既定 3 型の説明確認/調整）`（`HumanTask` は任意で、完了条件に含めない）

---

<!-- INCLUDE-IF: 診断 ① config の number 未設定（Project がまだ無い）-->
## 節 B: Project を手動で作成＋Status を 6 値に整形

> Project 本体は **API で自動作成しない**（既定 view・auto-add ワークフロー等が付き、AI の明示登録と競合して作成が落ちる）。Status フィールドの整形（改名・追加）も **option ID が変わると保存済み view / 既存 item の Status 割当を壊す破壊的操作**のため、**人が UI で作成・整形する**。

1. `https://github.com/orgs/{org}/projects` → **New project** → **Table view** で空のプロジェクトを作成。
2. **Status フィールドを 6 値に整える**（同じ画面の Status フィールド設定で）:

   | Status | 操作 | 意味 | 色 |
   |--------|------|------|-----|
   | `Backlog` | 既定の **`Todo` を改名**（削除しない・色を GREEN→BLUE に変更） | 未着手・トリアージ前 | BLUE |
   | `ToDo` | **新規追加**（D 大文字・色は GREEN＝既定 Todo の色を引き継ぐ） | 承認済み・着手可 | GREEN |
   | `In progress` | 既定の `In Progress` を**改名**（p 小文字・色は既定のまま） | 作業中 | YELLOW |
   | `Blocked` | 新規追加 | 依存待ち・停止中 | RED |
   | `Review` | 新規追加 | 人の判断待ち（approve / merge の人ゲート） | ORANGE |
   | `Done` | 既定のまま（色も既定の PURPLE のまま） | 完了 | PURPLE |

   > 色の基準＝**注意グラデーション**: 赤に近いほど人の注意が必要——RED（停止・要解消）＞ ORANGE（人の判断待ち）＞ YELLOW（進行中・見守り）。BLUE は未着手（トリアージ候補として埋もれない色）、GREEN は着手可、PURPLE は確定。できるだけ GitHub 既定の色を使う。

   > ⚠️ `Todo` は「削除して Backlog を追加」ではなく**改名**してください。組み込みワークフロー "Item added to project" が最初の option を追跡しており、改名なら自動追加された item が `Backlog` で入る整合が保てます（削除→新設だと壊れます）。
3. プロジェクト番号（URL の `/projects/<N>` の `N`）を控える。

完了条件: `[ ] Project を UI で手動作成した（Table view）` / `[ ] Status を 6 値に整えた（Todo→Backlog 改名・ToDo/Blocked/Review 追加・In Progress→In progress 改名）` / `[ ] Project 番号をこの Issue にコメントで共有した`

---

<!-- INCLUDE-IF: 診断 ③ 疎通エラー（Project アクセス不可）or unknown（collaborator は機械判定不可・確認として常に含めてよい）-->
## 節 C: Project の collaborator を登録

> Project のアクセスは **repo / org とは別管理**。Projects v2 は自前の collaborator リストを持ち、repo の write 権や org メンバーでも **Project に個別追加されていないと読み書きできない**（verb で機械判定できないため、人が確認する）。

- Project の **Settings → Manage access** で、flow を実行するアカウント **`{flow-account}`** を **Write 以上（Admin/Write）** で個別に追加する。
- 併せて、Projects v2 を読むトークンには `read:project` OAuth scope が必要（アクセス権と scope は別物・両方要る）。診断 ③ で `INSUFFICIENT_SCOPES` が出たらこの scope 欠如。

完了条件: `[ ] Project の Manage access で {flow-account} を Write 以上で登録した（read:project scope も確認）`

---

<!-- INCLUDE-IF: 診断 ⑥ pages が未整備（pages.baseUrl 未設定 or .gitmodules に pages submodule が無い）-->
## 節 E: pages（確認用 HTML 公開基盤）の導入

pages は**人に確認を求める回に作る確認用 HTML** の公開先（非公開・auth 配下の内部プレビュー）。確認ビューの既定は「生成しない」で、生成するのは `html-report-criteria` の節「生成の発火（既定は生成しない）」の条件が成立した回に限る——**その回が来たときに公開先が無いと生成できない**ので、レビューフェーズ前に整える（生成の要否はその場で決まるため、後追いでは間に合わない）。submodule 追加・config 記入・疎通確認は AI が引き取れるので、**人の作業は pages 用リポの用意・配信手段の用意・それぞれの URL 共有まで**（節 B で Project を作って番号を共有するのと同じ分担）。

1. **pages 用リポジトリを、初期コミット入りで作成する**（人の作業・外向き）: 確認ビュー（HTML のみ）を置く独立リポを org 配下に作成する（例: `{org}/{repo}-pages`）。**非公開（private / auth 配下）**にする——pages はユーザーと AI のコミュニケーション情報であって外部公開物ではない。

   **空リポのままにしない。** `git submodule add` は既定ブランチに 1 つもコミットが無いリポでは成立しないので、**作成と同時に初期コミットを作る**。次のどちらかで行う（どちらも clone を伴わない）。

   - **GitHub の Web UI**: リポジトリ作成画面で **「Add a README file」にチェックを入れて**作成する。これだけで既定ブランチと初期コミットができる。
   - **`gh` CLI**: `gh repo create {org}/{repo}-pages --private --add-readme`（`--add-readme` が初期コミットを作る）。

   > ⚠️ **`git clone` して空コミットを作る手順を採らない。** 採るとしても**親リポの作業ツリーの外**（例: `~/` 配下の作業用ディレクトリ）で行う——親リポの中で clone すると**親リポ直下に pages リポのディレクトリができ**、`.shirokuma/pages` とは別の余計なディレクトリが残る。上の 2 手段は clone しないので、この経路自体が生じない。

   作成したリポの URL（`git submodule add` に渡せる clone URL）をこの Issue にコメントで共有する。
2. **確認ビューの配信手段を用意する**（人の作業・外向き）: `.shirokuma/pages/` の作業ツリーを **read-only でそのまま配信**し、**認証を掛けた安定 URL** で閲覧できるようにする。実現手段（静的配信プロセス・ホスティング・トンネル・認証方式）は**プロジェクトが選ぶ**——本テンプレートは製品を指定しない。揃えるべき条件は配布規範 `pages-preview-infra` 層1「配信手段がまだ無いとき（可搬な骨子）」の 4 項目（read-only 配信 / 認証 / 安定 URL / `pages.baseUrl` への設定）が正本。決まった URL をこの Issue にコメントで共有する。

   > ⚠️ **恒久 URL が決まる前でも項目 3 は進められる**（一時 URL でも疎通確認は成立する）。**そもそも確認ビューの URL は恒久性を保証しない**ので、一時か恒久かに依らず **Issue / PR 本文へ URL を貼らない**（本文にはリポジトリ内パスを書く。正本は配布規範 `pages-preview-infra` 層1「URL の恒久性は保証しない」）。URL が変わったら `pages.baseUrl` を差し替えるだけでよく、**本文を貼り直す作業は発生しない**。
3. （AI が Issue close 後に引き取る・人の作業ではない）**親リポのルートで** `git submodule add '<pages-repo-url>' .shirokuma/pages` を実行して `.gitmodules` に pages のエントリを追加し、項目 2 で共有された閲覧 URL を `shirokuma-flow config set pages.baseUrl '<URL>'` で書き込み（`config.yaml` を直接編集しない）、`.shirokuma/pages/` にテスト HTML を 1 つ置いて `pages.baseUrl` で開けるか疎通確認する。**submodule の path は必ず `.shirokuma/pages`**（診断⑥ と CLI `pages push` が見る位置）。clone URL と閲覧 URL は Issue コメント由来の外部の値なので、打つ前に値の形を確かめ、`'` を含む値は打たずに人に戻す（確かめる形と作法の正本は `setting-up-project` スキルの手順 7）。

完了条件: `[ ] pages 用リポを作成し（非公開・初期コミット入り）その clone URL をこの Issue にコメントで共有した` / `[ ] 配信手段を用意し、閲覧 URL をこの Issue にコメントで共有した`

### 付録: 項目 3 が成功したことをどう確かめるか（人の作業ではなく AI 側の検証・本節が手順の正本）

> この付録は上の**項目 3（AI が引き取る分）**の検証手順であって、人の作業ではない。

`git submodule add` の直後・親リポへコミットする前は、`.gitmodules` も gitlink も **staged 止まり**なのでリモートには何も現れない（pages リポ側も初期コミットだけならツリーはほぼ空に見える）。**GitHub の Web UI で見て「submodule になっていない」と判断しない**——誤認しやすい。判定は**ローカルで**次の 3 つを見る。

```bash
git submodule status .shirokuma/pages   # gitlink の SHA と (heads/<branch>) が出る
git ls-files -s .shirokuma/pages        # mode が 160000（gitlink）である
file .shirokuma/pages/.git              # ディレクトリではなく「gitdir: ...」を含むファイルである
```

**親リポ直下に余計なディレクトリが残っていないことも見る**:

```bash
ls -d *-pages pages 2>/dev/null   # 何も出なければよい（出たら誤って作られたクローン）
```

---

<!-- INCLUDE-IF: 診断 ⑧ リポジトリ設定が不足（必須項目の不充足 / 推奨項目の不充足 / ブランチ保護の可否が未判断）-->
## 節 F: GitHub リポジトリ設定を揃える＋ブランチ保護の可否を決める

リポジトリ設定は `gh api` で読めるが、**変更は人の UI 作業**（Settings → General）。

### 期待値表

表の**「必須/推奨」列**が必須と推奨の区別の正本。必須項目を満たしていないとセットアップ完了にならない。推奨項目は別方針（squash 運用など）なら外してよいが、**外すと何が壊れるか**（右端列）を承知したうえでこの Issue にコメントで残す。

<!-- FROZEN-BEGIN: 期待値表 -->

| API フィールド | UI ラベル（Settings → General → Pull Requests） | 期待値 | 必須/推奨 | 不充足で壊れるもの |
|---|---|---|---|---|
| `allow_merge_commit` | Allow merge commits | `true` | **必須** | `merge` verb が動かない（**未観測・仕様からの推論**）。flow の merge は `mergePullRequest` を `mergeMethod` 未指定で発行するため GitHub 既定の MERGE（merge commit）が使われる |
| `allow_squash_merge` | Allow squash merging | `false` | 推奨 | 統合ブランチの取り込みで mainline に別 SHA が載り、統合元が未マージ扱いのまま残る（次のリリース PR が毎回全履歴 diff になる） |
| `allow_rebase_merge` | Allow rebase merging | `false` | 推奨 | 同上（別 SHA が載る） |
| `delete_branch_on_merge` | Automatically delete head branches | `false` | 推奨 | mainline を head とする PR で GitHub 側が head を消しうる（flow 側の head 削除ガードは GitHub の自動削除を止められない） |
| `default_branch` | Settings → General → Default branch | config `project.defaultBranch` と一致 | 推奨 | GitHub が closing 参照を作らず（closing keyword の関連付けは default_branch 宛 PR にしか作られない）、PR 本文フォールバックに全依存する |

※ 表の UI ラベルは `default_branch` 行だけ別セクション（Settings → General → **Default branch**）。他の 4 行は **Pull Requests** セクションにある。

> ⚠️ **取り違え注意**: `Allow merge commits`（**必須**で ON）と `Allow rebase merging`（**推奨**で OFF）は UI 上で隣り合う。片方を OFF にするつもりで取り違えると **merge commit だけが無効**になり `merge` verb が止まる。**上の表を一行ずつ突き合わせて、3 つのチェックボックスの ON/OFF をすべて確認する**（「どれを OFF にするか」だけを見て操作しない）。必須は `allow_merge_commit` の 1 項目だけで、残りは推奨——**表の「必須/推奨」列を必ず見て、推奨を必須と読み替えない**（squash / rebase 運用のプロジェクトを排除しないため）。

<!-- FROZEN-END -->

### 作業

1. **`{repo}` の Settings → General → Pull Requests** を開き、上の期待値表と**一行ずつ突き合わせて**設定する。
2. **Settings → General → Default branch** が `config.yaml` の `project.defaultBranch` と一致しているか確認する（不一致なら合わせる。合わせない判断ならその理由をコメントで残す）。
3. **ブランチ保護の可否を判定して判断を記録する**。`../criteria/repository-settings.md`「ブランチ保護は『可否判定 → 不可なら判断の記録』」の表に従って AI が read で判定した結果は、次のとおり。

   <!-- AI: 診断 ⑧ で得たブランチ保護の判定結果を次の 2 行に転記してから起票する（応答区分と API の原文メッセージ）。プレースホルダを残したまま起票しない。 -->

   - **応答区分**: 【200 保護あり / 404 未設定 / 403 Pro 未加入 = この環境では選べない / 判定不能（mainline 未作成）= mainline がまだ無く保護の可否を測れていない（⑦ で mainline を作ってから再判定） / 判定不能（その他） のいずれかを転記】
   - **API 原文メッセージ**: 【`gh api` の応答本文をそのまま転記（200 の場合は保護内容の要点）】

   **403 Pro 未加入（この環境では選べない）**だった場合は、次から 1 つを選んでこの Issue にコメントで記録する。

   - **(a)** GitHub Pro へ上げてブランチ保護を使う
   - **(b)** リポジトリを public 化してブランチ保護を使う — ⚠️ **不可逆**（全コミット履歴と `.shirokuma/` 配下の内部記録が公開され、非公開へ戻しても一度公開された内容は取り消せない）。**人が判断・操作する**（AI は実行しない）
   - **(c)** 機構による強制を諦め、規律＋ hook 層で担保する

完了条件: `[ ] リポジトリ設定を上の期待値表と一行ずつ突き合わせて設定した（必須項目を満たし、外した推奨項目はコメントに残した）` / `[ ] Default branch を config の project.defaultBranch と一致させた（or 不一致のまま進める理由をコメントした）` / `[ ] ブランチ保護の判定結果（応答区分）を確認し、それに対する判断（(a)/(b)/(c) or 保護を設定した）をコメントで記録した`

---

## 節 G: Claude Code の permission を置く（`.claude/settings.json`）

<!-- INCLUDE-IF: 診断 ⑩ permission が不足（tracked な .claude/settings.json が無い／通常 push が allow に無い／force 3 変種が ask・deny で明示されていない）-->

**この作業は人が行う。** permission は AI の実行境界そのものなので、AI は診断と検証だけを行い、値は書かない。

### なぜ要るか

- 通常の `git push` が `allow` に無いと、Claude Code は push のたびに確認を出す（`ask` に倒れる）。**症状は「AI が自律的に進めなくなった」という形**で現れ、設定の欠落だとは読まれない。
- `permissions` は**コマンド文字列の前方一致**（precedence は deny > ask > allow）で評価される。広い push allow（`Bash(git push:*)` 等）は、**明示していない force 変種を飲み込む**。だから **3 変種すべて**を `ask`（または `deny`）に書く——1 つでも欠けると、その変種だけが未ゲートのまま自律実行されうる。**同じ理屈は `--mirror` / `--delete` / `-d` にもそのまま当たる**（フラグ形なので前方一致で覆える）ので、下の設定例はこの 3 つも含む。
- **`ask` は禁止ではなく人への委任**である。`deny`（完全禁止）にすると、人が必要と判断した force push まで実行できなくなる。

### permission が覆えるもの・覆えないもの（層の位置づけ）

- **permission は二次 / 三次の層である。** ただし**破壊的 push を 1 つのクラスに束ねない**——前方一致で覆えるものと覆えないものが混ざっている。
  - **フラグ形（`--mirror` / `--delete` / `-d`）は、`push` の直後に置いた語順なら permission で覆える。** 破壊性がフラグに載るので `Bash(git push --mirror:*)` 等の前方一致に当たる。**だから下の設定例はこの 3 つも `ask` に含めている**——広い `Bash(git push:*)` allow のままだと、ブランチ / タグの削除と履歴の全上書きが未ゲートで自律実行されうる。
  - **語順を変えたフラグ形・refspec 形・宛先を書かない形は permission では覆えない。** 語順を変えたフラグ形（`git push origin --delete x`／`git push origin x --force`／`git push -u -f origin x`）は前方一致が `push` の直後しか見ないので広い allow に飲まれる。refspec 形（`git push origin +main` の強制更新・`git push origin :branch` の削除）は破壊性がフラグでなく**引数の中身**に載る。宛先を書かない形（`git push`／`git push origin HEAD`）はコマンド文字列に既定ブランチ名が現れない。
- これらを実際に止めるのは**別途導入が要る PreToolUse hook 層**である。**本セットアップ手順は hook 層の導入を必須にしていない**ので、**本節を完了しても hook 層が無い構成になりうる**（節 G が緑であることは、破壊的 push が全部覆われたことを意味しない）。hook 層を入れるかはこのリポの判断で（入れ方は節 H の `shirokuma-hooks` の有効化）、入れない場合は上の 3 形がすべて未ゲートのまま残ることを承知して進める。
- **AI がこの `settings.json` を書かないことに機械層は無い**（それを止める hook / permission / テストは同梱していない）。規範文としてしか存在しないので、**破っても誰も赤くしない＝fail-open かつ fail-silent** である。

### 作業

1. **`{repo}` のルートに `.claude/settings.json` を作る**（**tracked**＝git の追跡下に置く）。既に在るなら `permissions` を下記に合わせて追記する。

   <!-- FROZEN-BEGIN: 設定例 -->

   ```jsonc
   {
     "permissions": {
       "allow": ["Bash(git push:*)"],
       "ask": [
         "Bash(git push --force:*)",
         "Bash(git push -f:*)",
         "Bash(git push --force-with-lease:*)",
         "Bash(git push --mirror:*)",
         "Bash(git push --delete:*)",
         "Bash(git push -d:*)"
         // プロジェクト固有の外向き操作をここに追記（例: 配信スクリプト）
       ],
       "deny": []
     }
   }
   ```

   <!-- FROZEN-END -->

   **貼り付けるときは `//` で始まる行を落としてよい**（`.claude/settings.json` の中身は JSON であり、コメントを許容するかは Claude Code 側のパーサ次第で、本手順では確認できていない）。上のコメント行は追記位置の案内でしかないので、**落としても設定の意味は変わらない**。逆に**壊れた JSON は静かに無視される**（`permissions` が丸ごと効かないまま何のエラーも出ない）ので、**コミットした後に新しいセッションを開き、設定が効いているかを確かめる**（例: 通常の `git push` が確認なしで通る設定なのに確認が出る・`/permissions` に上の規則が載っていない、なら読まれていない）。あわせて、この Issue を close した後に AI が `shirokuma-flow project doctor` の `permission` が `ok` になることを確かめる。**ただし doctor はこの壊れ方を捕まえない**——doctor は設定を JSONC として寛容に読むので、Claude Code が読めない JSON（コメント行の残りなど）でも `ok` を返しうる。doctor が見るのは規則の中身で、Claude Code が読み込めたかは新しいセッションでしか分からない。

2. **プロジェクト固有の外向き・不可逆な操作**（配信スクリプト・本番デプロイ等）があれば `ask` に追記する。**何を追記するかはこのリポが決める**——雛形側にも規範側にも具体コマンドは書かれていない（プロジェクト毎に変わる値をプラグインへ固定しないため）。
3. **`.claude/settings.local.json` に書かない**。通常 `.gitignore` で追跡外なので、そこに書いた `ask` はリポの資産として残らず、他の環境・他の人・他の checkout には効かない。local 側には**環境固有の値だけ**（そのチェックアウトの絶対パス起動形など）を残す。
4. **`.claude/settings.json` をコミットする**（tracked でなければ 1 の意味が無い）。

完了条件: `[ ] .claude/settings.json を作成（または追記）し、通常 push を allow・上の設定例の ask 6 変種（force 3 ＋ --mirror / --delete / -d）をすべて ask に置いた` / `[ ] プロジェクト固有の外向き操作を ask に追記した（無ければ「無し」とコメント）` / `[ ] .claude/settings.json を tracked としてコミットした`

> 規範側の正本は配布物の規範 `permission-boundary`（既定値と Why・3 レイヤの分離）。本節はその**配置手順**であって、境界の判断そのものは同規範が持つ。

---

## 節 H: Claude Code の共有設定を置く（プラグイン・hooks・config と配布物の置き場の直接編集の `deny`）

<!-- INCLUDE-IF: 編成モードで起票する回に、追跡された .claude/settings.json に下の設定例の項目が揃っていない（project doctor はこの節の項目を見ない・不足ゼロ判定に数えない）-->

**この作業は人が行う。** 節 G と同じく、AI は `.claude/settings.json` を書かない（どの項目も AI の実行環境そのものを変えるため）。節 G と同じファイルへ書き足す。

### なぜ要るか

- プラグインの有効化を共有設定に置かないと、clone した人ごとにプラグインを手で入れることになる。入れ忘れると skill も agent も無い状態で作業が始まり、その症状は設定の欠落だとは読まれにくい。
- `shirokuma-hooks` を入れないと、節 G の permission で覆えない破壊的 push（語順を変えたフラグ形・refspec 形・宛先を書かない形）が未ゲートのまま残る。
- 設定ファイル（`config.yaml`）の値は `changing-config` スキルの経路（`shirokuma-flow config set` / `config unset`）で変える前提で、`deny` は AI の編集ツールによるうっかりした書き換えを止める。
- 配布物の置き場（`.shirokuma/dist/`）は CLI が書く置き場で、直接書き換えても次の更新で消えるので、`deny` で AI の編集ツールによる書き換えを止める。

### 置換する値（起票前に AI が埋める）

- `{marketplace-repo}`: プラグインを配る配信 repo の `owner/repo`（`claude plugin marketplace add` に渡す値）。
- `{marketplace}`: その配信 repo のマーケットプレース名。正本は配信 repo の `.claude-plugin/marketplace.json` の `name`。
- どちらも確かめられない回は推測で埋めず、プレースホルダを残して「登録したマーケットプレースの名前と repo を確かめて埋める」と書き添える。

### 設定例

```json
{
  "extraKnownMarketplaces": {
    "{marketplace}": {
      "source": { "source": "github", "repo": "{marketplace-repo}" }
    }
  },
  "enabledPlugins": {
    "shirokuma-flow@{marketplace}": true,
    "shirokuma-hooks@{marketplace}": true
  },
  "permissions": {
    "deny": ["<設定ファイルの Edit を止める規則（項目 3）>", "<配布物の置き場の Edit を止める規則（項目 3）>"]
  }
}
```

- **確度**: `extraKnownMarketplaces` / `enabledPlugins` の形は Claude Code の公式ドキュメント（settings の頁・plugin marketplaces の頁）の例と同じ形にした。実環境で読み込ませては確かめていないので、書いたら下の「作業」の 4 まで通し、読み込まれなければ公式ドキュメントの形に合わせる。
- **フォルダの信頼が要る**: Claude Code の公式ドキュメント（settings の頁）によると、リポの共有設定のうち `extraKnownMarketplaces`（と `permissions.allow`）は、各人がそのフォルダを信頼するダイアログを承認するまで効かない（承認していないフォルダでは黙って無視される）。`deny` と `ask` はすぐ効く。この挙動は Claude Code の版で変わりうる。clone した人にはフォルダの信頼を承認するよう伝える。
- `permissions` は節 G で置いた `allow` / `ask` と同じオブジェクトに `deny` を足す（`permissions` を 2 つ書かない）。

### 項目ごとの扱い

1. **`extraKnownMarketplaces` / `enabledPlugins`**: 配信 repo のマーケットプレースと、`shirokuma-flow` プラグインを有効にする。拡張プラグイン（`shirokuma-nextjs`・`shirokuma-infra`）は使うリポだけ `enabledPlugins` に足す。配信 repo が private なら、取得は各人の git の認証で行われる（権限の無い人の手元では入らない）。
2. **`shirokuma-hooks`**（任意・入れるかはこのリポが決める）: 破壊的な git / GitHub 操作を Bash の実行前に止める PreToolUse hook。止める対象はそれだけではなく、`gh` の直接の呼び出し（`shirokuma-flow` の verb へ誘導する）と、python / node / perl などの inline スクリプト（`-c`・heredoc・パイプで本文を渡す形）も止める——ファイルにしたスクリプトの実行やテストは止めない。inline スクリプトを日常の作業に使うリポでは、入れると作業の形が変わる。判定は `shirokuma-flow` CLI が行うので、**CLI が PATH に無い環境では止めずに通す**（fail-open・その旨を stderr に出す）。止められた操作は、本当に要るかを確かめてから人が打つ。入れない場合は、節 G の「permission が覆えるもの・覆えないもの」の 3 形が未ゲートのまま残る。**このプラグインは PreToolUse のほかに 2 つの hook も入れる**（入れるかを決める材料）:
   - **Stop hook**: 作業のチェーン（タスク一覧）に未完了の段が残っているとき、メインのセッションが止まろうとするのを止めて続きへ進ませる。同じ未完了のままの止めは 3 回までで、その後は止まるのを許す。
   - **SubagentStop hook**: サブエージェントが終わったとき、未完了の段が残っていればメインへ続きを促す。
   - どちらも PreToolUse と同じく CLI が PATH に無い・CLI が失敗した回は止めずに通す（fail-open）。自動で次の段へ進む動きを望まないリポは、このプラグインを入れない判断になる（PreToolUse だけを選んで入れる手段は無い）。
3. **設定ファイル（`config.yaml`）と配布物の置き場（`.shirokuma/dist/` 配下）の直接編集を `deny`**: `deny` に置く 2 つの規則の逐語・書き方・置いた後の確かめ方・止まらないもの（`config set` / `config unset`・`update` / `rules install`・人のエディタ・自分でファイルを開くスクリプト）の正本は `changing-config` スキルの `reference/permission-deny.md`。AI のセットアップ手順は `config set` で書くので、この `deny` を置いても止まらない。dist の規則を置く理由と限界も同じ正本にある。
4. **入れないもの**:
   - **`language`**（応答の言語）: 共有設定に置くと clone した全員の応答言語が変わる。各人の選択なので、置くなら各人の `~/.claude/settings.json` か `.claude/settings.local.json` にする。
   - **`$schema`**: エディタの補完と検証のための任意の項目で、設定の効き目は変わらない（入れるなら公式ドキュメントの settings の頁に載っている URL を使う）。

### 作業

1. 上の `{marketplace}` / `{marketplace-repo}` が埋まっていることと、**埋まった `{marketplace-repo}` が自分が実際に登録・使用している配信 repo と同じであること**（`claude plugin marketplace list` などで見比べる）を確かめ、`{repo}` の `.claude/settings.json` に設定例の項目を書き足す（`shirokuma-hooks` を入れない判断なら、その行を落としてこの Issue にコメントで残す）。
2. **`.claude/settings.local.json` に書かない**（理由は節 G の作業 3 と同じで、他の checkout に効かない）。
3. `.claude/settings.json` をコミットする。
4. 新しいセッションで確かめる: ①プラグインが有効になっている（`/implement-flow` などの skill が出る）②`shirokuma-hooks` を入れたなら、`/hooks` に Bash の PreToolUse hook が載っている（表示は Claude Code の版で変わりうる。hook が効いているかを破壊的な操作の試し打ちで確かめない——効いていなければそのまま実行される）③`deny` は `changing-config` スキルの `reference/permission-deny.md` の確かめ方。壊れた JSON は静かに無視されうるので、ここを飛ばさない。あわせて、この Issue を close した後に AI が `shirokuma-flow project doctor` の `permission` が `ok` のままであることを確かめる（同じファイルを書き換えたので、節 G の設定が壊れていないかを見る）。

完了条件: `[ ] .claude/settings.json にプラグインの有効化（extraKnownMarketplaces / enabledPlugins）を書き足した` / `[ ] shirokuma-hooks を有効にした（or 入れない判断と理由をコメントした）` / `[ ] 設定ファイル（config.yaml）の Edit を deny に置いた` / `[ ] 配布物の置き場（.shirokuma/dist/）の Edit を deny に置いた` / `[ ] 新しいセッションで作業 4 の確かめを通した`

---

## 完了条件（採用した節のチェックだけをここに集める）

- 上記で**採用した節の完了条件**を抜き出して並べる（不採用節は入れない）。
- [ ] この Issue を close した（＝AI が引き取り、不足だった項目の検証・結線・疎通確認へ）
