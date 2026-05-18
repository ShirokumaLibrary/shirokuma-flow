# @shirokuma-library/context

外部ドキュメント（`llms.txt` / GitHub）を取得してローカルに Markdown として保持する CLI（`shirokuma-context`）。AI が外部ドキュメントを毎回 fetch せず、ローカルから直接読めるようにする。

## 機能

- **fetch**: プリセット指定で外部ドキュメントを取得（name 省略時は fetch 済み全件を再取得）
- **detect**: `package.json` の依存関係から取得対象をプリセット逆引きで自動検出
- **list**: fetch 済みソースの状態を列挙
- **search**: ローカル fetch 済みドキュメントを keyword / regex 検索
- **remove**: 指定ソースのローカルディレクトリと MANIFEST エントリを削除
- **manifest**: `MANIFEST.md` を fetch 済みソースから再生成

## インストール

```bash
npm install -g @shirokuma-library/context
```

## 使用方法

```bash
# 依存関係から自動検出
shirokuma-context detect

# プリセット指定で取得
shirokuma-context fetch nextjs

# fetch 済み全件を再取得
shirokuma-context fetch

# ローカル検索
shirokuma-context search "useEffect"

# fetch 済み一覧
shirokuma-context list
```

## オプション

| オプション | 説明 |
|---|---|
| `--project <path>` | プロジェクトルート（既定: cwd） |
| `--docs-root <path>` | ドキュメント保存ルート（既定: `.shirokuma/contexts`） |
| `--pretty` | JSON をインデント整形、logger 出力を有効化 |
| `--verbose` | debug ログを出力（`--pretty` と併用） |

## 関連パッケージ

- [`@shirokuma-library/flow`](https://www.npmjs.com/package/@shirokuma-library/flow) — ワークフロー管理 CLI
- [`@shirokuma-library/codemap`](https://www.npmjs.com/package/@shirokuma-library/codemap) — コードマップ抽出
