# ドキュメントと検証

ドキュメント自動生成・コード品質チェックを AI に依頼する方法。

## このページでわかること

- ドキュメントの自動生成を依頼する方法（`shirokuma-portal`）
- コード品質チェックの実行方法（`shirokuma-flow lint` / `shirokuma-lint`）
- CI/CD での活用方法

## バイナリ構成

ドキュメント関連は責務ごとに別バイナリに分かれている:

| バイナリ | パッケージ | 役割 |
|---------|-----------|------|
| `shirokuma-portal` | `@shirokuma-library/portal` | ドキュメント生成（typedoc, schema, deps, portal, ...） |
| `shirokuma-lint` | `@shirokuma-library/lint` | コード・ドキュメント・テストの構造 lint |
| `shirokuma-md` | `@shirokuma-library/markdown` | LLM 最適化 Markdown 結合・lint |
| `shirokuma-codemap` | `@shirokuma-library/codemap` | コードマップ抽出 |
| `shirokuma-context` | `@shirokuma-library/context` | 外部ドキュメントのローカル取得 |

`shirokuma-flow lint` は `shirokuma-lint` の薄いラッパー。スキル経由で動かすときはどちらでも動作する。

## よくある指示パターン

### ドキュメントを一括生成する

**指示例:** `ドキュメントを生成して`

**結果:** 設定ファイルで有効になっているドキュメントが一括生成される。

```bash
shirokuma-portal generate
```

生成されるドキュメント:

| 種類 | 内容 |
|------|------|
| API ドキュメント | TypeDoc による TypeScript API リファレンス |
| ER 図 | Drizzle ORM スキーマからの DBML / SVG |
| 依存関係グラフ | モジュール間の依存関係 SVG |
| テストケース一覧 | Jest / Playwright のテスト一覧 |
| 機能階層マップ | 画面→コンポーネント→アクション→テーブルの 4 層構造 |
| ポータルサイト | 全ドキュメントをまとめた HTML サイト |

### 特定のドキュメントだけ生成する

**指示例:** `テストケース一覧を生成して`

```bash
shirokuma-portal generate test-cases -p .
```

**指示例:** `ER 図を生成して`

```bash
shirokuma-portal generate schema -p .
```

### コード品質をチェックする

**指示例:** `lint を実行して`

**結果:** テストコメント、コード構造、ドキュメント構造をチェックする。

```bash
# 一括実行
shirokuma-flow lint all -p .

# 個別実行
shirokuma-flow lint tests -p .         # テストコメント品質
shirokuma-flow lint coverage -p .      # 実装-テスト対応
shirokuma-flow lint docs -p .          # ドキュメント構造
shirokuma-flow lint code -p .          # コードアノテーション・構造
shirokuma-flow lint workflow -p .      # AI ワークフロー規約
shirokuma-flow lint security -p .      # 依存パッケージの脆弱性
```

`shirokuma-lint` を直接使う場合（CI で構造系のみ必要なとき）:

```bash
shirokuma-lint all
shirokuma-lint coverage
shirokuma-lint docs
shirokuma-lint code
shirokuma-lint structure
shirokuma-lint commit-format
```

### 変更影響を分析する

**指示例:** `UserProfile を変更した場合の影響範囲を教えて`

```bash
shirokuma-portal generate impact -t "UserProfile"
```

**結果:** 指定した要素を変更した場合に影響を受けるコンポーネント・アクション・テーブルの一覧が表示される。

### 外部ドキュメントを取得する

依存ライブラリの公式ドキュメントをローカルキャッシュに取得する:

```bash
shirokuma-context detect              # package.json から取得対象を逆引き
shirokuma-context fetch               # 全プリセット
shirokuma-context fetch nextjs-15     # 個別プリセット
shirokuma-context search "useEffect"  # ローカル横断検索
```

### LLM 最適化 Markdown を扱う

```bash
shirokuma-md md build                 # 結合ビルド
shirokuma-md md lint --fix            # lint + 自動修正
```

## 指示のコツ

- **プロジェクトパスを指定する**: ほとんどのコマンドは `-p .` でカレントディレクトリを対象にする
- **CI では `--strict` を使う**: `--strict` を付けると、問題があれば終了コード 1 で失敗する

## CI/CD での活用例

```yaml
# GitHub Actions
- name: Lint tests
  run: shirokuma-flow lint tests -p . -s

- name: Lint coverage
  run: shirokuma-flow lint coverage -p . -s

- name: Lint docs
  run: shirokuma-lint docs --strict
```

## 出力先

```
docs/
├── portal/                  # ポータル HTML
│   ├── index.html
│   └── viewer.html
└── generated/               # 生成ドキュメント
    ├── api/                 # TypeDoc
    ├── schema/              # ER 図
    ├── dependencies.svg     # 依存関係グラフ
    └── test-cases.md        # テストケース一覧
```

出力先は `.shirokuma/config.yaml` の `output` セクションで変更できる。

## 関連

- [設定ファイルリファレンス](../config.md) — 各コマンドの設定項目
- [CLI クイックリファレンス](../reference/cli-quick-reference.md#shirokuma-portal--ドキュメント生成) — 全生成コマンド
- [CLI クイックリファレンス](../reference/cli-quick-reference.md#shirokuma-lint--構造-lint) — 全 lint コマンド
