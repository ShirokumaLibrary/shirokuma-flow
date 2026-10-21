---
name: designing-nextjs
description: Next.js（App Router）の設計支援。route 階層・server/client 境界・server action のデータフローを設計する（design-flow から委任・framework コンパニオン）。Use when Next.js のルーティングを設計するとき、server/client 境界を設計するとき。
model: opus
disable-model-invocation: true
---

# designing-nextjs（Next.js 設計支援）

利用者の Next.js（App Router）プロジェクトの設計を支える。コア shirokuma-flow の opt-in 拡張。

## 設計観点
1. **route 階層**: `app/**/page.tsx` の構成。route group `(group)`（URL に出さない整理）・動的 `[id]`・parallel `@slot` の使い分け。現状は `shirokuma-flow nextjs routes` で把握。
2. **server/client 境界**: 既定は server component。状態・イベント・ブラウザ API が要る箇所だけ `"use client"`。境界を浅く保つ（client を葉に寄せる）。
3. **server action のデータフロー**: 認証 → 入力検証（zod 等）→ 処理 → 再検証/revalidate の順。client から呼ぶ境界を明示。
4. **アノテーション方針**: 各 `page.tsx` に `@screen <Name>`、コンポーネントに `@usedComponents` を付け、`shirokuma-flow nextjs feature-map` で画面↔部品を可視化できるようにする。

## 出力
設計案（What）を人に確認させる回の確認ビューは、生成するかを `html-report-criteria` で決め（既定は生成しない）、生成は orchestrator が `explainer-worker` へ委任する（本 skill の読み手は HTML を作らない）。状態遷移は design-flow の flow verb。横断の決定を ADR に切り出したら、その What の着地は `docs-placement` 第 1 節の基準で判定し、カテゴリは `shirokuma-flow gate vocab --field adr-landing-category` から選ぶ（領域固有のカテゴリは無い）。

## リファレンスドキュメント

| ドキュメント | 内容 | 読むタイミング |
|------------|------|--------------|
| [reference/patterns/route-design.md](reference/patterns/route-design.md) | route 構成・レイアウト境界・ミドルウェアのパターン比較 | 設計観点 1（route 階層）を詳細化する時 |
| [reference/patterns/boundary-design.md](reference/patterns/boundary-design.md) | server/client 境界・server action データフロー・データ取得層/状態管理/キャッシュのパターン比較 | 設計観点 2・3（境界・データフロー）を詳細化する時 |

> 関連: CLI 拡張 `@shirokuma-library/nextjs`（routes/feature-map/screenshots）/ coding-nextjs / reviewing-nextjs。
