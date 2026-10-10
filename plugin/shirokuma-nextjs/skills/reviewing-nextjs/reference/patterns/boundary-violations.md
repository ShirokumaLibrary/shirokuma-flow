# server/client 境界違反: 検出 → 修正方針

criteria NH1 / NS1 の各項目の検出方法と修正の方向。境界の原則（server 既定・client は葉）は coding-nextjs 側の patterns が実装者向け正本で、ここはレビュー時の検出手順。

## 1. 秘密 / サーバ専用モジュールの client 漏れ（ハード NH1）

**検出**:
1. diff 中の `"use client"` ファイルとその import 先を辿る。
2. DB クライアント・ORM・秘密を読む config・セッション秘密が import 連鎖に入っていないか確認（`grep -rn "from \"@/lib/db\"" --include="*.tsx"` のように client 部品のディレクトリへ向けて検索）。
3. `NEXT_PUBLIC_` 付き環境変数に秘密値（API キー・トークン）が入っていないか。

**修正方針**: データアクセスを server component / server action 側へ移し、client へは結果（シリアライズ可能な値）だけ渡す。サーバ専用モジュールには `server-only` を import させて再発をビルドエラー化する。

## 2. client のみの認可（ハード NH1）

**検出**: 「ログインしていなければボタンを隠す / リダイレクトする」だけで、対応する server action・データ取得側に認可チェックが無い。UI の出し分けと server 検証が**対になっているか**を見る。

**修正方針**: server 側（action・データ層）に認証・認可を追加。client の出し分けは UX としては残してよい。

## 3. 不要な "use client"（ソフト NS1）

**検出**: `"use client"` ファイルに state / effect / event handler / ブラウザ API の使用が無い。または親コンテナに付いていて、インタラクティブなのは子の一部だけ。

**修正方針**: ディレクティブを外して server に戻す。境界を葉（実際にインタラクティブな部品）まで下げ、静的な部分は server のまま children / props で合成する。

## 4. client での不適切なデータフェッチ（ソフト NS1）

**検出**: `useEffect` ＋ `fetch` で初期表示データを取っている（ユーザー操作起点でない）。表示までにスピナーが挟まる構造。

**修正方針**: 取得を server component に移し props で渡す。操作起点の追加取得だけ client（server action 経由）に残す。

## 5. 逐次 await / N+1（ソフト NS1）

**検出**: server component / action 内で、互いに依存しない `await` が縦に並ぶ。ループ（`for` / `map`）の中でクエリ・action を 1 件ずつ発行している。

**修正方針**: 独立した取得は `Promise.all` に。ループ内クエリは一括取得（IN 句・バルク API）に置き換える。

## 6. revalidate 漏れ（ソフト NS1・実害があれば High）

**検出**: diff に新しいミューテーション action があるのに `revalidatePath` / `revalidateTag` の呼び出しが無い。既存一覧 page の `revalidate` 値と突き合わせ、更新が反映されない経路を特定する。

**修正方針**: ミューテーション成功後に、影響する route / tag を無効化する呼び出しを追加。

## 7. app 間 import・構造違反（ソフト NS4）

**検出**: `import ... from "@/app/(other)/..."` のように route 配下のモジュールを別 route から import している。route group の括弧が URL を変えると誤解した構成（`(group)` は URL に出ない）。

**修正方針**: 共有するものは `components/` / `lib/` へ昇格。route 配下にはその route 専用のものだけを置く。

## 8. 非同期 params の同期アクセス（ソフト NS4）

**検出**: page / layout / `generateMetadata` の `params` / `searchParams` を await せずプロパティアクセスしている。型が `Promise<...>` になっていない。

**修正方針**: 型を `Promise<{...}>` にし、使用前に `await params` / `await searchParams` する。
