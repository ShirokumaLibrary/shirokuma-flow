# server action 安全性: 検出 → 修正方針

criteria NH2 の各項目を PR 差分からどう検出し、どう直させるか。検出は diff と grep でできる形にする。

## 1. 認証チェックの欠落

**検出**: `"use server"` ファイルの export 関数の先頭付近に認証呼び出し（プロジェクトの `requireUser` / `verifySession` 等）が無い。`grep -n "use server" -r app lib` で対象ファイルを列挙し、各 export 関数を確認。

```typescript
// NG: 誰でも呼べる削除エンドポイントになっている
export async function deleteItem(id: string) {
  await db.items.remove(id)
}
```

**修正方針**: 全 action の **1 行目相当**に認証チェックを置き、未認証は `UNAUTHORIZED` の構造化レスポンスで返す。読み取り action も省略しない（action は public な HTTP エンドポイント）。

## 2. 入力検証の欠落・マスアサインメント

**検出**: `formData.get(...) as string` の直接使用・`Object.fromEntries(formData)` / `set({ ...input })` のスプレッドがデータ操作に渡っている。

```typescript
// NG: 未検証 + 丸ごと展開（role 等の意図しないフィールドが書き込める）
await db.users.update(id, Object.fromEntries(formData))
```

**修正方針**: スキーマ（zod 等）で `safeParse` → 失敗は `VALIDATION_FAILED` を返す → 成功時は `validated.data` の**明示フィールドだけ**を渡す。

## 3. 所有権 / 権限チェックの欠落（IDOR）

**検出**: id を受け取る更新・削除 action で、操作前に「現リソースの所有者・権限」を引いて比較するコードが無い（id の存在チェックだけでは不足）。

**修正方針**: 認証・検証の後、データ操作の前に所有権チェックを挿入。`NOT_FOUND` と `FORBIDDEN` をコードで区別して返す。ロール制限の操作はロール比較を同位置に置く。

## 4. 内部エラー詳細の露出

**検出**: catch 節で `error.message` / `String(error)` をそのまま戻り値の `error` に入れている。

```typescript
// NG: DB のエラーメッセージ（接続情報・SQL 断片）が client に出る
catch (error) { return { success: false, error: (error as Error).message } }
```

**修正方針**: 詳細は `console.error` 等でサーバログに残し、client へは汎用メッセージ＋エラーコード（`INTERNAL_ERROR`）だけを返す。

## 5. fail-open（握りつぶしによる成功側への倒れ込み）

**検出**: 認証・認可・CSRF 検証を try/catch で包み、catch 後も処理が続行している。`redirect()` を try 内で呼んで catch が rethrow していない（redirect は throw する仕様なので、握りつぶすと「成功扱いで遷移しない」状態になる）。

**修正方針**: 認証・認可の失敗は即 return / throw。`redirect()` は try の外で呼ぶか、catch で redirect 例外を rethrow する。

## 6. "use server" の露出範囲過多

**検出**: `"use server"` ファイルに action 以外の export（ユーティリティ・定数・スキーマ）がある。export はすべて HTTP 経由で呼び出し可能になる。

**修正方針**: ヘルパー・型・スキーマは `"use server"` の無い別ファイル（`*-types.ts` 等）へ移すか非 export にする。

## 7. オープンリダイレクト

**検出**: client 由来の値（searchParams の `callbackUrl` 等）が検証なしで `redirect(...)` / `window.location.href` に渡っている。

**修正方針**: `url.startsWith("/") && !url.startsWith("//")` の内部パス検証を通し、不正値はデフォルトパスへフォールバックさせる。

## 8. CSRF / 出所検証の構成漏れ

**検出**: リバースプロキシ・マルチドメイン構成（next.config の rewrites・複数ホスト運用）なのに `serverActions.allowedOrigins` の設定が無い。公開フォーム action に出所検証が無い。

**修正方針**: 構成に応じて `allowedOrigins` を設定。明示検証を足す場合は Origin/Referer を期待オリジンと比較し、両ヘッダー欠如は拒否する。

## 9. タイミングによる情報漏洩（認証系 action のみ）

**検出**: ログイン等の認証 action が「ユーザー不存在で早期 return / 存在時のみパスワード検証」になっている（応答時間でユーザーの存在が判別できる）。

**修正方針**: 失敗経路の応答時間を揃える（最低応答時間の確保・不存在時もダミー検証を実行）。エラーメッセージも存在/不存在で同一にする。
