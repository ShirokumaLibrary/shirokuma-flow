---
name: coding-nextjs
description: Next.js（App Router）の実装支援。page/component/server action を規約に沿って実装しアノテーションを付ける（implement-flow の coding-worker から委任・framework コンパニオン）。Use when Next.js のコードを実装するとき、page/component を実装するとき。
---

# coding-nextjs（Next.js 実装支援）

利用者の Next.js（App Router）の実装を規約に沿って行う。コア shirokuma-flow の opt-in 拡張。

## 実装規約
1. **server component 既定**: `"use client"` は state/effect/event/ブラウザ API が要る最小範囲だけ。client は葉に寄せる。
2. **server action**: `"use server"`。**認証 → 入力検証（zod 等）→ 処理 → revalidate/redirect** の順。client 入力を信頼しない。
3. **データフェッチ**: server component で直接（`fetch`/DB）。client へは props か server action 経由。
4. **アノテーション付与**: `page.tsx` に `@screen <Name>`・`@route`、コンポーネントに `@usedComponents`・server action に `@usedActions`。`shirokuma-flow nextjs feature-map` が拾えるようにする。
5. **命名/構造**: route group で整理、barrel export、app 間 import を避ける。

## 完了時
[reference/criteria/checklist.md](reference/criteria/checklist.md) で自己検査し、finalize（/simplify＋security＋lint）を通す。`shirokuma-flow nextjs feature-map`/`screenshots` で構造・撮影計画を確認。

> **`nextjs` verb はコア CLI に固定で入っていない**——拡張 `@shirokuma-library/nextjs` が **CLI を起動した cwd の `package.json`** の (dev)dependencies に在るときだけ discovery で生える。`shirokuma-flow describe` の subcommands に `nextjs` が出るかで判定し、無い環境の扱い（拡張を足す／プロジェクト自身の lint と手動 grep へ落とす）は checklist.md §4 の「前提」に従う。

## リファレンスドキュメント

雛形・パターン・チェックリストは本 SKILL.md と同階層の `reference/` 配下。必要時に Read で読む（常時注入しない）。

| ドキュメント | 内容 | 読むタイミング |
|------------|------|--------------|
| [reference/templates/page.tsx.template](reference/templates/page.tsx.template) | page 雛形（@screen/@route/@screenshot・async params） | page 新規作成時 |
| [reference/templates/server-action.ts.template](reference/templates/server-action.ts.template) | server action 雛形（認証→検証→処理→revalidate・ActionResult） | action 新規作成時 |
| [reference/templates/form-component.tsx.template](reference/templates/form-component.tsx.template) | client フォーム雛形（境界の葉・isPending/エラー表示） | client component 作成時 |
| [reference/templates/server-action.test.ts.template](reference/templates/server-action.test.ts.template) | action テスト雛形（@testdoc・redirect throw モック） | テスト作成時（実装より先） |
| [reference/templates/component.test.tsx.template](reference/templates/component.test.tsx.template) | コンポーネントテスト雛形（Testing Library） | テスト作成時（実装より先） |
| [reference/patterns/server-client-boundary.md](reference/patterns/server-client-boundary.md) | 境界の引き方・データフェッチ・並列化・構造規約 | 規約 1/3/5 の実装時 |
| [reference/patterns/server-action.md](reference/patterns/server-action.md) | action 構造詳細（認可・CSRF・redirect・分割閾値） | 規約 2 の実装時 |
| [reference/patterns/hydration.md](reference/patterns/hydration.md) | hydration 不一致の発生源と対策（mounted パターン等） | client UI 実装時 |
| [reference/patterns/csp.md](reference/patterns/csp.md) | nonce ベース CSP の dev/prod 分岐・middleware 発行・違反対処 | CSP / セキュリティヘッダ実装時 |
| [reference/patterns/testing.md](reference/patterns/testing.md) | Next.js 固有のモック・E2E 規律・検証コマンド | テスト作成時 |
| [reference/patterns/streaming-sse.md](reference/patterns/streaming-sse.md) | SSE を route handler から出すときの関係（runtime 明示・購読の持ち方・`Last-Event-ID`・購読→catch-up の順序） | サーバー→ブラウザのリアルタイム配信を実装するとき |
| [reference/criteria/checklist.md](reference/criteria/checklist.md) | 実装完了前チェックリスト（規約 1〜5 と 1:1・検証コマンド付き） | 完了報告の前（毎回） |
| [reference/patterns/tech-stack.md](reference/patterns/tech-stack.md) | 推奨技術スタック（TS6/Vitest4/Tailwind v4/shadcn）の既定・採用根拠・上書き方針 | プロジェクト基盤/依存選定・scaffold 連携時 |

> 関連: designing-nextjs / reviewing-nextjs / CLI 拡張 `@shirokuma-library/nextjs`。
