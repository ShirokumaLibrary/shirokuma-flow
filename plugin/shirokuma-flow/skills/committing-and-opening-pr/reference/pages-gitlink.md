# pages submodule と gitlink bump

`.shirokuma/pages`（確認ビュー・pages submodule）を触った回の扱い。submodule の**内容**（HTML など）の push と、親リポの `.shirokuma/pages` **gitlink（ポインタ）の bump** を別々に判断する。gitlink の bump は commit を打つ本人が、作業ブランチのコミットとして行う。読み手は skill `committing-and-opening-pr` の「コミット」節の読み手と同じ。

- **submodule の内容の push は常に即時でよい**（base に関わらず。規範 `pages-preview-infra` 層 2 の永続化は AI 自律）。書き込みは `shirokuma-flow pages push` に限る。
- **親リポの gitlink の bump は base で分ける**: base が mainline（通常の課題・統合ブランチを介さない PR）なら bump してよい。**base が `epic/*`（サブ PR）なら、このコミットで bump しない**——gitlink の前進は統合の集約で 1 回（統合ブランチ→mainline の統合 PR、または統合ブランチ上の単一の集約コミット）にまとめる。兄弟のサブ PR が同じ統合ブランチへ gitlink を別々に進めると、片方の merge 後にもう片方が gitlink の衝突（`mergeable_state: dirty`）を起こし、CI が黙って発火しなくなるため。**遅らせるのは gitlink の bump だけで、内容の push は止めない**。
- **ADR 候補の PR（ADR 候補 Issue を `Closes` する確定後の追従の PR）は base が既定ブランチなので、gitlink を前進させる側**（統合ブランチ配下の課題でも同じ・正本は規範 `branch-workflow`「統合」）。
- **base の判定**: 起動元・呼び出し側の手順が base を渡していればそれを使う。無ければ現在ブランチに対応する PR の base（`shirokuma-flow pr list --head '<ブランチ>'` で引く）が `epic/` で始まるかで分ける。PR がまだ無い回は、規範 `branch-workflow` の検出順で決まる base を使う。
- **base が `epic/*` の回に `shirokuma-flow git commit-push` を使わない**: この verb は全変更（`git add -A`）をステージするので、動いた gitlink もステージしうる。`git add <パス>` で gitlink を除いて列挙してから手で commit する。
- **mainline ガードとの関係**: 「コミット」節のブランチの許可が縛るのは手で組む git で、gitlink の bump も作業ブランチ・統合ブランチ上のそのブランチのコミットとして行う。`shirokuma-flow pages push` が verb の中で mainline へ行う gitlink の bump は機械の保証付きの限定の例外で、ブランチの許可を緩めない（正本は規範 `pages-preview-infra`）。
- **作業セッションの clone**: 作業セッションの作業ツリーでは、submodule は `shirokuma-flow pages expand` が展開したローカル clone で、そこから push した commit は人の作業ツリーの submodule には入らない（skill `issue-run-flow` の `reference/procedure.md` の「段と手順書」）。
