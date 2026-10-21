---
name: writing-manual
description: Diátaxis ベースの体系的マニュアル（Markdown）を執筆する（短い解説向け・HTML が要るなら writing-html-explainer）。Use when マニュアルを執筆するとき、tutorial/how-to/reference を書き分けるとき。
model: opus
disable-model-invocation: true
---

# writing-manual（Diátaxis マニュアル執筆）

Markdown で体系的なマニュアルを書く。

## Diátaxis 4 区分（混ぜない）
| 区分 | 目的 | 読者の状態 |
|------|------|-----------|
| tutorial | 学習（手を動かして覚える） | 初学者・順に追う |
| how-to | 課題解決（特定の作業手順） | 目的が明確 |
| reference | 参照（正確な仕様） | 調べに来る |
| explanation | 理解（背景・なぜ） | 文脈を知りたい |

1 ドキュメントは 1 区分に寄せる。混在は読者を迷わせる。

## 使い分け
- 短い・テキストで足りる → **writing-manual（Markdown）**。
- 情報密度が高く視覚整理（図・カラー分類・TOC）が読みやすさに直結 → **writing-html-explainer（HTML）**。

## 仕上げ
`shirokuma-flow lint docs`（構造・リンク）を通す。意思決定の Why は ADR（正本ファイル）、用語は glossary。

> 関連: reviewing-manual / writing-html-explainer / lint docs。

## リファレンスドキュメント

区分別のページ雛形（frontmatter 例・節構成・書き方の要点）は本 SKILL.md と同階層の `reference/templates/` 配下。執筆対象の区分が決まったら対応する 1 本を Read で読む（常時注入しない・区分を混ぜないため毎回 1 区分だけ読む）。

| ドキュメント | 区分 | 読むタイミング |
|------------|------|--------------|
| [reference/templates/tutorial.md](reference/templates/tutorial.md) | tutorial（学習） | 初学者向けの手引きを書くとき |
| [reference/templates/how-to.md](reference/templates/how-to.md) | how-to（課題解決） | 特定作業の手順を書くとき |
| [reference/templates/reference.md](reference/templates/reference.md) | reference（参照） | 正確な仕様を並べるとき |
| [reference/templates/explanation.md](reference/templates/explanation.md) | explanation（理解） | 背景・なぜを論じるとき |
