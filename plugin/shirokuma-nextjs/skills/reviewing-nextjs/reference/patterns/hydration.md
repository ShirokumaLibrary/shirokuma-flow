# hydration 不一致: 検出 → 修正方針

criteria NS2 の検出手順。実装者向けの対策パターン（mounted パターンの書き方等）は coding-nextjs 側の `reference/patterns/hydration.md` が正本。ここはレビューでの検出に絞る。

## 症状（報告・ログから）

```
Error: Hydration failed because the server rendered HTML didn't match the client.
```

サーバとクライアントで `id` / `aria-*` / テキストが食い違う形で現れることが多い。

## 検出ポイント（diff 上の兆候）

| 兆候 | 問題 |
|------|------|
| JSX / レンダー経路に `Date.now()`・`new Date()` の整形・`Math.random()` | 実行ごとに値が変わり SSR と client で不一致 |
| 初回レンダーで `window` / `localStorage` / `navigator` を参照（`typeof window` 分岐含む） | SSR に存在せず、分岐の両側で別ツリーになる |
| `toLocaleString()` / `Intl.*` の結果を直接レンダー | サーバとブラウザのロケール・TZ 差で不一致 |
| client 専用 ID を生成する UI ライブラリ部品（ドロップダウン・ダイアログ等のヘッドレスプリミティブ）を SSR ツリーに直置き | SSR と client で別 ID が振られる |
| 自前の連番 / ランダム ID 生成 | `useId()` を使っていない |
| `suppressHydrationWarning` の新規追加 | 不一致の握りつぶし（根本対策の回避） |

## 指摘の仕方（修正方針）

1. **値の不一致**（時刻・乱数・ロケール）→ server component で値を確定し、client へ確定値（文字列）を props で渡す形を提案。
2. **環境依存の参照** → `useEffect` で取得して state に入れ、初回レンダーは共通フォールバックを描く形を提案。
3. **client 専用 ID の UI 部品** → mounted ステートパターン（マウント前は見た目を合わせた disabled プレースホルダー）を提案。実装の型は coding-nextjs 側 `reference/patterns/hydration.md`。
4. **ID 生成** → React の `useId()` へ置換。
5. **`suppressHydrationWarning`** → 仕様上避けられない単一要素（`<html>` のテーマ属性・`<time>`）以外は不可。広範囲・ツリーごとの適用は指摘する。

## 深刻度の目安

- 実際に hydration エラーが出る（再現手順あり）→ **High**（UI が壊れる・client の再描画でちらつく）。
- 兆候はあるが現状エラーにならない（たまたま一致する値）→ Medium（将来の発火点として指摘）。
- `suppressHydrationWarning` の妥当な単一要素適用 → 指摘不要。
