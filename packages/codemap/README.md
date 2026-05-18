# @shirokuma-library/codemap

リポジトリの構造的シグナル（ディレクトリ・依存関係・公開 API 等）から、AI が読み取りやすいコードマップを抽出する CLI。

## 機能

- **build**: コードマップを構築（main index + JIT bodies の 2 段構成、ADR-0025 準拠）
- リポジトリの全体像を JSON で出力
- AI が `gh` や `find` を多重に呼ばずに構造を把握できる形式に整形

## インストール

```bash
npm install -g @shirokuma-library/codemap
```

## 使用方法

```bash
# コードマップを構築
shirokuma-codemap build --project .

# JSON 整形出力
shirokuma-codemap --pretty build --project .

# 全コマンド一覧
shirokuma-codemap --help
```

## オプション

| オプション | 説明 |
|---|---|
| `--project <path>` | プロジェクトルート（既定: cwd） |
| `--pretty` | JSON をインデント整形 |

## 関連パッケージ

- [`@shirokuma-library/flow`](https://www.npmjs.com/package/@shirokuma-library/flow) — ワークフロー管理 CLI
- [`@shirokuma-library/portal`](https://www.npmjs.com/package/@shirokuma-library/portal) — ドキュメントポータル生成
