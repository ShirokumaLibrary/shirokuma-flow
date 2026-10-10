# hydration 不一致の対策パターン

SSR の HTML と client の初回レンダーが一致しないと hydration エラーになる。実装時に不一致の発生源を作らないための型。Next.js App Router 汎用。

## 不一致の主な発生源

| 発生源 | 例 |
|--------|-----|
| 実行ごとに変わる値をレンダーで使う | `Date.now()`・`Math.random()`・連番 ID の自前生成 |
| 環境依存の値 | `window` / `localStorage` / `navigator.language` を初回レンダーで参照 |
| ロケール依存の整形 | `toLocaleString()` がサーバとブラウザで異なる結果を返す |
| client 専用 ID を生成する UI ライブラリ | ヘッドレス UI 系プリミティブ（ドロップダウン・ダイアログ等）が SSR と client で別 ID を振る |
| ユーザー状態で分岐する初回レンダー | テーマ・ログイン状態を client 側ストレージから読んで分岐 |

## 対策 1: 値はサーバで確定させて props で渡す

時刻・乱数・ロケール整形済み文字列は **server component で確定**し、client へは確定値を渡す:

```tsx
// server component
const formatted = formatDate(post.publishedAt)   // サーバで整形を確定
return <PostMeta formattedDate={formatted} />     // client には文字列を渡す
```

ID は自前生成でなく React の `useId()` を使う（SSR/client で一致が保証される）。

## 対策 2: mounted ステートパターン（client 専用 UI）

client でしか正しく描けないもの（client 専用 ID を生成するライブラリ部品・ストレージ依存の表示）は、マウント後に切り替える:

```tsx
"use client"

import { useState, useEffect } from "react"

export function ClientOnlyMenu() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // SSR・初回レンダー: 見た目を合わせた disabled プレースホルダー
  if (!mounted) {
    return <button disabled aria-hidden="true">…</button>
  }

  // マウント後: 本物のインタラクティブ部品
  return <DropdownMenu>…</DropdownMenu>
}
```

プレースホルダーの要件:
1. **見た目を本物と一致**させる（レイアウトシフトを起こさない）
2. **`disabled`** にして SSR 中の操作を防ぐ
3. スクリーンリーダー向けテキスト（`sr-only` 等）を保持する

## 対策 3: suppressHydrationWarning は最終手段

不一致が**仕様上避けられない単一要素**（例: `<html>` のテーマ属性・`<time>` の相対時刻）に限り `suppressHydrationWarning` を付ける。子孫には効かないため広い範囲の握りつぶしには使えない（使わない）。

## アンチパターン

```tsx
// Bad: レンダー中に実行ごとに変わる値
<span>{Date.now()}</span>

// Bad: 初回レンダーで window 参照（SSR では存在しない）
const width = typeof window !== "undefined" ? window.innerWidth : 0   // 初回不一致

// Bad: 不一致エラーを suppressHydrationWarning で広範囲に隠す
<div suppressHydrationWarning>{/* ツリーごと */}</div>
```

環境依存の値は `useEffect` で取得して state に入れる（初回レンダーは両者共通のフォールバックを描く）。
