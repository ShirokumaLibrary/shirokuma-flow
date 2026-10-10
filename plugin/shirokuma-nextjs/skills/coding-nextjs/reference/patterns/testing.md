# Next.js テストパターン

Next.js 固有のテスト技法。TDD の刻み方・@testdoc の規律はコア implement-flow の `reference/docs/tdd.md`（委任ブリーフで渡されるパス）が正本で、ここには **Next.js だから必要になるモック・セレクタの型**だけを置く。

雛形: [../templates/server-action.test.ts.template](../templates/server-action.test.ts.template)・[../templates/component.test.tsx.template](../templates/component.test.tsx.template)

## Next.js ランタイムのモック（ユニットテスト）

server action / コンポーネントのテストでは `next/*` モジュールをモックする（Vitest の API。テストランナーは [tech-stack.md](tech-stack.md) の推奨に合わせている）:

```typescript
import { vi } from "vitest"

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) }),
}))
```

### redirect は throw を前提にテストする

`redirect()` は内部で例外を投げる。モックも throw させ、`rejects.toThrow` で検証する:

```typescript
await expect(deleteItem("id-1")).rejects.toThrow("NEXT_REDIRECT:/items")
expect(revalidatePath).toHaveBeenCalledWith("/items")
```

## データ層のモック

- action テストではデータ層（ORM / クエリ層）を**モジュール境界でモック**する。実 DB に繋がない。
- 1 action が複数クエリを発行する場合は、**結果を FIFO キューに積む**形のモックにすると呼び出し順に依存した戻り値を表現できる（`mockResolvedValueOnce` の連鎖でも可）:

```typescript
const queryResults: unknown[] = []
const queueResult = (...r: unknown[]) => queryResults.push(...r)
// モックの実装側で queryResults.shift() を返す
```

- 検証の中心は**振る舞い**（戻り値・revalidate 呼び出し・データ層に渡った引数）。モックの内部呼び出し回数を細かくアサートしすぎない。

## server action の最低テストケース

| ケース | 内容 |
|--------|------|
| 正常系 | 成功レスポンス＋`revalidatePath`/`redirect` の発火 |
| 未認証 | `UNAUTHORIZED` を返し、データ層が呼ばれない |
| 検証エラー | `VALIDATION_FAILED` を返し、データ層が呼ばれない |
| 権限なし | 所有権チェックで `FORBIDDEN`（更新・削除がある場合） |

## コンポーネントテスト（Testing Library）

- **セマンティックセレクタを優先**: `getByRole` / `getByLabelText` / `getByText`。CSS セレクタ・test-id は最終手段。
- フォーム送信は server action をモックし、「呼ばれた FormData の中身」と「失敗時のエラー表示」を検証する。
- ローディング状態（`isPending` での disabled・文言変化）も振る舞いとして検証する。

## E2E（Playwright 等）の規律

- **任意のタイムアウト待ち禁止**: `waitForTimeout(3000)` でなく条件待ち（`expect(...).toBeVisible()` / `toBeEnabled()`）。
- **条件付き skip 禁止**: 前提データが無いから skip でなく、前提の存在をアサートする（無いならテスト環境の不備）。
- **force click 禁止**: `click({ force: true })` は実 UI の問題を隠す。重なり等はビューポート調整か UI 修正で対処。
- **テスト分離**: `beforeEach` で cookie・サーバ側状態をクリアする。共有状態を変えるテスト群は serial 実行にする。
- ローディング状態の検証は、対象リクエストを Promise でブロックして見える化する（`page.route` で続行を遅延 → ローディング表示をアサート → 解放）。
- 視覚確認が要る画面は `@screenshot` アノテーションを付け、`shirokuma-flow nextjs screenshots` の撮影計画に載せる（撮影はレビュー側・reviewing-nextjs が行う）。

## 完了前の検証コマンド

```bash
shirokuma-flow nextjs lint -p .        # @screen アノテーション整合（error で exit 1）
shirokuma-flow lint areas tests        # @testdoc / skip-reason 検査
shirokuma-flow lint coverage           # 実装ファイル ↔ テストファイルの対応
```

プロジェクト自体の test / lint / 型チェックは package.json scripts に従う。チェックリスト全体は [../criteria/checklist.md](../criteria/checklist.md)。

**`nextjs lint` はコア CLI に固定で入っていない**——拡張 `@shirokuma-library/nextjs` が **CLI を起動した cwd の `package.json`** の (dev)dependencies に在るときだけ生える。`shirokuma-flow describe` の subcommands で判定し、無い環境での扱いは [../criteria/checklist.md](../criteria/checklist.md) §4 の「前提」に従う。
