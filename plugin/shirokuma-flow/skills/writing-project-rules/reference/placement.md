# 規範の置き場の判定表

`writing-project-rules` の手順 2 で使う。置き場の選択は「誰に届けたいか」という人の意図の読解で、入力から合否は決まらない（判断）。表の「届き方」は CLI と Claude Code の挙動で、選び間違えると規範は黙って届かない。

| 届けたい相手・条件 | 置き場 | 届き方 | 機械段 |
|---|---|---|---|
| フローを編成する orchestrator（各 `-flow` skill）の判断に毎回効かせたい | `.shirokuma/rules/`・`scope: orchestrator` | orchestrator の `rules inject` に本文が載る | lint（frontmatter・同名）＋注入の確認 |
| orchestrator に効かせ、worker には必要なときに引かせればよい | `.shirokuma/rules/`・`scope: default` | orchestrator には本文が載る。`--rules` で集合を固定する worker には `<rule-index>` の 1 行（名前・category・パス・見出し）だけが載り、本文は worker が Read したときだけ読まれる。`--rules` を付けない agent には本文が載る | 同上。worker が読んだかは検査しない（fail-open） |
| 自分のプロジェクトで持つ agent に効かせたい | `.shirokuma/rules/`・`scope: worker` | その agent の定義が `rules inject --scope worker` を `--rules` なしで打つか、`--rules` に名前を書いたときに本文が載る。配布される worker には `<rule-index>` の 1 行だけ | 同上 |
| 配布される worker も含め、毎回の文脈に載せたい | `.claude/rules/`・`paths:` なし | Claude Code がメインとサブの文脈に常に載せる。**advisory で、守ることを強制しない**。守らせる強制は lint / hooks で、この置き場は持たない | 無し（fail-open）。merge 前から、その作業ツリーで有効になる |
| 特定のファイル群を触るときだけ文脈に載せたい | `.claude/rules/`・`paths:` あり | glob に合うファイルを Read した直後に 1 回載る（advisory） | 無し（fail-open）。merge 前から、その作業ツリーで有効になる |
| 手順・地図（How）・プロジェクトの説明 | 規範ではない（`CLAUDE.md` / docs） | — | — |

**worker に本文が載らない理由**: 配布される worker は、第一手の `rules inject --scope worker --rules <名前の列>` で注入する規範の集合を定義の中に固定している。この集合は委任ブリーフで足したり差し替えたりしないので、`scope: worker` / `scope: default` の導入先の規範は、配布される worker には `<rule-index>` の 1 行でしか届かない。

## 表の補足

- **配布物を部分的に変えたい回**: 別の名前の規範を足す。配布物と足した規範のどちらも注入されるので、本文に「配布物 `<名前>` の何を、このプロジェクトではどう扱うか」を書く。書かないと、どちらを優先するかが読み手の判断に残る。
- **`category` と `priority`**: `category` は値域が閉じていない。配布物が使う値（`workflow` / `git` / `quality` / `knowledge` / `github`）か、プロジェクトの分類を使う。`rules inject --category` に知らない値を渡すと exit 1 になる。`priority` は `required` / `recommended` のどちらか。
- **`[[...]]` のリンク**: 導入先では既定で検査されない（`.shirokuma/lint/docs.yaml` で `ruleLinks` を有効にしたときだけ走る）ので、手順 6 の ④ で確かめる。
- **守らせる強制が要る回**: 「必ず守らせる」が要るなら、文脈に載せるだけでは足りない。lint の規則か hooks で止める形を、別に検討するよう人に伝える。
