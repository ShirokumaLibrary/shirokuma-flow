---
name: writing-html-explainer
description: 確認用 What を HTML で可視化する解説ページを、pages submodule の共有テンプレートで生成する。Use when 「HTML で詳しく」「HTML 解説」「確認用ページ」と言われたとき。
allowed-tools: Read, Write, Edit, Bash
model: opus
---

# writing-html-explainer（確認用 HTML 解説の執筆）

人に確認させる **What**（設計案・コンセプト・レビュー結果・計画・実装サマリー）を、Markdown では潰れる情報密度のまま HTML 1 枚に可視化する変更系 worker。Issue / Discussion / PR の本文には**概要**を残し、図・案比較・全決定の**詳細はこの HTML が正本**になる。この宣言は**生成した回に掛かる**——[[html-report-criteria]] の節「生成の発火（既定は生成しない）」は**既定を生成しない側に置く**ので、生成しなかった回（＝同節の OR 条件がどれも成立しなかった回）の詳細の正本は Issue / PR 本文である。状態遷移はしない（orchestrator の責務）。pages submodule への commit/push（`shirokuma-flow pages push`）は直後に orchestrator が自律実行し、通常のコード commit は commit-worker が担う。

短い説明や図の要らない内容は HTML 化しない（`writing-manual` で Markdown）。HTML を選ぶのは「視覚整理が読みやすさに直結する」場合のみ。

## 配置（pages submodule）

`.shirokuma/pages/{category}/{topic}/index.html` に置く。`{category}` は下表の**代表的なキー**から選ぶ。`{topic}` は kebab-case の短い slug（または Issue 番号）。**索引を自動生成する仕組みを持つ構成では、その仕組みが持つカテゴリ一覧が正本**——下表はその部分集合でありうる（索引生成器が下表に無いカテゴリを持つ構成がありうる）。下表に無いカテゴリのページを見つけても規約違反と判定せず、まず索引側の一覧を引く。

| category | 用途 | パス例 |
|----------|------|--------|
| `specs` | 恒久的な仕様・コンセプト | `.shirokuma/pages/specs/billing-rules/` |
| `issues` | Issue #N の確認用 What・設計レビュー | `.shirokuma/pages/issues/<番号>/` |
| `explainers` | Issue 補足の一時的な解説 | `.shirokuma/pages/explainers/{slug}/` |
| `prs` | PR の補足 | `.shirokuma/pages/prs/{N}/` |
| `reviews` / `status` / `incidents` | レビュー・報告・ポストモーテム | `.shirokuma/pages/reviews/{slug}/` |

共有アセットは **pages ルート直下の `assets/`**（`.shirokuma/pages/assets/` ＝ `style.css` / `theme.js` / `modern-normalize.css`）に **1 組だけ**置く。各ページからは**絶対パス**（`/assets/style.css?v=N`）で参照し、**ページごとに `assets/` を複製しない**（複製するとテーマ変数がページ単位で分岐し、`?v=N` の一括更新も効かなくなる）。

**この 3 ファイルは本スキルに同梱されている**（`assets/style.css` / `assets/theme.js` / `assets/modern-normalize.css`）。初回セットアップでそこから pages リポへコピーする＝**配布物だけで完結する**（下記「初回」）。

### 初回（pages を一から作るとき・assets が未配置のとき）

1. **同梱アセットを pages ルート直下へコピーする**（**このスキルのディレクトリから**・`{skill}` は本 SKILL.md が置かれているディレクトリ）:

   ```bash
   mkdir -p .shirokuma/pages/assets
   cp {skill}/assets/style.css {skill}/assets/theme.js {skill}/assets/modern-normalize.css .shirokuma/pages/assets/
   ```

   各ページ HTML はここでは作らない（次節の生成手順で作る）。
2. **プレビュー配信手段が用意されているかを確認する**。`.shirokuma/pages/` を配信し `pages.baseUrl` から見える状態になっていること。**配信手段の用意そのものは本スキルの射程外**で、自律境界と前提の正本は [[pages-preview-infra]]（具体の実現手段はプロジェクト側が正本）。

### 既存ページの移行（共有アセットが後から入った pages）

共有アセットを使わず**自己完結で**書かれた既存ページ（`<style>` ブロックや `style=` 属性を持つもの）は、共有アセットを置いたプロジェクトでは `lint areas docs` の `pages-no-inline-style`（error）へ一斉に当たる。**手順・必ず含める 2 点（落とす前の assert・`issue-body-sha256` を消さない）・完了判定は `reference/migrating-existing-pages.md`**。一時的に母集団から外す仕組みは持たない（移行を完走する）。

### 生成（主経路・配布物だけで完結する）

1. **同梱テンプレートをコピーして置く**（`{skill}` は本 SKILL.md が置かれているディレクトリ）:

   ```bash
   mkdir -p .shirokuma/pages/{category}/{topic}
   cp {skill}/reference/template.html .shirokuma/pages/{category}/{topic}/index.html
   ```

2. **`{...}` のプレースホルダを埋める**——`<title>` / `<body data-parent-href=... data-parent-label=...>` / hero の各項目。親ページが無ければ `data-parent-*` は属性ごと消す。
3. **共有アセットの `?v=N` を、その pages に置かれている `assets/` の現物に合わせる**。同梱テンプレートの値は同梱アセットに対応しているので、初回セットアップ直後は**そのままで一致している**。以後 `assets/` を更新して `?v=N` を上げたら、テンプレート由来の新規ページも同じ値に揃える（§「アセット更新」）。
4. **Issue 確認ビューなら本文 hash を埋める**（下記「骨格」の drift lint の項）。
5. **索引（トップの一覧ページ）を持つ構成なら再生成する**。再生成の手段はプロジェクト側が正本（本スキルではコマンドを断定しない）。

**自動化されるのは骨格とメタだけである。本文 `<main>` の中身は下記「執筆原則」「守る作法」に従い自分で書く。**

## 骨格（`reference/template.html` が正本。以下は参考表示）

```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ページタイトル</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Kosugi+Maru&family=M+PLUS+Rounded+1c:wght@500;700&family=M+PLUS+1+Code:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/style.css?v=26">
</head>
<body data-parent-href="/specs/billing-rules/" data-parent-label="料金規則">
<main>
  <div class="hero"> ... </div>
  <h2 id="sec-1">1. 大項目</h2>
  ...
</main>
<script src="/assets/theme.js?v=5"></script>
</body>
</html>
```

> この参考表示は骨格の説明用で、`reference/template.html` と字句レベルで同一ではない（プレースホルダ・本文の中身・`initial-scale` の書き方が違う）。ただし**アセットの読み込み位置と `?v=` の値は正本に揃えてある**（`theme.js` は `</main>` の直後・`defer` を付けない）。手で写すときは、この 2 点を正本どおりにする。

- **本文は `<main>` のみ書く。** サイドバー（`<aside class="toc">`）はテーマトグル・目次・親ナビごと `theme.js` が自動生成する。
- 親ページがあれば `<body data-parent-href="..." data-parent-label="...">` で定義（不要なら属性ごと省略）。ドキュメントルート `/` へのリンクは常に自動付与。
- 共有アセットの `?v=N` は、その pages の `assets/` に置かれている現物に合わせる（既存ページの値をそのまま写せばよい）。スタイル変更で全ページを一括 +1 するときは §「アセット更新」。
- **インラインスタイル禁止（lint error）**: `<style>` 要素・`style=` 属性は使わない。直書き色がテーマ切替を壊すため、スタイルは `/assets/style.css` のテーマ変数（`--bg-soft`/`--ok`/`--warn`/`--accent` 等）経由のみ。`lint areas docs` の `pages-no-inline-style` が error にする（例外なし）。
- **Issue 確認ビューは本文 hash を埋め込む（drift lint）**: `.shirokuma/pages/issues/{N}/index.html` には元 Issue 本文の sha256 を `<!-- issue-body-sha256: <64桁hex> -->` として 1 行埋め込む。hash は `.shirokuma/github/<owner>/<repo>/issues/{N}/body.md`（`issue context` が作るキャッシュ）を **utf8 で sha256** した値で、`shasum -a 256 .shirokuma/github/<owner>/<repo>/issues/{N}/body.md` で得られる。本文は要約・再構成してよいが、hash は生成時に参照した元 Issue 本文の値。`lint areas docs` の `pages-issue-drift` が現 Issue 本文との乖離を warning で知らせる（埋め込み無し・キャッシュ無しは誤検知防止で skip）。既存ページの再同期は同じ手順で hash 行を書き直す。Issue 番号に紐づかないページでは不要。

## 執筆原則（内容の作法）

1. **hero 直後に要点の `.summary-card` を必ず置く**。中身は 2 つ: 「これで何が変わる / 何が言いたいか」（結論・効果）と「読者に判断してほしい点」。詳細より先に So what。読者がここだけ読めば判断に入れる状態にする。
2. **箇条書きにできるものは箇条書きにする**。`<ul>` / `<ol>` / timeline / table を優先し、長い段落で並べない。
3. **一文を短くする**。一文一義。接続詞でつなげて長くしない。
4. **限界・不確実性・却下代替案は専用の固定枠で残す**。要約で最初に消える情報なので**畳まない・末尾に流さない**（`<details>` に入れない）。要点カードや専用枠で構造保全し、読者に能動的に読ませる。
5. **判断が重い確定ステージでは承認の手前に能動的問いを 1 つ置く**。結論は BLUF で即出ししてよいが、承認直前に「あなたの見立て / 一文言い換え」など**判断の言語化を読者に先行生成させる**。摩擦は提示全体に薄く塗らず**この 1 問に時間的に分離**する。軽微ステージ（PR / 実装サマリー等）では過剰摩擦を課さない。

> 可読性の定量基準（行長・強調率・チャンク数・折りたたみ等）と**認知的関与の基準**（能動的問い・限界/却下代替案の固定枠・ステージ別の優先関係・研究的根拠）は [[html-readability]] を参照。どのステージで認知的関与を必須にするかは [[html-report-criteria]]。上記 4・5 の作法の部品は `reference/snippets.md`。

## 守る作法

ここを外すと表示が壊れるので、執筆中と SVG を足した後に次の 5 点に照らす。

1. **head に Google Fonts の link 必須**（Kosugi Maru / M PLUS Rounded 1c / M PLUS 1 Code）。欠けると warm パレットのフォントが落ちる。
2. **`.toc-grid` を手書きしない。** 目次は `theme.js` が `<main>` 直下の `<h2>` から自動生成する（手書きすると重複）。
3. **timeline は `ol.timeline > li > span.t-tag` 構造。** `.tl-item` 等は無効（CSS に無い）。
4. **SVG はダーク対応ペアの色だけ使う**（下の推奨パレット）。`<text>` には `fill` を**必ず**指定する（未指定だとダークで黒のまま消える）。新規色を使うなら `style.css` の `[data-theme="dark"] .diagram svg [fill="..."]` に暗色ペアを追加し、検証コマンドで未対応 0 を確認する。
5. **`<aside>` を書かない**（`theme.js` 生成領域と衝突する）。

純白 `#fff` / 純黒 `#000`、CSS ライブラリ併用、JS 動的レンダリングはしない（warm palette と静的完結を維持）。

## 部品の早見

`reference/snippets.md` にコピー用の HTML がある。主な対応:

| シーン | 部品 |
|--------|------|
| ページ冒頭の主張 | `.hero`（`.eyebrow` + `h1` + `.lead` + `.tag`） |
| まとめ・重要事項 | `.summary-card`（`.warn` / `.ok` / 無印）+ `.label` |
| 限界・不確実性・却下代替案（畳まない固定枠） | `.summary-card.warn` / `blockquote.warn`（既存クラス） |
| 承認前の能動的問い（判断を先行生成） | `.summary-card` + `.tag question`（既存クラス） |
| 選択肢の横並び比較 | `.card-grid` > `.card` |
| 状態・分類ラベル | `<span class="tag">`（意味色: `.ok` 緑 / `.warn` 警告色 / `.question` 紫。役割色: `.orch` = orchestrator〔青〕/ `.worker` = worker〔緑〕/ `.gate` = 人ゲート〔警告色〕。優先度色: `.priority-high` 赤 / `.priority-medium` 警告色 / `.priority-low` 無彩色。無彩色: `.status`） |
| 順序付き手順 | `ol.timeline > li > .t-tag` |
| 一覧データ | `<table>` |
| 全体図・関係図 | SVG（推奨パレット） |
| ファイル情報フッター | `.meta` |

**クラス名の正本は共有シート `.shirokuma/pages/assets/style.css`**（上表はその写し。同梱の `{skill}/assets/style.css` は同じ内容の配布用の種）。存在しない派生（`class="tag xxx"` の `xxx`）を書いても HTML は valid なのでスタイルが当たらないことに気づけない。**使う前にシートで確かめる**: `grep -nE '\.tag(\.|,|\s*\{)' .shirokuma/pages/assets/style.css`。

`lint areas docs` の `pages-unknown-class-variant`（error）は**一部しか捕まえない**——検出できるのは「シートが派生名として使っている語を、その組み合わせが定義されていない base に付けた場合」だけで、**シートのどこにも現れない名前（打ち間違い・架空の派生名）は 0 件のまま通る**。guard を通ったことを「クラスが実在する」証拠に使わない。

意味色と役割色は**視覚的に重なる**（`.ok` と `.worker` は同じ緑、`.warn` と `.gate` と `.priority-medium` は同じ警告色）。区別は保守上の意味付けなので、読者に色で区別させる設計にしない。

SVG 推奨カラーペア（fill / stroke / text・いずれもダーク対応済み）:

| 用途 | fill | stroke | text |
|------|------|--------|------|
| process（青） | `#dde5ef` | `#4d7299` | `#2c4d75` |
| ok（緑） | `#dde5d0` | `#788C5D` | `#4f5f3d` |
| upstream（紫） | `#e6dde9` | `#856ea3` | `#4b3680` |
| warn / gate（黄褐） | `#f0e3c0` | `#b08838` | `#6e5417` |
| danger（赤褐） | `#ecd6cd` | `#a85040` | `#6e2f25` |
| neutral | `#F0EEE6` | `#D1CFC5` | `#3D3D3A` |

## 手順

1. **category / topic / タイトル / 親ページ**を確定（不明なら確認）。
2. **生成**: §「生成（主経路・配布物だけで完結する）」の 1〜5。
3. `.shirokuma/pages/{category}/{topic}/index.html` の `<main>` を埋める。各 `<h2>` に `id` を付ける（deep link 用）。
4. SVG を入れたら**ダーク対応を自己検査する**（書いた本人がスクリプトで確かめる・`.shirokuma/pages/` を cwd にして実行）:
   ```bash
   for c in $(grep -oE '(fill|stroke)="#[0-9A-Fa-f]{3,6}"' {category}/{topic}/index.html \
               | grep -oE '#[0-9A-Fa-f]{3,6}' | sort -u); do
     grep -q "\[fill=\"$c\"\]\|\[stroke=\"$c\"\]" assets/style.css || echo "未対応: $c"
   done   # 何も出なければ全色がダークに追従
   ```
5. **表示確認**: プレビュー配信手段が用意されている構成なら、**書いた時点で `pages.baseUrl` 配下の `/{category}/{topic}/` に反映**される（`shirokuma-flow config get pages.baseUrl` で起点を引く）。ライト / ダーク切替・TOC スクロール・SVG がダークで読めるかを見る。**配信手段の前提と、既にあるならローカルサーバを別途立てないという規律は [[pages-preview-infra]] が正本。**
6. **`<main>` を変えたら索引のタイトルだけ再同期**（任意・タイトル変更時・索引を持つ構成のみ）。

## ユースケース: closure-suggest 候補の人向け提示

`closure-suggest` が出す候補 JSON（`candidates[]`）を、人が **どの祖先をどう閉じるか**を判断・実行できる確認用 What に可視化する。auto-close されなかった祖先（継続型・非完了 close〔NOT_PLANNED / DUPLICATE〕の子持ち）を棚卸しし、推奨アクションを添えて並べる。

**モードは起動元から受け取る（提案／実行済み）。既定は提案**——**実行済みとして書けるのは、起動元が明示し、かつ閉じた祖先の番号を渡してきた回に限る**。それ以外（未指定・曖昧・番号が無い）はすべて提案として書く。**実行済みモードが発火するのは、祖先クローズの自動実行を認める決定が成立している構成だけ**で、その決定が無い構成では起動元が実行しないので番号も渡らず、常に提案になる。**指定が無いのに実行済みとして書かない**（人の判断待ちのものを「済んだこと」として見せてしまうため）。

- **候補ゼロは無音**: `candidates: []`（閉じうる祖先なし）のときは **HTML を生成しない**。人に見せるべき判断が無いので提示も索引追加もしない（不要なページを残さない）。
- **候補ありのとき生成**: `candidates[]` が 1 件以上なら、祖先ごとに 1 行（または 1 カード）で一覧化する。各候補のフィールドは `ancestor`（祖先 Issue 番号）・`whyNotAutoClosed`・`remaining`・`recommendedAction` の 4 つ（`kind` フィールドは無い）。各祖先で示すもの:
  - **Issue 番号**（`ancestor`）。何の祖先か（EPIC / Plan / Research）は別途 Issue を引いて補えるが、候補 JSON 自体には `kind` は含まれない。継続型かどうかは `whyNotAutoClosed === "continuous"` から導出する。
  - **`whyNotAutoClosed`**（なぜ自動で閉じられなかったか）: `continuous` = 継続型のため auto-close されなかった / `has-cancelled-child` = NOT_PLANNED で閉じた子（cancel）を持つため / `has-duplicate-child` = DUPLICATE で閉じた子（duplicate）を持つため。複数該当時の優先順は continuous > has-cancelled-child > has-duplicate-child。
  - **残件サマリー**: `remaining.cancelledChildren`（NOT_PLANNED で閉じた子の番号リスト）・`remaining.duplicateChildren`（DUPLICATE で閉じた子の番号リスト）・`remaining.continuousChildren`（継続型の子の番号リスト）。空配列はその種別の残件なしとして省略してよい。
  - **推奨アクション** (`recommendedAction`): `keep` = 継続維持（閉じない）/ `done` = 完了として close の **2 値のみ**（`cancel` は出力されない）。`continuous` の候補は `keep`、完了型の候補（`has-cancelled-child` / `has-duplicate-child`）は `done` が入る。`<span class="tag">`（`keep`→無印 / `done`→`.ok`）で色分けすると判断が速い。
  - 人が**そのまま判断・実行できる形**にする。各行に、その祖先を閉じる/維持する際に使う既存 verb を明記し、何をすれば状態が動くかを読者が迷わないようにする。AI ツールの推奨値は `keep`/`done` の 2 値だが、**人が close する際に既存 verb の `done`（完了）・`cancel`（キャンセル）・`duplicate`（重複として集約）のどれを使うかは人の判断**（AI ツールの推奨値とは別軸）。維持はそのまま（verb 不要）。
- **このスキル自身は状態遷移を実行しない**: HTML を書くのが役割で、close / done / cancel は起動元の判断と手順に属する。`.summary-card` の「読者に判断してほしい点」には、**その回のモード（提案／実行済み）を明示する**——両者で読者に求めるものが逆になるため、どちらか一方を決め打ちで書かない。**モードが渡されていなければ提案として書く。**
  - **提案として出す回**（人が判断する経路）: 閉じる / 維持の最終判断と実行は人が既存 verb（`done` / `cancel` / `duplicate`）で行う旨を書く。
  - **実行済みの記録として出す回**: **書いてよいのは、起動元が「実行済み」と明示し、かつ実際に閉じた祖先の番号を渡してきた回だけ**。番号が渡っていなければ提案として書く（「自動実行されたはず」と推測して書かない）。内容は**どの祖先をどの `recommendedAction` で閉じたか**・親カスケードの波及先・**差し戻すコマンド**（`shirokuma-flow issue reopen <n> --to "<status>"`）。読者に求めるのは判断ではなく事後確認なので、未実行であるかのように書かない。
  - **判断に迷ったら提案として書く**（既定は提案側＝読者に判断を残す形。誤って「済んだこと」として見せるほうが害が大きい）。
- **HTML の配置**: 上の「配置（pages submodule）」の既存作法に従う。提示対象の起点祖先が Issue なら `.shirokuma/pages/issues/{番号}/`、横断的な棚卸しなら `explainers` / `status` など適切なカテゴリに置く（骨格は §「生成（主経路）」で作る）。一覧は `<table>` か `.card-grid` を使い、長い段落で並べない。

## 破棄（古い確認ビューの削除）

不要になった確認ビューは、**先に参照元を洗ってから** ディレクトリごと消す（主経路）。手順は 2 つのブロックに分かれる。**各ブロックはそれぞれ 1 回の呼び出しで丸ごと打つ**——シェル変数は呼び出しをまたいで残らないので、行を分けて打つと `n` が空になる。両ブロックの先頭で `n` を設定し直し、⓪'' が空・数字以外の値を削除の前に落とす。

ブロック A（参照元を出す・読むだけ）:

```bash
root="$(git rev-parse --show-superproject-working-tree)"; [ -n "$root" ] || root="$(git rev-parse --show-toplevel)"
cd "$root"                                 # ⓪ cwd を親リポのルートに固定する（pages submodule の中から実行しても親へ出る）
[ -d .shirokuma/pages ] || { echo "cwd が親リポのルートでない: $PWD"; exit 1; }   # ⓪' ⓪が外した回を沈黙させない
n='{番号}'                                 # 消す確認ビューの Issue 番号に置き換える
case "$n" in ''|*[!0-9]*) echo "番号が空か数字でない: '$n'（プレースホルダ未置換）"; exit 1 ;; esac   # ⓪'' 空の値で issues 配下全体を指さない
grep -rn "/issues/$n/" .shirokuma/pages    # ① 消える URL の参照元を先に出す（dry-run 相当）
```

ブロック B（①の出力を読んでから打つ・消す）:

```bash
root="$(git rev-parse --show-superproject-working-tree)"; [ -n "$root" ] || root="$(git rev-parse --show-toplevel)"
cd "$root"                                 # ⓪
[ -d .shirokuma/pages ] || { echo "cwd が親リポのルートでない: $PWD"; exit 1; }   # ⓪'
n='{番号}'                                 # ブロック A と同じ番号
case "$n" in ''|*[!0-9]*) echo "番号が空か数字でない: '$n'（プレースホルダ未置換）"; exit 1 ;; esac   # ⓪''
if [ -d ".shirokuma/pages/issues/$n" ]; then rm -r ".shirokuma/pages/issues/$n"   # ② 対象 1 ディレクトリだけを消す
else echo "対象が無い: .shirokuma/pages/issues/$n（cwd 誤り）"; fi
shirokuma-flow lint areas docs             # ③ 参照切れ・親ナビ・孤児を表面化
```

**②の対象は `.shirokuma/pages/` 配下の 1 ディレクトリに限る。** ワイルドカードを使わない・`-f` を足さない・pages の外を指さない（消せるのは自分が生成した確認ビューだけで、それ以外は本スキルの射程外）。**①を飛ばして②へ進まない**——参照元が残ったまま消すとリンク切れになる。

**⓪ / ⓪' / ⓪'' と `[ -d … ]` は散文の遵守に頼らず落とすためにある**（守る/守らないを読み手の注意力に委ねない）。cwd がリポジトリルート以外だと相対パスが別の場所を指しうるので⓪でルートへ固定する。**⓪で `--show-superproject-working-tree` を先に引くのは、pages submodule の中を cwd にしている回（本スキルの手順 4 がその形）に `--show-toplevel` が親リポではなく submodule のルートを返すため**——そのまま進むと以後の相対パスが 1 段ずれ、①は「該当なし」、②は対象不在で何もせず、それが**削除に成功した形と見分けられない**（`rm` は成功しても何も言わない）。⓪' はそのずれが残った回を明示的に落とし、②の `else` は対象不在を**cwd 誤り**として言葉にする（黙って終わらせない）。⓪'' は**空の値とプレースホルダを置換し忘れた形**（数字でない値）を**削除の前に**落とす——空のまま②へ進むと `.shirokuma/pages/issues/` 全体が対象になる。`[ -d … ]` は数字だが実在しない番号を、何もせずに言葉にする。いずれも一時的な安全網ではなく手順の一部なので省かない。

削除後の `lint areas docs`（`pages-orphan`/`pages-not-in-index`/`pages-parent-nav`）が、削除で生じた参照切れ・親ナビ不整合を warning で知らせる。索引を持つ構成なら索引も再生成する。

**本スキルは working tree の生成/削除＋索引まで（自律）。submodule への commit/push も AI 自律**（`shirokuma-flow pages push`・`pages-preview-infra` 層2）。親リポの `.shirokuma/pages` gitlink ポインタ bump も同 verb が mainline 上でのみ pathspec 限定 commit → direct push する自律の限定例外（条件と Why は `pages-preview-infra` が正本）。

棚卸し・drift 監査は `shirokuma-flow lint areas docs`（`pages-issue-drift` が乖離を warning で出す）。

## アセット更新（部品追加・スタイル変更時のみ）

`.shirokuma/pages/assets/style.css` か `theme.js` を変えたら、全ページ HTML の `?v=N`（索引を生成する仕組みを持つ構成ならその中の `?v=N` も）を**同じ値で +1**する（ズレるとキャッシュが部分的に古くなる）。確認:

```bash
grep -rnE 'style\.css\?v=|theme\.js\?v=' .shirokuma/pages
```

`modern-normalize.css` は `style.css` 冒頭の `@import "...?v=K"` だけ +1（HTML に直接 link しないため独立）。

**同梱アセットとの二重化に注意**: 本スキルは `{skill}/assets/` に同じ 3 ファイルを配布用の種として持つ。pages の `assets/` を変えても同梱側は変わらないので、次に初期化したページには同梱側の版が配られる。

## リファレンス

| ファイル | 中身 |
|---|---|
| `reference/template.html` | 骨格の正本（生成時のコピー元） |
| `reference/snippets.md` | 部品のコピー用 HTML |
| `reference/migrating-existing-pages.md` | 共有アセットが後から入った pages で、既存ページを移行する手順 |

## 返すもの

生成パス（`.shirokuma/pages/{category}/{topic}/`）・公開 URL・Issue / PR 貼付用の Markdown リンク・索引再生成の有無を圧縮サマリーで返す。**本スキルは working tree の生成＋索引までを担い、submodule への commit/push は行わない**——直後に orchestrator が `shirokuma-flow pages push` で自律実行する（`pages-preview-infra` 層2）。

> orchestrator への注意（副導線・規範の正本は `pages-preview-infra` の「返り値の検分」節）: `pages push` の返り値 `pushed` / `pointerBump.done` を**検分してから**確認 URL を人に提示する。false のまま URL を出すと、未 push の内容を「確認してください」と言うことになる。

> 関連: writing-manual（Markdown）/ design-flow・requirements-flow・reviewing-manual（確認用 What の呼び出し元）/ `pages push`（orchestrator が自律で永続化＝層2）。役割分担: [[html-readability]]＝可読性の定量基準＋認知的関与の基準（正本）/ [[html-report-criteria]]＝いつ・どのステージで HTML 化し認知的関与を課すか / 本スキル＝どう書くか（作法・部品）。
