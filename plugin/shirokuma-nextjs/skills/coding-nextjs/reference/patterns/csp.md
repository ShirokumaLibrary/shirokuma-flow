# Content Security Policy（CSP）パターン

Next.js（App Router）で nonce ベースの CSP を適用する汎用パターン。dev / prod でディレクティブを分け、本番は `'nonce-...'` + `'strict-dynamic'` で inline script を締める。フレームワーク非依存（特定 UI ライブラリ前提を持たない）。

> 使うクライアントライブラリによっては個別ディレクティブの緩和が要る（末尾「ライブラリ依存の緩和」）。要否はそのライブラリの実挙動で判断し、必要な分だけ足す（一律で緩めない）。

## dev / prod 分岐つき CSP 組み立て

```typescript
// lib/csp.ts
export function buildCspHeader(nonce: string, isDevelopment: boolean): string {
  const directives = isDevelopment
    ? [
        "default-src 'self'",
        // dev は HMR が eval を要求するため緩める（prod には持ち込まない）
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        // HMR の WebSocket
        "connect-src 'self' ws: wss:",
        "frame-ancestors 'none'",
      ]
    : [
        "default-src 'self'",
        // prod は nonce ベース。'strict-dynamic' で nonce 付きスクリプトが読んだ
        // スクリプトのみ信頼し、ホスト allowlist に依存しない
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
        "style-src 'self'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
        "upgrade-insecure-requests",
      ]

  return directives.join("; ")
}
```

## ミドルウェアでリクエストごとに nonce を発行

nonce は**リクエストごとに新規生成**する（使い回すと nonce の意味が消える）。`crypto.randomUUID()` か `crypto.getRandomValues` を base64 化して使う。

```typescript
// middleware.ts
import { NextRequest, NextResponse } from "next/server"
import { buildCspHeader } from "@/lib/csp"

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
  const isDev = process.env.NODE_ENV !== "production"
  const csp = buildCspHeader(nonce, isDev)

  // nonce を後続（layout / RSC）へ渡すためリクエストヘッダにも載せる
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set("Content-Security-Policy", csp)
  return response
}
```

## script タグに nonce を渡す

App Router では `headers()` から nonce を読み、`<Script nonce={nonce}>` や手書き script に付与する。Next.js は nonce 付きの場合に自前の inline script へも nonce を伝播する。

```typescript
// app/layout.tsx
import { headers } from "next/headers"

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined
  return (
    <html>
      <body>{children}</body>
    </html>
  )
}
```

## よくある違反と対処

| 症状（コンソールの違反） | 不足ディレクティブ / 対処 |
|---|---|
| `script-src ... refused` で初期 JS が動かない | nonce が script に伝播していない（middleware で `x-nonce` をリクエストヘッダにも載せる） |
| dev だけ `eval` 違反 | dev 分岐に `'unsafe-eval'`（HMR 用・prod には足さない） |
| `connect-src` で dev の HMR が切れる | dev 分岐に `ws: wss:` |
| inline style が `style-src` 違反 | まず該当スタイルを外部 CSS / nonce 付きへ移す。ランタイム注入で回避不能な場合のみ緩和（下記） |

## ライブラリ依存の緩和（必要時のみ）

一部のクライアントライブラリはランタイムに inline style や Web Worker（blob URL）を注入し、nonce ベースでは賄えないことがある。その場合だけ**該当ディレクティブを最小限**緩める。

- ランタイムに inline style を注入するライブラリ（ポップオーバー配置・アニメーション・テーマ切替系）→ `style-src` に `'unsafe-inline'` を足す。まず外部 CSS / nonce 付きで賄えないか先に検討する。
- Web Worker を `blob:` URL から生成するライブラリ（エディタ・重い変換処理系）→ `worker-src 'self' blob:` を足す。
- 外部ストレージ（オブジェクトストレージの公開ホスト等）からの画像 → `img-src` にそのオリジンを追加:

```typescript
const storageOrigin = process.env.NEXT_PUBLIC_STORAGE_PUBLIC_URL
  ? new URL(process.env.NEXT_PUBLIC_STORAGE_PUBLIC_URL).origin
  : ""
const imgSrc = storageOrigin
  ? `img-src 'self' data: blob: ${storageOrigin}`
  : "img-src 'self' data: blob:"
```

緩和を入れたら**なぜ必要か（どのライブラリの何の挙動か）を Why コメントで残す**。後で依存を外したときに締め直せるようにする。
