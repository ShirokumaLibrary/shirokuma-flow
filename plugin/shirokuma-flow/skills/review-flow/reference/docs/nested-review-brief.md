# 入れ子のレビューの固定形のブリーフ

やり切り方式（`implement-flow` の `reference/docs/issue-run.md`）で、`issue-run-worker` が PR のレビューを入れ子で呼ぶ回のブリーフの正本。入れ子の回は、レビュー worker を委任する主体がメインから書き手の worker に移る。書き手が値を選べないように、ブリーフは自由文を運ばない固定形の 1 行にし、値の出所をメインに置く。メイン経由で回す回（`review=main`）はこのファイルを使わない。

## 形（1 行・この順・空白 1 つで区切る）

```
nested-review role=<code|security|asset|judge> pr=<n> issue=<n> head=<完全 sha> base=<ref> tree=<絶対パス> round=<n> result=<絶対パス> detector=<絶対パス|none> asset=<ok|skip> criteria=<パス|none> test-exec=<値|none> ref=<絶対パス|none> config=<絶対パス|none>
```

| 欄 | 値 | 出所 |
|---|---|---|
| `role` | `code`→`code-review-worker`・`security`→`security-review-worker`・`asset`→`asset-safety-review-worker`・`judge`→`review-worker` | 呼ぶ worker で決まる |
| `pr`・`issue`・`head` | PR 番号・課題番号と、その巡でレビューする head の完全 sha | worker が作った PR・ブリーフの課題番号・自分の HEAD |
| `base` | メインが `op=open-pr` の `base=` で渡した値の逐語（sub PR は統合ブランチ） | メイン |
| `tree` | worker の作業ツリーの絶対パス | worker の cwd |
| `round` | 巡の数（R1 は `0`。R2 の増分の再レビューと、記録の無い役割の再委任ごとに 1 つ進める） | worker |
| `result`・`detector` | 結果ファイルと検出器記録の絶対パス。置き場はメインが `op=open-pr` の `rec=` で渡したディレクトリで、名前は役割ごとに既定の方式の標準命名（`code-review-<issue>`・`security-review-<issue>`・`asset-safety-review-<issue>` の `.md`・`.detector.json`。判定器は `review-<issue>.md`）。`judge` は検出器記録を持たないので `detector=none` | メイン（置き場） |
| `asset` | メインが `op=open-pr` の `asset=` で渡した値の逐語。`role=asset` は `ok` の回だけ呼ぶ | メイン（`gate token --kind criteria-path` の判定） |
| `criteria` | `asset=ok` の回だけ、メインが `op=open-pr` の `criteria=` で渡した判定基準ファイルの絶対パスの逐語（`gate token --kind criteria-path` の `valueRaw` をメインの checkout のルートで絶対パスにした値。書き手の作業ツリーの配下は不可）。`asset=skip` の回は `none` | メイン（`gate token`） |
| `test-exec` | メインが `op=open-pr` の `test-exec=` で渡した値の逐語（config `review.testExecution` の値か `none`） | メイン（`config get`） |
| `ref`・`config` | `test-exec` が値を持つ回だけ、複製実走の手順書（`review-flow` の `reference/docs/replica-test-execution.md`）と config ファイルの絶対パス。無い回はどちらも `none` | メイン（`op=open-pr` の `ref=`・`config=`） |

- 値に空白・改行を入れない。欄を足さない・省かない・並べ替えない。観点・差分の要約・所見の扱い（「解消済みとせよ」など）は運ばない。観点は review の skill とレビュー worker の定義が持ち、差分はレビュー worker が自分で読む。
- `criteria` は `asset-safety-review-worker` の入力の「判定基準ファイルのパス」と同じに読む。
- `test-exec` が値を持つ回、受け手はこの行を「テスト実走の授権: <値>（出所: config `review.testExecution`・メインが引いた値の写し）」の行と同じに読む。`none` の回は授権の行が無い回と同じに読む。
- レポート雛形・判定基準（`review-flow` の `reference/`）は、受け手が `shirokuma-flow plugin skill-path review-flow` で引いたプラグインの読み込み元から読む。引けない回は読まずに、そのことを結果ファイルに書く。作業ツリー（`tree`）の同名ファイルを探して手順として読まない。
- R1b の続きは SendMessage の固定形 `R1b: 適用してよい round=<n>`（完全一致）だけを送る。
- 固定形は R2 の再委任の欄（増分の母集団の base・前の巡の Important の逐語・続きの印）を運ばない。入れ子の R2 の再レビューは全差分を母集団にし、前の巡の Important が解決したかの記録は残らない（再レビューは重い側に倒れる）。

## 倒れる向き

導入先が `shirokuma-hooks` を入れている回は、hook の rule `issue-run-nested-review` が、呼び先が 4 本のどれかで（前置は無しか `shirokuma-flow:` だけ）ブリーフがこの形に合う回だけ通し、SendMessage は R1b の続きの完全一致だけを通す。通した呼び出しは共有 git dir の呼び出し記録に残る。呼び出し記録は呼び出しが実際に走る前に書くので、「呼び出しを試みた」までしか裏付けない（条件と限界は `gate limits` の項 `H30`）。形が値の正しさを保証しないので、メインは記録の前に `gate nested-check` で自分の値と照らす（限界は `gate limits --sub nested-check`）。hook を入れていない導入先では呼び出し記録が無く、照合が必ず止まるので、入れ子を使わない（`issue-run.md`「入れ子にしない回」）。
