# 作業セッションの手順（設計・計画の起案から PR の是正まで）

skill `issue-run-flow` を起動した作業セッションの main が、1 つの課題の設計・計画の起案から実装・品質ゲート・commit / push・PR 作成・是正までを回すときの手順。段に入る直前に、その段で使う節だけを読む（節の行は `grep -n '^#'` で引き、行範囲で読む）。段ごとに読む節の対応は skill `issue-run-flow` の「2. 手順書」の表が持つ。

## 分離の確かめ（どの段より先に 1 回）

作業ツリーの中で次を上から順にすべて確かめ、1 つでも満たさなければ何も書かずに止まり、外れた条件を止まる理由として依頼元へ返す（skill `issue-run-flow` の「問い合わせと止まる理由の返し先」）。どのコマンドも、空の出力・失敗は「満たさない」として扱う。主リポを `git -C` や `cd` で対象にしない（実行環境の作業ツリーの分離の検査が読み取りでも拒む。Claude Code 2.1 系の作業ツリーに閉じ込めたセッションで確かめた範囲で、版で変わりうる）。

- `git rev-parse --git-dir` と `git rev-parse --git-common-dir` の出力が、正規化した絶対パスで違うこと（linked worktree である。主リポの作業ツリーでは両者が一致する）。
- `git status --porcelain --untracked-files=all` が空であること（追跡・未追跡の変更が無い。ignore されたもの〔トリアージの段でこのセッションが書いた `issue context` のキャッシュなど〕は見ない）。
- 他の課題のブランチが checkout されていないこと: `git symbolic-ref -q --short HEAD` が空（detached）か、その名前が `^[A-Za-z0-9._/-]+$` に合い `-` で始まらず（合わなければ止まる・コマンド行に載せない）、upstream が無く（`git rev-parse --abbrev-ref '<名前>@{upstream}'` が失敗する）、`git ls-remote --heads origin '<名前>'` が何も返さないこと。
- base（規範 `branch-workflow` の決め方で引いた値）が `shirokuma-flow gate vocab` の `baseRefAllowlist` の条件をすべて満たすことを確かめてから `git fetch origin '<base>'` し、HEAD が次のどちらかに当たること（一致は `git rev-list --count` を両向きに打って両方 0）。
  - (a) HEAD が `origin/<base>` と一致する（是正の続きの回は、下の「是正の続き」の節のとおり先に fetch した `origin/<head>` と一致する回も含む）。
  - (b) 実行環境が `origin/HEAD` から作り、一度も動かしていないブランチである: detached でなく、`git log -g --format=%H 'refs/heads/<名前>' --` の出力がちょうど 1 行でその sha が HEAD と一致し（作られてから一度も動いていない）、`git rev-parse --verify -q 'refs/remotes/origin/HEAD^{commit}'` が commit を返し、HEAD がその commit と一致するかその祖先である（`git rev-list --count 'refs/remotes/origin/HEAD..HEAD'` が 0）。一致だけを求めないのは、`origin/HEAD` が指す先が、上の fetch と、追跡 ref を共有する主リポ・他の作業ツリーの fetch で、ブランチを作った後に進むためである。detached のツリー・reflog が 2 行以上か 0 行のブランチ・`origin/HEAD` が無い手元・`origin/HEAD` から辿れない commit を持つブランチは (b) に当たらない。祖先であれば古い commit から作ったブランチも通るが、(b) で通った回は下の切り直しで `origin/<base>` へ移るので、起点の commit は作業に使わない。
- (b) で通った回は、何も書く前に `git switch --detach 'origin/<base>'` を打ち、`git rev-parse HEAD` が `origin/<base>` と一致することを確かめる（是正の続きの回は下の節の切り直しがこれを兼ねる）。切り替えか確かめが失敗したら止まる。
- (a) で通った回も (b) で通った回も、ここまで通ったときの HEAD の sha を控える（実装の段の入口で使う）。
- 設計・計画の段から始める回は、上の切り替えの後、続けて何も書く前に `git check-ignore -q .shirokuma/github/` で `issue context` のキャッシュの置き場が ignore されていることを確かめる。ignore されていなければ何も書かずに止まる（キャッシュの置き場は CLI がプロジェクトのルートに固定していて選べない。導入先が `.shirokuma/github/` を ignore すれば使えることも依頼元へ返す）。
- 止まった理由には外れた条件を書く。HEAD の条件で外れた回は、HEAD・`origin/<base>`・`origin/HEAD` の commit（無ければ「無い」）の sha と、(b) のどこで外れたか（detached・ブランチの reflog がちょうど 1 行で HEAD と一致する形でない〔動いている・reflog が無い〕・`origin/HEAD` が無い・HEAD が `origin/HEAD` から辿れない commit を持つ）と、直し方を書く: `origin/HEAD` が無い回は、人が主リポで `git remote set-head origin --auto` を打つ（`shirokuma-flow project doctor` の `origin-head` で確かめられる）。ツリーが detached・reflog が 1 行で HEAD と一致する形でないブランチ・`origin/HEAD` から辿れない commit を持つブランチの回は、新しい作業セッションを開き直す（`project doctor` の `origin-head` が、手元の `origin/HEAD` はリモートの既定ブランチと違う先を指すと返す回は、開き直す前に人が同じ `git remote set-head origin --auto` を打つ）。

## 実装の段の入口

1. **ブランチを切る**（1 回）: `git fetch origin '<base>'`（base の値域を確かめてから）を打ち、追跡・未追跡の変更が無いこと（`git status --porcelain --untracked-files=all` が空。ignore されたキャッシュは設計・計画の段の成果として残るので見ない）、分離の確かめの 3 つ目の条件（他の課題のブランチが checkout されていない）を今も満たすこと、HEAD が分離の確かめで控えた sha のままであることを確かめ、満たさなければ何も書かずに止まる。ADR 候補の段から戻った回は、skill `issue-run-flow` の `reference/adr-candidate.md` の 8 の切り替えの後の HEAD を控えた sha として扱う。そのうえで `shirokuma-flow branch name <課題#>` で導いた名前で `git switch -c <名前> origin/<base>` し、`git rev-parse HEAD` が `origin/<base>` と一致することを確かめる。切り直しも確かめも作業ツリーの中だけで行う。
2. **作業ツリーの準備**（新規の回は実装の前に 1 回だけ）: 1 の直後に `shirokuma-flow config get quality.isolatedPrepareCommand` を読み（この時点の作業ツリーの config＝base 側の値）、値ごと実装サマリーに記録してから作業ツリーのルートで 1 回打つ。未設定なら打たず、そのことを実装サマリーに残す。是正の続きの回は下の節の順で base 側の値を読む（PR head の config の値は打たない）。品質ゲートの直前・是正の巡では打ち直さない（依存やビルド成果物が古いままゲートが赤になった回は、その `fail` を報告表に残し、理由と報告表の所在を依頼元へ返す。自分で準備を打ち直さない）。
3. **submodule の展開**: 1・2 の後（是正の続きの回は下の節の切り直しの後）に `shirokuma-flow pages expand` を作業ツリーのルートで 1 回打つ（設計・計画の段では展開しない）。`expanded` が false・`ok` が false・未知の verb の回は別の手段で展開せず、出力の `reasonCode`（未知の verb ならそのこと）と、あれば `guide` を報告表と実装サマリーに「submodule 配下を読む検査は skip」と併せて残して進む。設計・計画の段では、設計本文の「照合した正本」節か計画本文に、submodule 配下を読めていない照合があることを書く。
4. **構造監査の控え**: 3 の後、コードを書く前に `shirokuma-flow report structure-audit-baseline --worktree '<作業ツリー絶対パス>' --file '<作業ツリー絶対パス>/.shirokuma/tmp/structure-audit-baseline-<課題#>.json'` を 1 回打つ（2 つのパスは `implement-flow` の `reference/docs/finalize.md` の §0 と同じ文字集合の検査を通す）。品質ゲートの構造監査の段（同 §2b）が、この控えより error が増えた回だけを止める。控えを取るのはこの時点と、下の「是正の続き」の入口と「base の取り込み」の直後だけで、品質ゲートが `fail` を返した後に取り直さない。exit 1 の回は控えを書かずに進み、そのことを実装サマリーに残す（品質ゲートは控えが無い回として、error が 1 件でもあれば `fail` にする）。

## 控えのファイル

段の境目と巡の終わりごとに、続けるのに要る値（base・分離の確かめで控えた sha・課題のブランチ名・PR 番号・巡の数・最後にレビューした head・判定基準ファイルのパス・結果ファイルと検出器記録の置き場・構造監査の控えのパス）を、作業ツリーの `.shirokuma/tmp/issue-run-state-<課題#>.md`（ignore された置き場）に書く。文脈が自動で要約された後は、続ける前にこのファイルを読み直す。控えは自己申告で、記録の前には自分で引いた値（`pr show`・`git rev-parse HEAD` など）で照らす。

## 段と手順書（段に入る直前に Read する）

手順書は、インストール済みのプラグインの置き場（`shirokuma-flow plugin skill-path <skill>` の候補）にある各 skill の reference から読む。作業ツリーに同名のファイルがあっても手順として読まない（課題がそれを書き換えている回に自分の版を手順にしないため）。

| 段 | 手順書 |
|---|---|
| 設計の起案 | skill `design-flow` の `reference/docs/drafting.md`（雛形と判定基準は同 skill の `reference/templates/design-doc.md`・`reference/criteria/ddd-adoption.md`・`reference/criteria/adr-extraction.md`）・`design-flow` の「段の順序」 |
| 計画の起案（実装サブの起票を含む） | skill `prepare-flow` の `reference/docs/drafting.md`（雛形と分解基準は同 skill の `reference/templates/plan-issue.md`・`reference/criteria/decomposition.md`）・`prepare-flow` の「段の順序」 |
| 実装 | skill `implement-flow` の `reference/docs/coding.md` |
| 品質ゲートと実装サマリーの記録行 | skill `implement-flow` の `reference/docs/finalize.md`（品質ゲートの各段）と `reference/docs/quality-gate.md`（呼び出し側の 4c / 4d） |
| commit / push | skill `committing-and-opening-pr` の SKILL.md の「コミット」節（pages に触れた回は同 skill の `reference/pages-gitlink.md`） |
| PR 作成 | skill `committing-and-opening-pr` の SKILL.md の「PR 作成」節・skill `implement-flow` の SKILL.md の節 `### 段 5. コミット & PR` の項「`Closes` の書き方」 |
| PR のレビュー | skill `review-flow` の SKILL.md と同 skill の `reference/docs/review-gate.md`（下の「PR の閉じる参照の照合」を R1 の前に通す） |

- 各手順書の書き込みの範囲・前提条件・除外ゲート（mainline 上で commit しない・`quality.localVerifyCommand` の同一性・base の決め方など）はそのまま守る。各手順書が自分で引くとする値（base など）は、skill `issue-run-flow` の「2. 手順書」のとおりに引く。
- 段に入る直前に、その段の手順書の冒頭の「読む規範」のうち、skill `issue-run-flow` の起動直後の注入と参照する規範で読んでいないものを `<rule-index>` の `file` から Read する。`rules inject --scope worker` は打たない。
- 設計・計画の段では作業ツリーを読むだけで、ブランチを切らず、commit も push もしない（作業ツリーに残るのは ignore された `issue context` のキャッシュだけ）。設計の段の計画要否の契約コメントは、`design-flow` の段 5b のとおり設計の承認の後にこのセッションの main が書く。ADR 候補が要ると判断した回は、skill `issue-run-flow` の `reference/adr-candidate.md` に従う。
- 計画 NEEDED の課題では、このセッションは計画の承認で終わる（実装サブは 1 本ずつ、それぞれの作業セッションで回す）。
- 実装・是正の段で展開した pages に書いてよいのは、`adr land`（予定の着地の切り替え）・差分で古くなった既存の specs ページと確認ビューの本文の更新・差分が pages に触れた回の `pages push`（skill `committing-and-opening-pr` の `reference/pages-gitlink.md` のとおり）だけ。`pages push` した回はそのことを、取り直しても衝突した回（解かずに止まる）はその理由を報告表に書く。このセッションの clone から push した commit は人の作業ツリーの submodule に入らない。PR のレビューで隔離ツリーを作る回に、人の module に gitlink の sha が無いと展開できないことがある。
- 報告表と実装サマリーは作業ツリーの `.shirokuma/tmp/finalize-<課題#>.md`・`impl-summary-<課題#>.md` に書き、別のパスへ読み替えない。
- PR 本文（実行の証跡・`検査対象 head sha`・反映遅延の注記）は実装サマリーから書く。確認ビューの記録行の値は、HTML 化判定（`explainer-worker` へ委任した回はその返事）で決まった値を書く。
- PR 本文の `Closes` は、上の表の PR 作成の段で読む項「`Closes` の書き方」のとおりに並べる。計画を飛ばした課題かは、PR を作る前に `shirokuma-flow next <課題>` を引き、`reason` が `plan_skipped_not_needed` かで決める。そのときの設計子は `shirokuma-flow issue show <課題>` の `children` の全件。
- push の先: 課題のブランチ（是正の続きの回は PR の head ブランチ）と、その課題の設計か計画が起こした ADR 候補のブランチ（`shirokuma-flow branch name <候補#>`）と、下の「統合ブランチの段」が名指す統合ブランチだけ。ローカルのブランチ名が push 先の head ブランチ名と違う回（是正の続きの回）は、`git push origin 'HEAD:refs/heads/<head ブランチ名>'` で force なしに送る。リモートが早送りでないとして拒んだ回・実行環境の hook が拒んだ回は止まり、拒否文を止まる理由として依頼元へ返す（別の綴りで迂回しない）。宛先を課題のブランチに縛る機械段は無く、上に挙げた先以外へ push しないことは自分で守る（fail-open。ほかの push の判定〔mainline への push・force push・宛先を書かない push など〕は掛かる）。
- コマンドは 1 行 1 操作で打つ。hook は安全と確かめられない形の行を丸ごと deny し、束ねた操作はどれも実行されない（`git` の操作を `;`・`&&`・`|` で連ねる・`cd <dir> &&` を前置する・ループで回す形など）。`approve` は行全体がその 1 コマンドだけの形で、1 件ずつ打つ。deny されたら同じ操作を別の綴りで迂回せず、分けて打ち直す。

## 統合ブランチの段（計画が統合ブランチを使う課題）

統合ブランチ（`epic/<親番号>-<slug>`）を使う計画（規範 `branch-workflow`「Plan ケース」の系統 1）では、統合ブランチへの git の書き込みも作業セッションが行う。統合ブランチ名は、コマンド行へ載せる前に `^epic/[A-Za-z0-9._/-]+$` に合い、`..` を含まず、改行を含む制御文字を含まない（単一行）ことを確かめる（合わなければ何もせず止まる）。

- **作成**（親の課題の作業セッション・計画の承認の前に 1 回）: 名前は `shirokuma-flow branch name <計画#>` の slug から `epic/<計画#>-<slug>` とし、`git ls-remote --heads origin '<統合ブランチ>'` が何も返さないことを確かめてから、`git fetch origin '<base>'` → `git switch --detach 'origin/<base>'` → `git push origin 'HEAD:refs/heads/<統合ブランチ>'`（force なし）で作り、終わったら元の HEAD へ戻る。既に在る回は作らず、在ることを計画本文の「Integration ブランチ」節（無ければ足す）に書いて続ける。
- **mainline の取り込み**（配下の実装サブの作業セッション・サブ PR を作る前）: ADR 候補の PR が mainline に入った後は、規範 `branch-workflow`「統合」のとおり統合ブランチへ mainline を取り込む。課題のブランチとは別に、`git fetch origin '<統合ブランチ>' '<base>'` → `git switch --detach 'origin/<統合ブランチ>'` → `git merge --no-edit 'origin/<base>'` → `git push origin 'HEAD:refs/heads/<統合ブランチ>'`（force なし）で行い、終わったら課題のブランチへ戻る。衝突したら `git merge --abort` で取り消し、解かずに止まって依頼元へ返す（解いた結果を別の主体が見る段が無いため。下の「base の取り込み」の 3 区分はここに当てない）。
- **最終 PR**（管理セッションが親の課題について開いた作業セッション・子が全部 Done で統合ブランチが残る回）: commit を作らず、skill `committing-and-opening-pr` の「PR 作成」節で、head を統合ブランチ・base を mainline にした PR を作る。本文の `Closes` は規範 `branch-workflow` の「統合 PR の Closes 運用契約」に従い、下の「PR の閉じる参照の照合」の閉じるはずの集合もその契約が閉じるとする課題にする。作った後は PR のレビューの段（`review-flow`）へ進む。
- 統合ブランチへ push してよいのは上の作成と取り込みだけで、統合ブランチの履歴を書き換えない（force push しない）。

## PR の閉じる参照の照合

PR を作った後・R1 を委任する前と、是正を push した後の再レビューの前に、`shirokuma-flow pr show <PR#>` の `head_oid` が自分の作業ツリーの `git rev-parse HEAD` と一致し、`linked_issues` が閉じるはずの集合と集合として一致することを確かめる。閉じるはずの集合は skill `implement-flow` の SKILL.md の節 `### 段 5. コミット & PR` の項「`Closes` の書き方」が閉じるとする課題で、照合の直前に自分で引く: `shirokuma-flow next <課題>` の `reason` が `plan_skipped_not_needed` なら、課題と `shirokuma-flow issue show <課題>` の `children` の全件（設計子。2 件以上でも全部）。それ以外（実装サブ・設計も計画も持たない課題など）は課題 1 件。ADR 候補の PR では、集合はその段が起こした ADR 候補 Issue だけで、課題・設計は入らない。食い違えば（設計子が欠けた回を含む）判定の記録と R1 の委任に進まず、skill `committing-and-opening-pr` の「PR 作成」4 のとおり PR 本文を直してから照らし直す。直しても合わなければ止まる。

## 是正の続き（`next` が `gated` で、課題を閉じる open な PR がある回）

`shirokuma-flow pr list` で課題を閉じる open な PR を引き、`pr show` の `head`（PR の head ブランチ名）の値域を確かめる: `^[A-Za-z0-9._/-]+$` に合い、`-` で始まらず、`..` を含まず、`<type>/<課題番号>-` で始まり（`epic/*` などの統合ブランチを拒む）、base・mainline・skill `committing-and-opening-pr` の「コミット」節のブランチの許可が外すブランチのどれとも違うこと（合わなければ何もせず止まる）。次に分離の確かめより前に `git fetch origin '<head>'` し、分離の確かめの HEAD の条件は「`origin/<base>` か `origin/<head>` と一致する（(a)）か、分離の確かめの (b) に当たる」とする。そのうえで実装の段の入口の 1・2 の代わりに: `git switch --detach origin/<base>` して 2 の値を読み、値ごと実装サマリーに記録する（打つのはまだ）。`git show-ref` で使われていない最小の正の整数 `k` を選んで `<head>-cont-<k>` を `origin/<head>` から切り、`git rev-parse HEAD` が `origin/<head>` と一致することを確かめてから、読んだ値を作業ツリーのルートで 1 回打つ（未設定なら打たない）。続けて入口の 3（submodule の展開）と 4（構造監査の控え。その時点の PR の head の断面を控える）を打ち、PR のレビューの段（`review-flow` の段の順序）の残りから続ける。push は上の「push の先」のとおり `HEAD:refs/heads/<head>` で送る。

## base の取り込み（PR を持つ作業ブランチへ）

`origin/<base>` を merge で取り込み（force なし）、品質ゲート → commit / push の後に増分の再レビューへ回す（`review-flow` の `reference/docs/review-gate.md`「base を取り込んだ後の増分再レビュー」）。衝突したら、衝突箇所ごとに次の 3 区分に当て、すべての箇所がどれかに当たる回だけ解く。

- **足し合わせ**: 両側が別々の行・欄・要素を足した（隣り合う行への追記・表や配列への行の追加・フィールドとコンストラクタへの追記）。両方を残す。
- **片方が他方を含む**: 片側の変更がもう片側の変更をすでに含む。含む側を採る。
- **数え直し**: 件数・凍結値・テストの期待値のように、取り込んだ後の内容から一意に決まる値。両側の値を足し引きせず、取り込んだ後の内容から数え直し、品質ゲートで確かめる。
- 1 箇所でも、どちらかの意図を捨てないと解けない・解いた結果が両側のどちらにも無い挙動を持ち込む・人ゲートの対象（授権キーを持つ設定・permission の設定・hooks の定義・秘匿値・CI / デプロイの定義）に触れる・どの区分に当たるか迷う、のどれかに当たる回は、`git merge --abort` で取り込みごと取り消し（一部だけ解いて止まらない）、止まって依頼元へ返す。止まった理由に、衝突したファイルとファイルごとに当たった区分（または人に上げた理由）を書く。
- 解いた回は、取り込みの commit メッセージの本文に解いたファイルと区分を書く（レビュアーが読む材料）。解いた箇所は増分の再レビューの母集団に入る。
- 取り込みの commit の直後（品質ゲートの前）に、実装の段の入口の 4 と同じ形で構造監査の控えを取り直す（base 側で増えた error を、この課題が持ち込んだと数えないため）。
- 統合ブランチと pages の取り込みは、ここでは解かない（衝突したら止まって依頼元へ返す）。
- 倒れる向き: 区分の判定と人ゲートの対象に触れるかの読み取りは自分の判定で、読み違えて解いた回を受けるのは増分の再レビューと、判定記録が PR の head と合うことを求める merge 条件だけである（レビュアーが見落とせば取り込まれる＝fail-open）。

## 規範の届き方

導入先の `paths` を持つ規範（Claude Code のプロジェクトの規範ファイル）は、作業ツリーで対象ファイルを Read した時点で載る（開発側で Claude Code 2.1.312 について確かめた。導入先の版では確かめていない）。Read を経ずに Write で作るファイルが `paths` に当たるときは、主リポの同名ファイルを Read する。

## してはいけないこと

- merge（課題の PR と ADR 候補の PR）。
- 作業ツリーの外（主リポの追跡ファイル・他の作業ツリー）への書き込み。作業ツリーにある同名の手順書（skill の SKILL.md と reference）を手順として読むこと。
- 名指されていない GitHub への書き込み。名指す書き込みは次だけ: トリアージの段の課題本文の書き戻し（`issue context` → `issue push`）・題名の `issue retitle`・IssueType の `issue retype`。設計の段の設計 Issue の seed の起票と設計本文の書き戻し。計画の段の計画 Issue と実装サブの起票（計画が Backlog のうちの `--force` を含む・skill `prepare-flow` の `reference/docs/drafting.md` のまま）と計画本文・実装サブの本文の書き戻し。計画要否の契約コメント（課題へ 1 件）。実装の段以降の commit / push・`pages push`・PR の作成と本文。「統合ブランチの段」の統合ブランチの作成・取り込みの push・最終 PR の作成と本文。状態遷移（`flow` verb）・判定記録と記録行（`pr record-verdict`・`pr record`）。ADR 候補の段の書き込み（ADR 候補 Issue の起票と候補本文の書き戻し・ADR 候補のブランチへの commit / push と ADR 候補の PR の作成と本文・確定した ADR 正本と対応表の `pages push`・緩める側の候補を授権で確定した回の監査コメント〔`autonomous-flow` の `reference/criteria/irreversible-operations.md` の「監査」節〕・人がその場で特定の候補を自分で確定すると指示した回の候補 Issue への 1 行）。worker を使えない回の確認ビューの記録行と `pages push`。
- 動作確認での実 GitHub への書き込み（CLI の実走は `--fixture`）。
- 確認ビューを、`explainer-worker` を使える回に自分で生成すること。
- レビュー（トリアージの提出前の分析・設計・計画・PR・ADR 候補の整合）を自分で行うこと（別の worker へ委任する。例外は skill `issue-run-flow` の「短い経路」）。
- force push・`git branch -D`・作業ツリーの撤去（撤去は管理セッションか人）。
- レビュー worker の結果ファイルと検出器記録を書き換えること（書くのはレビュー worker）。

**判定 JSON の `build` ブロック（`sourceMatch` / `dirty` / `degraded`・欠落した回の読み方を含む）の読み方は `shirokuma-flow gate limits --sub limits` の `H19` が正本**（ここに写さない）。`stale` を名乗った回・`build` ブロックそのものが無い回は、その判定を現ソースの値として読まない。`stale` と `build.dirty: true` が同時に立つ回は、その判定を根拠に使わない。`build.dirty: null`（焼いていない）は、再現性の担保が無い側として `build.dirty: true` と同じに読む。（本ファイルが `shirokuma-flow gate` の出力を読むすべての箇所に掛かる。）

## 倒れる向き

- 分離の確かめと push の先は自分で守る規律で、作業セッションの main の push を課題のブランチ 1 本に縛る機械段は無い（fail-open）。
- 判定記録と記録行・計画要否の契約コメントは、差分と結果ファイルを読んだ書き手の本人が打つ。打つか打たないか・どの値を打つかを自分の読みで決めず、`gate verdict` などの判定 verb が返した値をそのまま写す（受けるのは別の worker のレビューだけ）。
- 控えのファイルと手順の読み落としを確かめる層は無い（fail-open）。
