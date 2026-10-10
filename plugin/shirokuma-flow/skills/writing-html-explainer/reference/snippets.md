# 部品カタログ（writing-html-explainer）

`<main>` を埋めるときにコピーする HTML 部品。クラスは `.shirokuma/pages/assets/style.css` が定義済み。既に生成済みのページがあれば、その `index.html` が現物の使用例になる。

## ヒーロー（`.hero`）

ページ冒頭で「このページは何か」を強く示す。`.eyebrow` は省略可。

```html
<div class="hero">
  <p class="eyebrow">EXPLAINER · 2026-06</p>
  <h1>ページタイトル</h1>
  <p class="lead">1〜2 文の要約。<strong>強調</strong>は控えめに。</p>
  <div class="tags">
    <span class="tag ok">推奨</span>
    <span class="tag">中立ラベル</span>
    <span class="tag question">論点</span>
  </div>
</div>
```

`<section class="hero">` でも可。

## サマリーカード（`.summary-card`）

セクションのまとめ・重要事項を 1 ブロックに集約。3 バリアント。

```html
<div class="summary-card warn">
  <span class="label">重要</span>
  <p>注意・要対応の事項。</p>
</div>

<div class="summary-card ok">
  <span class="label">確認済み</span>
  <p>検証済み・確定の事実。</p>
</div>

<div class="summary-card">
  <span class="label">補足</span>
  <p>中立的な追加情報。</p>
</div>
```

| クラス | 用途 |
|--------|------|
| `.summary-card.warn` | 注意・重要 |
| `.summary-card.ok` | 確認済み・成功 |
| `.summary-card`（無印） | 中立補足 |

## 限界・不確実性・却下代替案の固定枠

要約で最初に消える情報（限界・不確実性・却下した代替案）を**畳まず・末尾に流さず**構造保全する枠。判断が重い確定ステージ（要件 / 設計）で使う。**既存クラスのみ・CSS 追加なし**が第一候補。基準と使いどころは [[html-readability]]「認知的関与」節を参照。

```html
<div class="summary-card warn">
  <span class="label">限界・却下代替案</span>
  <ul>
    <li><strong>限界 / 不確実性</strong>: ここで確定していない点・前提が崩れる条件。</li>
    <li><strong>却下した代替案</strong>: 案 X（却下理由）／案 Y（却下理由）。</li>
  </ul>
</div>
```

- `<details>` に入れない（畳むと最初に読み飛ばされる）。ページ末尾でなく判断の近くに置く。
- 却下理由まで一行で残す（「却下した」だけにしない）。

## 承認前の能動的問い

承認の**手前**に置き、読者に**自分の見立てを先に言語化**させる枠（生成効果）。結論は BLUF で即出ししてよいが、承認直前にこの 1 問を挟む。判断が重いステージのみ・軽微ステージでは過剰摩擦にしない。**既存クラスのみ・CSS 追加なし**が第一候補。基準は [[html-readability]]「認知的関与」節を参照。

```html
<div class="summary-card">
  <span class="label"><span class="tag question">先に考える</span></span>
  <p><strong>承認の前に一言で</strong>: この判断を自分の言葉で言い換えると？／最も引っかかる点は？</p>
  <p>（自分の見立てを先に出してから、下の結論と突き合わせてください。）</p>
</div>
```

- 問いは 1 つに絞る（摩擦を全体に薄く塗らず時間的に分離）。
- 再構成 1 問（自分の言葉で言い換え・具体化）で「分かった気」を検証させる。

## カードグリッド（`.card-grid` > `.card`）

選択肢・観点を横並びで比較（`auto-fit` で自動折り返し・モバイルで 1 列）。

```html
<div class="card-grid">
  <div class="card">
    <p><span class="tag ok">案 A（推奨）</span></p>
    <h4>見出し</h4>
    <p>説明文。</p>
  </div>
  <div class="card">
    <p><span class="tag">案 B</span></p>
    <h4>見出し</h4>
    <p>説明文。</p>
  </div>
</div>
```

## タグ（`.tag`）

インライン本文中のラベル。意味色付き。

```html
<span class="tag">中立</span>
<span class="tag ok">推奨（緑）</span>
<span class="tag orch">orchestrator（青）</span>
<span class="tag worker">worker（緑系）</span>
<span class="tag gate">gate（黄）</span>
<span class="tag question">論点（紫）</span>
```

## タイムライン（`ol.timeline`）

順序付き手順。番号は CSS の `counter()` で自動採番。**`ol.timeline > li > span.t-tag` 構造**（`.tl-item` 等は無効）。

```html
<ol class="timeline">
  <li><span class="t-tag status">STATUS</span>ステータス変更<span class="desc">補足（任意）</span></li>
  <li><span class="t-tag worker">WORKER</span>worker へ委任</li>
  <li><span class="t-tag check">CHECK</span>調査・確認</li>
  <li><span class="t-tag ai">AI</span>AI 判定</li>
  <li><span class="t-tag gate">GATE</span>人の承認</li>
</ol>
```

`.t-tag` 色: `status`（青）/ `worker`（緑）/ `check`・`task`（グレー）/ `ai`（紫）/ `gate`（黄）/ `post`（amber）。

## コールアウト blockquote

```html
<blockquote>通常の引用・前置き</blockquote>
<blockquote class="callout">成功・確定事項（緑左ボーダー）</blockquote>
<blockquote class="warn">既知の問題・注意（黄背景）</blockquote>
```

## テーブル（`<table>`）

一覧データはそのまま `<table>`。`<thead>` / `<tbody>` を付ける。

```html
<table>
  <thead><tr><th>項目</th><th>意味</th></tr></thead>
  <tbody>
    <tr><td><strong>用語</strong></td><td>説明。<code>identifier</code> は code で囲む。</td></tr>
  </tbody>
</table>
```

## メタ（`.meta`）

ページ末尾のファイル情報・出典フッター。

```html
<div class="meta">
  <strong>用途</strong>: 確認用 What<br>
  <strong>Issue</strong>: <a href="...">#N タイトル</a><br>
  <strong>出典</strong>: <code>.shirokuma/pages/specs/billing-rules/</code>
</div>
```

## SVG 図（`.diagram`）

`role="img"` + `aria-label` + `viewBox` を付ける（読み上げで図の意味を伝え、幅に合わせて縮めるため）。色は SKILL の推奨パレットから選び、`<text>` には `fill` を必須指定（ダーク対応）。box は fill=soft / stroke=mid、矢印は `<marker>`。

```html
<div class="diagram">
<svg viewBox="0 0 540 160" xmlns="http://www.w3.org/2000/svg"
     role="img" aria-label="2 ノードのフロー図">
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="9" markerHeight="9" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#87867F"/>
    </marker>
  </defs>
  <rect x="40" y="50" width="160" height="60" rx="8"
        fill="#dde5ef" stroke="#4d7299" stroke-width="2"/>
  <text x="120" y="78" text-anchor="middle" font-size="13" font-weight="700"
        fill="#2c4d75">起案</text>
  <text x="120" y="96" text-anchor="middle" font-size="10" fill="#2c4d75">作業者</text>

  <rect x="340" y="50" width="160" height="60" rx="8"
        fill="#dde5d0" stroke="#788C5D" stroke-width="2"/>
  <text x="420" y="84" text-anchor="middle" font-size="13" font-weight="700"
        fill="#4f5f3d">承認</text>

  <line x1="200" y1="80" x2="336" y2="80" stroke="#87867F" stroke-width="2"
        marker-end="url(#arr)"/>
</svg>
</div>
```

単純な図は `fill="var(--bg-soft)"` / `stroke="var(--border)"` / `fill="var(--fg-strong)"` の CSS 変数でも自動追従する（登録不要）。
