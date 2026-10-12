---
name: reviewing-nextjs
description: Next.js（App Router）のレビュー支援。server/client 境界・server action の安全性・アノテーション整合をレビューする（review-flow の review-worker から委任・framework コンパニオン）。Use when Next.js のコードをレビューするとき、server action の安全性を確認するとき。
model: opus
---

# reviewing-nextjs（Next.js レビュー支援）

利用者の Next.js（App Router）PR をレビューする。コア shirokuma-flow の opt-in 拡張。

## レビュー観点
1. **server/client 境界**: 不要な `"use client"`（server で済む処理を client に出していないか）・client 境界からの秘密/サーバ専用 import の漏れ。
2. **server action の安全性**: 認証チェック・入力検証（zod 等）・CSRF/権限・client 入力の信頼。`"use server"` の露出範囲。
3. **データフェッチの場所**: server component で取るべきものを client で取っていないか・N+1・revalidate 漏れ。
4. **アノテーション整合**: `@screen`/`@usedComponents`/`@usedActions` が実装と一致するか。`shirokuma-flow nextjs feature-map` の出力と突き合わせる。
5. **構造**: route group/動的セグメントの誤り・app 間 import。

## 進め方
review-flow の review-worker から呼ばれ、ハード/ソフト観点で判定。lint（structure/docs）と補完。

> **CLI 拡張（`shirokuma-flow nextjs lint` / `feature-map`）が無い環境のフォールバック**: 機械検査は手動 grep で代替する（例: `@screen` が PascalCase か・アノテーションと実装の対応を目視）。代替で確認した旨を**レビュー報告に明記**する（機械検査を回したと読まれないようにするため）。**`nextjs` verb はコア CLI に固定で入っておらず**、拡張 `@shirokuma-library/nextjs` が **CLI を起動した cwd の `package.json`** の (dev)dependencies に在るときだけ discovery で生える——**在るかは `shirokuma-flow describe` の subcommands に `nextjs` が出るかで判定する**（`--help` の不在や勘で決めない）。

## スクリーンショット撮影（Playwright MCP・任意）
UI の視覚確認が要るときは、`shirokuma-flow nextjs screenshots` で**撮影計画 manifest**（route・viewport・auth・waitFor）を得て、**Playwright MCP の browser ツールで各 route を撮る**（Playwright は bundle しない）。

1. `nextjs screenshots` で manifest 生成（`@screenshot` アノテーション由来）。
2. 稼働中の Next.js アプリに対し、各エントリで: `browser_resize`（viewport があれば）→ `browser_navigate <route>` →（waitFor があれば）`browser_wait_for` → `browser_take_screenshot`。`auth: required` は認証セッションを用意してから撮る。
3. 撮った画像をレビュー所見の根拠にする（必要なら確認ビュー HTML に貼る）。

- **headless CI では MCP セッションが無く撮れない** → 撮影は MCP が使えるセッションで行う。
- セットアップは opt-in: 導入先の `.mcp.json` に `@playwright/mcp` を MCP サーバーとして足し、ブラウザを導入する。設定の書式と導入コマンドは `@playwright/mcp` の README に従う。

## リファレンスドキュメント

判定基準・検出パターンは本 SKILL.md と同階層の `reference/` 配下。必要時に Read で読む（常時注入しない）。コア review-flow の criteria（判定行契約・正味改善バー）と合算して使う。

| ドキュメント | 内容 | 読むタイミング |
|------------|------|--------------|
| [reference/criteria/nextjs.md](reference/criteria/nextjs.md) | Next.js 拡張ハード/ソフト観点（観点 1〜5 の詳細化・コア criteria に合算） | Next.js PR レビュー時（毎回） |
| [reference/patterns/server-action-security.md](reference/patterns/server-action-security.md) | action 安全性の検出→修正方針（認証・IDOR・露出・fail-open 等） | 観点 2 の検査時 |
| [reference/patterns/boundary-violations.md](reference/patterns/boundary-violations.md) | 境界違反の検出→修正方針（秘密漏れ・不要 use client・N+1・revalidate 漏れ） | 観点 1/3/5 の検査時 |
| [reference/patterns/hydration.md](reference/patterns/hydration.md) | hydration 不一致の検出→修正方針・深刻度の目安 | client UI 変更の検査時 |

> 関連: designing-nextjs / coding-nextjs / CLI 拡張 `@shirokuma-library/nextjs`（feature-map・screenshots）。
