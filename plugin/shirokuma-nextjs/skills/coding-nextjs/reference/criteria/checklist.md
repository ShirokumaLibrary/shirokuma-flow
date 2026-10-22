# 実装完了前チェックリスト（coding-nextjs）

実装を終えてサマリーを返す前の自己検査。SKILL.md の実装規約 1〜5 と 1:1 で対応する。TDD の規律（テスト先行・テスト失敗時は実装を直す）はコア implement-flow の `reference/docs/tdd.md` が正本。

## 1. server/client 境界（規約 1）

- [ ] `"use client"` は state / effect / event handler / ブラウザ API が要る**最小の葉**だけに付いている
- [ ] client コンポーネントからサーバ専用モジュール（DB クライアント・秘密を読む config）を import していない
- [ ] client へ渡す props はシリアライズ可能な値のみ（関数・DB ハンドル・秘密情報なし）

→ 詳細: [../patterns/server-client-boundary.md](../patterns/server-client-boundary.md)

## 2. server action（規約 2）

- [ ] `"use server"` ファイルの export **関数**は action のみ（ヘルパーの同居 export なし・type export は可）
- [ ] 各 action が **認証 → 入力検証 → 処理 → revalidate/redirect** の順
- [ ] 検証済みの明示フィールドだけをデータ操作に渡している（マスアサインメントなし）
- [ ] 更新・削除に所有権（または権限）チェックがある
- [ ] 失敗は構造化レスポンス＋エラーコードで返し、内部エラー詳細を client に返していない
- [ ] ミューテーション後に `revalidatePath` / `revalidateTag` がある
- [ ] `redirect()` を try/catch で握りつぶしていない

→ 詳細: [../patterns/server-action.md](../patterns/server-action.md)

## 3. データフェッチ（規約 3）

- [ ] データ取得は server component で行っている（client の `useEffect` フェッチに理由がある）
- [ ] 独立した複数の取得は `Promise.all` で並列化している
- [ ] ループ内のクエリ発行（N+1）がない

## 4. アノテーション（規約 4）

- [ ] 各 `page.tsx` に `@screen <Name>`（**PascalCase**）と `@route` がある
- [ ] コンポーネントに `@usedComponents`、server action ファイルに `@usedActions` がある
- [ ] 視覚確認が要る画面には `@screenshot`（必要なら `-viewport` / `-auth` / `-waitFor`）がある

検証コマンド（**`nextjs` verb はコア CLI に固定で入っていない**——下記「前提」を先に確かめる）:

```bash
shirokuma-flow nextjs lint -p .          # @screen の欠落（warn）・PascalCase 違反（error）
shirokuma-flow nextjs feature-map -p .   # route ↔ 画面名 ↔ コンポーネントの抽出結果を目視確認
shirokuma-flow nextjs routes -p .        # 追加した route が認識されているか
```

**前提（`nextjs` verb が生えている条件）**: `nextjs` はコア CLI のトップレベル verb ではなく、**拡張 `@shirokuma-library/nextjs` が「CLI を起動した cwd の `package.json`」の dependencies / devDependencies に在るときだけ** discovery で生える（読むのは起動した位置の `package.json` の 1 枚だけで、**workspace ルートへも親ディレクトリへも遡らない**）。**「プロジェクトに入っているか」ではなく「この cwd の `package.json` に在るか」である**——monorepo でサブディレクトリから実行した回は、同じリポジトリでも生える / 生えないが分かれるので、**`describe` を当てる cwd と `nextjs lint` を打つ cwd を揃える**。**在るかどうかは `shirokuma-flow describe` の subcommands に `nextjs` が出るかで判定する**（出なければ入っていない＝`error: unknown command 'nextjs'` になる）。

- **入っていないとき①（推奨）**: 拡張を devDependency に足す（`@shirokuma-library/nextjs`）。パッケージ側の `package.json` に `"shirokuma": { "extension": true }` があり、名前が `@shirokuma-library/*` なので、追加すればそれだけで discovery が拾う。
- **入っていないとき②（足せない場合のフォールバック）**: **アノテーション整合の機械検査は無いものとして扱い**、プロジェクト自身の lint（`package.json` の `lint` script ＝ Next.js 既定なら `next lint` / eslint）と手動 grep で代替する。**その回は「`nextjs lint` が error 0」を満たしたと書かない**——実行していない検査を pass として記録しない（`reviewing-nextjs` の同名のフォールバック条項と同旨）。

## 5. 命名・構造（規約 5）

- [ ] ファイル名は kebab-case・コンポーネント/型は PascalCase・変数/関数は camelCase・定数は UPPER_SNAKE_CASE
- [ ] route group で整理し、app 間 import（route 配下モジュールの横取り）がない
- [ ] 共有モジュールは barrel export（明示再エクスポート・`export *` なし）
- [ ] 分割閾値を超えていない: server action 300 行 or 8 関数・コンポーネント 250 行（超えたら分割 → [../patterns/server-action.md](../patterns/server-action.md)）

## 6. ハイドレーション

- [ ] レンダー中に実行ごと/環境ごとに変わる値（`Date.now()`・`Math.random()`・`window` 参照・ロケール整形）を使っていない
- [ ] client 専用 ID を生成する UI 部品には mounted パターン等の対策がある

→ 詳細: [../patterns/hydration.md](../patterns/hydration.md)

## 7. テスト

- [ ] テストを実装より先に書いた（red を確認してから実装した）
- [ ] server action: 正常系・未認証・検証エラー・（あれば）権限なし、の最低ケースが揃っている
- [ ] 各テストに `@testdoc`、`.skip` には `@skip-reason` がある

検証コマンド:

```bash
shirokuma-flow lint areas tests   # @testdoc / skip-reason 検査
shirokuma-flow lint coverage      # 実装ファイル ↔ テストファイルの対応
```

→ 詳細: [../patterns/testing.md](../patterns/testing.md)

## 8. 最終確認

- [ ] プロジェクトの test / lint / 型チェック（package.json scripts）がすべて green
- [ ] `.next/` の無い作業ツリー（新しく作った作業ツリー・clone 直後）で型チェックするときは、`tsc` の前に `next typegen` を打った（`PageProps` などの経路の型は `next dev` / `next build` / `next typegen` が `.next/types` に作る。無いまま `tsc` を打つと、コードに誤りが無くても型エラーになる。追試状況: 実測（Next.js 16.4.2。`typegen` は 15.5 から））
- [ ] `shirokuma-flow nextjs lint -p .` が error 0（**拡張が入っている環境のみ**。入っていなければ §4 の「前提」のフォールバック②に落とし、この項目は `skip(理由: 拡張未導入)` として記録する——実行していない検査を pass にしない）

## 9. 公開する応答と本番の観測（本番に出すアプリのとき）

- [ ] `next.config` に `poweredByHeader: false` がある。**何を防ぐか**: 既定では応答に `X-Powered-By: Next.js` が付き、使っている枠組みを外へ知らせる（既知の脆弱性を持つ版を探す手がかりになる）。追試状況: 実測（Next.js 16.4.2 の既定値が `true`）
- [ ] 本番のサーバ側エラーを追える。ログは 1 行 1 件の JSON（時刻・要求の ID・経路・エラーの名前とスタック）で出し、スタックを元のソースの行へ戻せるようサーバ側の source map を作って公開しない場所に置く。**何を防ぐか**: 本番のエラーはクライアントには要約だけが返り、ビルド後のスタックはそのままではソースの行に戻らない。追試状況: `要確認（未追試）`（source map を作る設定の名前と、ログ基盤がスタックを戻せるかは、使う版とログ基盤で確かめる）
- [ ] CDN の後ろに置くアプリでは、クライアントの IP を CDN が上書きする専用のヘッダ 1 本だけから読み、`X-Forwarded-For` を読まない。**何を防ぐか**: `X-Forwarded-For` はクライアントが自分で値を入れて送れるので、レート制限や監査ログの IP を偽れる。CDN 側でクライアントが送った同名のヘッダを捨てて上書きする設定とそろえる。**この読み方が安全なのは、オリジンへ CDN を経ずに届かない構成に限る**（オリジンを直接叩けると、専用のヘッダもクライアントが自分で付けられる）。オリジンを CDN に絞る方法は `shirokuma-infra` の designing-aws スキル `reference/patterns/aws-resource-patterns.md`「ALB の受け口を CDN に絞る」。追試状況: `要確認（未追試）`（ヘッダの名前と上書きの設定は CDN ごとに違うので、使う CDN のドキュメントと本物の要求で確かめる）

> 完了後の品質ゲート（finalize）・コミット・状態遷移は orchestrator / 各 worker の責務（このスキルでは行わない）。
