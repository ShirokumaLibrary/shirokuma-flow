# server/client 境界パターン

SKILL.md 規約 1・3（server component 既定・データフェッチは server）の実装詳細。Next.js App Router 汎用（特定ライブラリに依存しない）。

## 原則: server 既定・client は葉に寄せる

- `"use client"` を付けるのは **state / effect / event handler / ブラウザ API が要る最小の部品だけ**。
- 境界はツリーの**葉側**に引く。page / layout / セクションは server のまま、インタラクティブな末端（フォーム・トグル・メニュー）だけ client にする。
- `"use client"` を付けたファイルから import されるモジュールは**全部 client バンドルに入る**。境界ファイルの import を最小に保つ。

```tsx
// Good: page は server。フォームだけ client
export default async function Page() {
  const items = await listItems()        // server で取得
  return (
    <main>
      <ItemList items={items} />          {/* server component */}
      <ItemForm />                        {/* "use client"（葉） */}
    </main>
  )
}
```

## 境界を越えてよいもの / いけないもの

| 渡すもの | 可否 |
|---------|------|
| シリアライズ可能な props（plain object・配列・文字列） | 可 |
| server action の参照（client から呼ぶ） | 可 |
| 関数・クラスインスタンス・DB ハンドル | 不可（シリアライズ不能） |
| 秘密情報（API キー・接続文字列・セッション秘密） | **不可（漏洩）** |

- サーバ専用モジュール（DB クライアント・秘密を読む config）を client コンポーネントから import しない。`server-only` パッケージを import しておくと誤 import がビルドエラーになる。
- `NEXT_PUBLIC_` プレフィックスのない環境変数は client では `undefined`。client に出す値は公開してよいものだけにする。

## データフェッチの置き場所

- **server component で直接取得**（`fetch` / データ層呼び出し）。client での `useEffect` フェッチは「ユーザー操作に応じた追加取得」等の理由がある場合だけ。
- client が必要とするデータは **props で渡す**か **server action 経由**で取る。

### 並列取得（逐次 await を避ける）

```typescript
// Bad: 逐次（合計時間 = 各取得の和）
const posts = await getPosts()
const tags = await getTags()

// Good: 独立した取得は並列（合計時間 = 最長の 1 本）
const [posts, tags] = await Promise.all([getPosts(), getTags()])
```

依存関係がある取得（A の結果で B を引く）だけ逐次にする。

### Suspense によるストリーミング

遅い取得は `<Suspense>` で区切り、先に描けるところから返す:

```tsx
<Suspense fallback={<ListSkeleton />}>
  <SlowList />   {/* async server component */}
</Suspense>
```

`loading.tsx` / `error.tsx` を route 単位のフォールバックとして併用する。

## 非同期 params / searchParams

App Router（現行）では `params` / `searchParams` は Promise。型も Promise で書き、使用前に await する:

```typescript
type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}

export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params
  const { page = "1" } = await searchParams
  // generateMetadata でも同様に await する
}
```

## キャッシュと再検証

- ミューテーション（server action）の後は **必ず** `revalidatePath` / `revalidateTag` でキャッシュを無効化する（漏れると古い表示が残る）。
- 静的化したい page は `export const revalidate = <秒>` で ISR。更新頻度に応じて値を選ぶ（頻繁に変わる一覧は短く・固定ページは長く）。

## 構造規約（SKILL.md 規約 5）

- **route group**（`(group)`）でレイアウト・関心ごとに整理する。URL に出したくない区分は route group を使う。
- **barrel export**（`index.ts` での再エクスポート）でモジュール公開面を明示する。`export *` は名前衝突の原因になるため明示再エクスポートを優先。
- **app 間 import を避ける**: ある route 配下のモジュールを別 route から直接 import しない。共有するものは `components/` / `lib/` へ昇格させる。
