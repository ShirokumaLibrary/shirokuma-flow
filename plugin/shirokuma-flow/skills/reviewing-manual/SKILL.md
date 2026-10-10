---
name: reviewing-manual
description: Markdown マニュアルを Diátaxis 区分・構成・リンク整合の観点でレビューする（lint docs と補完）。Use when マニュアルをレビューするとき、Diátaxis 区分の適合を確認するとき、ドキュメント構成を確認するとき。
model: opus
---

# reviewing-manual（マニュアルレビュー）

Markdown マニュアルをレビューする。

## レビュー観点
1. **Diátaxis 区分の適合**: 1 ドキュメント 1 区分か。tutorial に reference が混ざる等の混在を指摘。
2. **前提の明示**: 読者の前提・必要な環境・先に読むべきページが冒頭で示されているか。
3. **再現性**（how-to/tutorial）: 手順が抜けなく順に実行でき、結果が確認できるか。
4. **正確さ**（reference）: 仕様・引数・既定値が実装と一致するか。
5. **リンク整合**: 内部リンク・参照の有効性（`lint docs` と補完）。
6. **自己完結**: 外部リポ・過去番号への恒久参照を残していないか。
7. **内部文書への参照が無い**: ユーザー向け文書（`docs/`）から、利用者には存在しないリポ内部資料への参照を残していないか。NG = `.shirokuma/notes/`・引き継ぎ（handoff）・台帳/設計ノート・開発リポの実 Issue URL/番号・「〜は解決済み」等の開発経緯。決定の出典は公開対象に限る（ADR/Discussion 番号・docs 内 relative・skill 名・公開 pages URL は可）。

## 進め方
review-flow の review-worker から呼ばれる、または docs 監査として。`shirokuma-flow lint docs` の自動チェックと役割分担（lint=構造、本スキル=区分/内容）。

> 関連: writing-manual / writing-html-explainer / lint docs。
