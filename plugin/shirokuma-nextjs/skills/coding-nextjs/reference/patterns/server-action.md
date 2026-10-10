# server action 構造パターン

SKILL.md 規約 2（認証 → 入力検証 → 処理 → revalidate/redirect）の実装詳細。Next.js App Router 汎用（認証・データ層はプロジェクトの実装に差し替える前提で書く）。

雛形: [../templates/server-action.ts.template](../templates/server-action.ts.template)

## 必須の 4 段構造

```typescript
"use server"

export async function createItem(formData: FormData): Promise<ActionResult<{ id: string }>> {
  // 1. 認証（最初。読み取りでも省略しない）
  const user = await requireUser()
  if (!user) return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" }

  // 2. 入力検証（zod 等のスキーマ。client 入力を信頼しない）
  const validated = Schema.safeParse({ name: formData.get("name") })
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0].message, code: "VALIDATION_FAILED" }
  }

  // 3. 処理（所有権チェック → データ操作。try/catch）
  try {
    const created = await createInDataLayer({ ...validated.data, ownerId: user.id })

    // 4. revalidate / redirect
    revalidatePath("/items")
    return { success: true, data: { id: created.id } }
  } catch (error) {
    console.error("createItem failed:", error)               // 詳細はサーバログのみ
    return { success: false, error: "Operation failed", code: "INTERNAL_ERROR" }
  }
}
```

## 戻り値: 構造化レスポンス＋エラーコード

- throw でなく `ActionResult`（成功/失敗の判別 union）で返す。client 側が分岐しやすく、エラー詳細の漏洩も防げる。
- エラーコード（`UNAUTHORIZED` / `VALIDATION_FAILED` / `NOT_FOUND` / `FORBIDDEN` / `INTERNAL_ERROR` 等）を付け、表示の出し分けをコードで行う。
- **内部エラー詳細（例外メッセージ・スタック）を client に返さない**。`error.message` の素通しは禁止。

## 入力検証の規律

- 検証は **server 側で必ず**行う（client 側のフォームバリデーションは UX 用であって防御ではない）。
- 検証済みの**明示フィールドだけ**をデータ操作に渡す。`formData` や受信オブジェクトの丸ごと展開（マスアサインメント）は禁止:

```typescript
// Bad: 検証していないフィールドが混入しうる
await update(id, Object.fromEntries(formData))

// Good: 検証済みスキーマの出力だけを渡す
await update(id, validated.data)
```

## 認可: 所有権チェック（IDOR 防止）

更新・削除の前に「そのユーザーがそのリソースを操作してよいか」を server 側で確認する:

```typescript
const existing = await loadItem(id)
if (!existing) return { success: false, error: "Not found", code: "NOT_FOUND" }
if (existing.ownerId !== user.id) return { success: false, error: "Forbidden", code: "FORBIDDEN" }
```

ロールに基づく操作（管理者専用等）はロールチェックを同じ位置に置く。

## "use server" の露出範囲

- `"use server"` を付けたファイルの **export 関数はすべて HTTP 経由で呼び出し可能なエンドポイントになる**。action 以外のヘルパーを同居 export しない（ヘルパーは別ファイルか非 export に）。
- 内部ヘルパーを公開したい場合は `"use server"` の無いモジュールに置く。

## CSRF・リクエスト出所の検証

Next.js の server action には Origin/Host 比較の組み込み保護があるが、リバースプロキシ・マルチドメイン構成では `serverActions.allowedOrigins` の設定が必要。公開フォーム等で明示検証を足す場合は Origin/Referer を期待オリジンと比較する:

```typescript
const headersList = await headers()
const origin = headersList.get("origin")
if (origin && origin !== expectedOrigin) throw new Error("Invalid origin")
```

## オープンリダイレクト防止

client から渡されたコールバック URL に redirect しない。内部パスのみ許可する:

```typescript
function isInternalPath(url: string | undefined): boolean {
  return !!url && url.startsWith("/") && !url.startsWith("//")
}
const safeUrl = isInternalPath(callbackUrl) ? callbackUrl! : "/"
```

## redirect は throw する

`redirect()` は内部で例外を投げて制御を移す。**try/catch の中で呼ぶと握りつぶされる**ので、try ブロックの外（成功確定後）で呼ぶか、catch で rethrow する。テスト時も throw を前提にモックする（[../templates/server-action.test.ts.template](../templates/server-action.test.ts.template)）。

## 関連データはトランザクション

複数テーブル/エンティティにまたがる書き込みは、データ層のトランザクション機構でまとめる（部分成功でデータ不整合を作らない）。

## ファイル分割（大規模化したら）

action ファイルが **300 行 or 8 関数**を超えたら分割する:

| ファイル | 役割 |
|---------|------|
| `lib/actions/items/index.ts` | barrel export（既存 import パスを維持） |
| `lib/actions/items/queries.ts` | 読み取り |
| `lib/actions/items/mutations.ts` | 書き込み |
| `lib/actions/items/types.ts` | `ActionResult` 等の型・定数 |

- 性質の異なる action はディレクトリで分ける目安: 単一エンティティの定型 CRUD と、複数エンティティにまたがるビジネスワークフローを同じファイルに混ぜない。
- 分割してもテストの置き場所は変えない（テスト構造の安定を優先）。
