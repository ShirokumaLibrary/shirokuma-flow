# 境界設計パターン（server/client 境界・データ取得層）

server/client コンポーネント境界、server action のデータフロー、データ取得層・状態管理・キャッシュの設計判断のためのパターン比較テーブル。SKILL.md 本文「設計観点 2（server/client 境界）」「設計観点 3（server action のデータフロー）」の詳細展開。

## server/client コンポーネント境界

| パターン | 使用場面 | 例 |
|---------|---------|-----|
| Server Component（デフォルト） | 静的コンテンツ、データ取得、非インタラクティブ | ページ、レイアウト、データ表示 |
| Client Component（`"use client"`） | イベントハンドラ、useState、useEffect、ブラウザ API | フォーム、インタラクティブウィジェット |
| コンポジション（Server が Client を包む） | 静的 + インタラクティブの混在 | Server がデータ取得し Client フォームに渡す |
| Client-only サブツリー | 高度にインタラクティブなセクション | ドラッグ&ドロップ付きダッシュボード |

### 境界ルール（基本原則: 境界を浅く保つ・client を葉に寄せる）

```
Page (Server)
  → レイアウトセクション (Server)
    → データ表示 (Server)
    → インタラクティブウィジェット (Client)
      → Client の子要素 (Client - 境界は継承)
```

`"use client"` は可能な限り深い階層に配置する。データ取得コンポーネントは Server Component に保つ。

### コンポジションパターン

| パターン | 使用場面 | 例 |
|---------|---------|-----|
| Container/Presentational | データ取得と表示の分離 | `UserContainer`（Server）→ `UserCard`（Client） |
| スロットパターン | 柔軟なレイアウト構成 | `<Layout sidebar={<Sidebar />}>` |
| children 経由のレンダープロップス | Server Component が Client にコンテンツを渡す | `<Modal>{serverContent}</Modal>` |
| 並列データ取得 | 独立したデータソース | `Promise.all([getUser(), getPosts()])` |

## データ取得層（Server Actions vs API Routes）

| 基準 | Server Actions | API Routes |
|------|---------------|------------|
| 同一オリジンのフォーム送信 | 推奨 | オーバーヘッド |
| 外部 API 連携 | 可能だが不自然 | 推奨 |
| Webhook エンドポイント | 非対応 | 推奨 |
| プログレッシブエンハンスメント | 組み込み | 手動対応 |
| ファイルアップロード | 対応（FormData） | 対応 |
| サードパーティクライアントアクセス | 非対応 | 推奨 |

### Server Action のデータフロー（設計観点 3 の標準順序）

認証 → 入力検証（zod 等）→ 処理 → 再検証/revalidate の順で構成する。client から呼ぶ境界を明示する。

1. **認証チェック**: 先頭でセッションを検証
2. **入力バリデーション**: zod スキーマでバリデーション
3. **認可**: 所有権/権限を検証
4. **処理**: ビジネスロジック実行
5. **再検証**: `revalidatePath()` / `revalidateTag()` で関連キャッシュを失効
6. **CSRF 防御**: フレームワークレベルで組み込み（Server Actions 既定）。レート制限は破壊的操作に対して実施

### Server Action の構成パターン

| パターン | 使用場面 | 構成 |
|---------|---------|------|
| ファイル単位の単一アクション | シンプルな CRUD | `lib/actions/create-user.ts` |
| グループ化アクション | 関連する操作 | `lib/actions/user-actions.ts` |
| 再検証付きアクション | 変更後 | `revalidatePath()` / `revalidateTag()` |
| リダイレクト付きアクション | 作成/削除後 | `redirect('/path')` |

## 状態管理の選択

| アプローチ | 使用場面 | トレードオフ |
|-----------|---------|------------|
| Server Component props | 静的またはサーバー取得データ | 最もシンプル、クライアント JS なし |
| URL search params | フィルタ/ソート可能なリスト | 共有可能だが型が限定的 |
| React Context | 共有クライアント状態（テーマ、認証） | 変更時に再レンダリング |
| 外部ストアライブラリ | 複雑なクライアント状態 | 追加依存関係 |
| Server Actions + revalidation | 変更 → 再取得サイクル | フレームワークネイティブ |

## キャッシュ戦略

| レイヤー | メカニズム | 使用場面 |
|---------|-----------|---------|
| リクエスト重複排除 | Server Components での `fetch` | 複数コンポーネントで同じリクエスト |
| データキャッシュ | `revalidate` オプション付き `fetch` | API レスポンス |
| フルルートキャッシュ | 静的/動的レンダリング | ページ全体 |
| ルーターキャッシュ | クライアントサイドナビゲーション | 以前訪問したルート |

### 再検証パターン

| パターン | 使用場面 |
|---------|---------|
| `revalidatePath('/path')` | 特定ページに影響する変更後 |
| `revalidateTag('tag')` | タグ付き fetch に影響する変更後 |
| `router.refresh()` | クライアントサイド強制リフレッシュ |
| 時間ベース（`revalidate: 60`） | 半静的データの stale-while-revalidate |

## アンチパターン

| パターン | 問題 | 代替案 |
|---------|------|--------|
| 静的コンテンツに Client Component | 不要なバンドルサイズ増 | Server Component を使用 |
| 同一オリジンの変更に API Route | 余分なネットワークホップ | Server Actions を使用 |
| 3 階層以上の Props バケツリレー | 密結合 | コンポジションまたはコンテキスト |
