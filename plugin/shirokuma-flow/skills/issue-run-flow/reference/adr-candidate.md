# ADR 候補の段（設計か計画が ADR 候補を起こした回）

決定の段（設計。設計を持たない課題では計画）の承認と計画要否の契約の後、次の段へ進む前に、その段が起こした ADR 候補を作業セッションの中で扱う。手順の本文は skill `requirements-flow` の「ADR の状態遷移（打ち方）」節・規範 `concept-gap-to-adr` 手順 5・skill `design-flow` 段 6 が持ち、ここに写さない。作業セッションで読むときに違う点だけを書く。

1. **起票と起草は自分で行う**: ADR 候補 Issue（IssueType=ADR・最上位・`--parent` を付けない）を起票し、本文を自分で書く（`requirements-worker` へ委任しない）。宣言欄の値は、例外の 2 項目（`autonomous-flow` の `reference/criteria/irreversible-operations.md`「条件付き自動実行」§1 の「例外」）の両方を当てて決める。
2. **整合のレビューは委任する**: `submit` の後、title と本文の整合の判断と着地の見込み節の突き合わせの項の有無（`requirements-flow` の同節の手順 2）を `review-worker` へ委任する。同手順 2 が確定しないとする回（判定行が無い・値域外・不整合・突き合わせの項が無い）は確定せず、自分で本文を直してもう一度委任する。
3. **ADR 候補のブランチを切る**: 確定は cwd の作業ツリーの ADR 正本の置き場と索引に書くので、確定の前に切る。コマンド行へ載せる前に、`<mainline>` が `shirokuma-flow gate vocab` の `baseRefAllowlist` の条件をすべて満たし、`<候補#>` が `^[1-9][0-9]*$` に一致することを確かめる（満たさなければ打たずに止まる。値は単一引用符で囲む・規範 `trust-boundary`）。作業ツリーに追跡・未追跡の変更が無いことを確かめ、`git fetch origin '<mainline>'` の後に `shirokuma-flow branch name <候補#>` の名前のブランチを `origin/<mainline>` から切る（base は mainline。統合ブランチ配下の課題でも同じ・規範 `branch-workflow`「統合」）。`shirokuma-flow pages expand` で submodule を展開する。
4. **確定の打ち手は `next` の `runBy` に従う**: `shirokuma-flow next <候補#>` の `nextActions[]` の確定の要素が `runBy:"ai"` なら、その要素の `verb` と `args`（素の `approve`・再開待ちの候補の素の `adr publish <候補#>`・`adr publish <候補#> --accept-boundary-loosening` のどれでも）をそのまま 1 本だけの行で、追加の引数なしに打つ。`runBy:"human"` なら打たずに止まり、要素の `verb` と `args` を逐語で、人の判断が要る点として依頼元に返す（skill `issue-run-flow` の「問い合わせと止まる理由の返し先」・「4. 終わり方」の 4）。人がその場で特定の候補を自分で確定すると指示した回は、授権があっても確定せず、候補 Issue へ指示を受けたことを 1 行残す。打ち手の判定を作業セッションで緩めも狭めもしない。
5. **ADR 候補の PR**: 確定の verb が返した `next` の追従と、決定の段が定めた DDD 文書の更新だけを ADR 候補のブランチへ commit・push し、候補を `Closes` する PR を作る（課題・設計・計画・実装サブは閉じない）。ADR 正本と対応表は `pages push` で反映し、ADR 候補のブランチは mainline ではないので gitlink の前進は ADR 候補の PR へ commit する（`commit-worker` の定義の「pages submodule と gitlink bump」節）。
6. **その PR のレビュー**: skill `issue-run-flow` の「レビュー」のとおり回し、判定記録・記録行・遷移を自分で打つ。
7. **merge を頼んで止まる**: ADR 候補の PR の merge は打たない（skill `issue-run-flow` の「4. 終わり方」の 2）。取り込まれた（`shirokuma-flow pr status <PR#>` の `state` が `MERGED`）と知らされたら、同じセッションで続ける。セッションを閉じた回は、新しい作業セッションが `next` から続ける。
8. **課題の次の段へ戻る**: `<base>` を 3 の `<mainline>` と同じ条件で確かめてから `git fetch origin '<base>'` を打ち、作業ツリーに追跡・未追跡の変更が無いこと（ignore されたキャッシュは見ない）と、HEAD が取り込まれた ADR 候補の PR の head であることを確かめ、`git switch --detach 'origin/<base>'` する。満たさなければ切り替えずに止まる。続けて `shirokuma-flow next <課題>` を引き直し、`working` なら課題のブランチを `origin/<base>` から切って実装の段へ、`preparing` なら detached のまま計画の段へ進む（ブランチは切らない）。どちらの回も、この切り替えの後の HEAD を手順書（`issue-run-worker` の定義）の最初の一手 2 で控える sha として扱い、最初の一手 3 の「HEAD が 2 で控えた sha のまま」はこの値で照らす。

手順書のうち次の文は、作業セッションでは「作業セッションの main が自分で行う（委任するのは整合のレビューと PR のレビューだけ）」と読み替える: `issue-run.md` の「メインに残す段」の ADR 候補の起票・確定・ADR 候補の PR、「委任」の段 1 の段 6 の ADR 候補の確定と ADR 候補の PR、「PR やブランチが 2 本以上になる課題」の ADR 候補の PR の項（メインが既定の経路で委任する）、`issue-run-worker` の定義の「してはいけないこと」の ADR 候補 Issue の起票と ADR 候補の PR、設計・計画の段の「ADR 候補 Issue は起票しない」。

倒れる向き: 設計と ADR 候補の本文を書いた main が、授権の下で確定まで打つ。受けるのは整合のレビューと ADR 候補の PR のレビュー（どちらも別の worker）と確定の内容検査で、宣言欄を緩めない側に書き違えた回は素の形で確定まで通る（fail-open）。8 の確かめを飛ばすと課題のブランチ（か計画の段の起点）が古い base から切られ、受けるのはコードレビューの base の照合だけである（fail-open）。

**判定 JSON の `build` ブロック（`sourceMatch` / `dirty` / `degraded`・欠落した回の読み方を含む）の読み方は `shirokuma-flow gate limits --sub limits` の `H19` が正本**（ここに写さない）。`stale` を名乗った回・`build` ブロックそのものが無い回は、その判定を現ソースの値として読まない。`stale` と `build.dirty: true` が同時に立つ回は、その判定を根拠に使わない。`build.dirty: null`（焼いていない）は、再現性の担保が無い側として `build.dirty: true` と同じに読む。
