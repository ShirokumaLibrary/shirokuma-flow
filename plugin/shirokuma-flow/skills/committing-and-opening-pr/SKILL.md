---
name: committing-and-opening-pr
description: commit-worker・pr-worker が変更をコミット・push し PR を作成するときに読む手順書（冪等性・untracked 点検・ブランチの許可・gitlink・PR 本文の照合・実体の確かめ）。メインは起動しない。Use when commit-worker・pr-worker が委任を受けて commit・PR 作成を行うとき。
model: opus
disable-model-invocation: true
---

# committing-and-opening-pr（コミットと PR 作成の手順）

commit は `commit-worker`、PR の作成は `pr-worker` が行う（[[orchestration-discipline]] C16）。本 skill は両 worker が委任を受けたときに読む手順書で、**メインは起動しない**。「コミット」節は `commit-worker`、「PR 作成」節は `pr-worker` が読む。読み手は、委任ブリーフで渡された本ファイルの絶対パス（プラグインのインストール先）を Read する。

## 読む前に

規範（`commit-style`・`branch-workflow`・`github-writing-style` など）は、読み手の worker の第一手の `rules inject --scope worker` が注入する。ここには規範を写さない。

**参照する規範**

- `pages-preview-infra`: 差分が `.shirokuma/pages` に触れる

参照集合（常時は注入しない。契機に当たったら `<rule-index>` の `file` から Read する）。

## コミット

1. **作業ツリー**: 作業ツリーが指定されている回は、git 操作をすべて `git -C '<作業ツリー絶対パス>'` で明示し、**指定された作業ツリーの外で stage・commit・push しない**。
2. **冪等性**: `git -C '<作業ツリー絶対パス>' status --porcelain` で差分の有無を見て、**差分が無ければ commit しない**（再実行で重複 commit を作らない）。
3. **ブランチの許可（許可リスト）**: 現在ブランチ（`git -C '<作業ツリー絶対パス>' rev-parse --abbrev-ref HEAD`）が**作業ブランチ（`{type}/{issue#}` か `{type}/{issue#}-{slug}`。type は `shirokuma-flow branch name <n>` が出す prefix か `hotfix`・名前は同 verb で導出）か統合ブランチ（`epic/*`）のときだけ** commit・push する。名前に使える文字は ASCII の英数字と `.` `_` `-`、区切りの `/` だけ（非 ASCII を含む名前は通らない）。それ以外（mainline〔`shirokuma-flow config get project.defaultBranch`・未設定なら `main`〕・detached HEAD・リリース系列のブランチを含む）では commit せず止める。hooks の push-target は mainline への push を止める二次防御で、mainline 上の commit は止めないので、この確かめの代わりにしない。
4. **ステージ前の untracked 点検**: `git -C '<作業ツリー絶対パス>' status --porcelain --untracked-files=all` を打ち、**`??` の各行がこの課題の成果物かを 1 件ずつ判定する**。判定できないファイルはステージしない（全変更をステージする `shirokuma-flow git commit-push` を使うなら、先に当該パスを撤去するか `git add <パス>` の列挙へ切り替える）。残した `??` は件数とパスを報告に書く。**限界**: 点検と `add` の間に別の実行系が作ったファイルは拾われる（窓を縮めるだけ）。点検したことを確かめる段は無い（fail-silent）。
5. **pages submodule と gitlink**: `.shirokuma/pages` を触った回は、submodule の内容の push と、親リポの gitlink の bump を別々に判断する。
   - **commit 時点の base の決め方**: 起動元が base を渡していればそれを使う。無ければ現在ブランチに対応する PR の base（`shirokuma-flow pr list --head '<ブランチ>'` で引く）が `epic/` で始まるかで分ける。PR がまだ無い回は、規範 `branch-workflow` の検出順で決まる base を使う。
   - **base が `epic/*` の回に `shirokuma-flow git commit-push` を使わない**: この verb は全変更（`git add -A`）をステージするので、動いた gitlink も stage しうる。`git add <パス>` で gitlink を除いて列挙してから手で commit する。
   - 内容の push は base に関わらず行う（`shirokuma-flow pages push`。この verb が行う gitlink の bump は規範 `pages-preview-infra` が定める限定の例外で、上のブランチの許可を緩めない）。
   - **base が `epic/*`（統合ブランチ）なら、親リポの gitlink は bump せず統合の集約まで遅らせる**（兄弟のサブ PR が同じ統合ブランチへ gitlink を別々に進めると衝突する）。base が mainline なら bump してよい。ADR 候補の PR は base が mainline なので bump する側。
6. **コミットと push**: commit を打ち、head ブランチへ名前付きで push する。**完了とする条件**: コミット SHA が `git -C '<作業ツリー絶対パス>' log` に在ること、push が成功したこと。

## PR 作成

1. **base**: 規範 `branch-workflow` の検出順に従う（サブ Issue は親の `epic/*`・ADR 候補の PR は mainline）。head ブランチと base の判定は、どちらも指定された作業ツリー（`git -C '<作業ツリー絶対パス>'`）から取る。
2. **冪等性**: 同じ head ブランチの PR が既にあれば新しく作らない。
3. **本文は毎回新しく書き起こす**: 追跡ツリーの外に新しく書いた一時ファイルを `--body-file` で渡す（または stdin）。キャッシュ（`.shirokuma/github/**/prs/{n}/body.md` など）や別タスクのファイルを流用しない。書くもの:
   - 閉じる課題を `Closes #<番号>` の素の行で（計画スキップ経路の並べ方は `implement-flow` 段 5 が正本）。
   - **実行の証跡**: 品質ゲートで回した機械段（`finalize-worker` の報告表の所在）・終了コード・`検査対象 head sha: <完全 sha>`（回した後にファイルを変えた回・取れない回は `検査対象 head sha: 不明（<理由>）`）。回さなかった段は回さなかったと書く。
4. **作成後の照合**: `shirokuma-flow pr context <番号>` で本文を取り、課題の要件と一致するかを照合する。違えばキャッシュの本文を正しい内容へ書き換えてから `shirokuma-flow pr push <番号>` で直す（書き換えずに `pr push` しても差分なしで何も起きない）。
5. **完了とする条件**: PR が実在し、その番号で引けること。

## 倒れる向き

- **この手順書を読まなくても、各 worker の定義が同じ確かめを持つ**（`commit-worker`・`pr-worker` の定義の各節）。手順書を読んだかを確かめる層は無い（fail-open）。
- `shirokuma-flow git commit-push` は作業ブランチ・`epic/*` 以外での commit を CLI 側でも拒否するが、手組みの `git commit` には効かない。
- 実行の証跡は自己申告で、照合する層は無い。
