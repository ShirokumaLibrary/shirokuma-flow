# @shirokuma-library/markdown

LLM 最適化 Markdown ドキュメント管理 CLI（`shirokuma-md`）。複数の Markdown を結合・検証・解析し、AI が読み込みやすい形式にまとめる。

## 機能

- **build**: 複数 Markdown を 1 ファイルに結合（include 解決・heading 階層調整）
- **validate**: ドキュメントの構造（必須セクション・frontmatter・内部リンク）検証
- **analyze**: ドキュメント間の依存関係・構造を解析
- **lint**: Markdown の lint チェック
- **list**: ドキュメントファイル一覧の生成
- **extract** / **batch-extract**: Markdown からの情報抽出（単一・複数ファイル）

## インストール

```bash
npm install -g @shirokuma-library/markdown
```

## 使用方法

```bash
# 結合 Markdown を生成
shirokuma-md md build --config .shirokuma/md/build.yaml

# 構造検証
shirokuma-md md validate --config .shirokuma/md/validate.yaml

# 依存関係解析
shirokuma-md md analyze --project .

# 全コマンド一覧
shirokuma-md --help
shirokuma-md md --help
```

## 関連パッケージ

- [`@shirokuma-library/shirokuma-flow`](https://www.npmjs.com/package/@shirokuma-library/shirokuma-flow) — ワークフロー管理 CLI
- [`@shirokuma-library/lint`](https://www.npmjs.com/package/@shirokuma-library/lint) — ファイルレベル lint チェック
