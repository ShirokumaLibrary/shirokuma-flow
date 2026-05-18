# @shirokuma-library/portal

ドキュメントポータル生成 CLI（`shirokuma-portal`）。TypeDoc API ドキュメント、DB スキーマ、依存関係グラフ、テストケース一覧、機能マップ、スクリーンショット等を、コードアノテーションから自動生成する。

## 機能

`shirokuma-portal generate <target>` で個別生成、`shirokuma-portal generate all` で一括生成。

| ターゲット | 内容 |
|---|---|
| `typedoc` | TypeDoc による API ドキュメント |
| `schema` | データベーススキーマ（DBML / ER 図） |
| `deps` | 依存関係グラフ（dependency-cruiser） |
| `test-cases` | `@testdoc` から抽出したテストケース一覧 |
| `coverage` | カバレッジレポート |
| `feature-map` | 画面 / コンポーネント / Server Action / テーブルの機能マップ |
| `screenshots` | Playwright によるスクリーンショット |
| `portal` | 統合ポータル HTML |
| `search-index` | ポータル全文検索インデックス |
| `link-docs` | 内部リンク整合性チェック付きドキュメント |
| `overview` / `details` / `impact` | プロジェクト概要・詳細・影響範囲 |
| `api-tools` | API ツール一覧 |
| `i18n` | 多言語対応辞書の生成 |
| `packages` | モノレポパッケージ一覧 |
| `all` | 上記すべて |

## インストール

```bash
npm install -g @shirokuma-library/portal
```

## 使用方法

```bash
# 全生成
shirokuma-portal generate all --config .shirokuma/config.yaml

# 個別生成
shirokuma-portal generate typedoc --project .
shirokuma-portal generate feature-map --project .

# 全コマンド一覧
shirokuma-portal --help
shirokuma-portal generate --help
```

## 関連パッケージ

- [`@shirokuma-library/flow`](https://www.npmjs.com/package/@shirokuma-library/flow) — ワークフロー管理 CLI
- [`@shirokuma-library/lint`](https://www.npmjs.com/package/@shirokuma-library/lint) — ファイルレベル lint チェック
