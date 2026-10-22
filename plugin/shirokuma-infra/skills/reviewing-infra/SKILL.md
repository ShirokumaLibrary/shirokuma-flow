---
name: reviewing-infra
description: ローカル開発インフラのコードレビューを行う。Dockerfile のベストプラクティス・Compose ファイルの設計・LocalStack 設定・セキュリティをレビュー。Use when 「Dockerfileレビュー」「docker-composeレビュー」「ローカル環境レビュー」「infra review」「コンテナレビュー」「LocalStackレビュー」と言われたとき。
allowed-tools: Read, Grep, Glob, Bash, WebSearch, WebFetch
model: opus
disable-model-invocation: true
---

# ローカル開発インフラ コードレビュー

Dockerfile、compose（base と断片。`compose.yaml`・`docker-compose*.yml` など）、LocalStack 設定のレビューを行う。イメージサイズ、ビルドキャッシュ効率、セキュリティ、ローカル↔本番の一貫性に集中する。

## スコープ

- **カテゴリ:** 調査系ワーカー
- **スコープ:** インフラファイルの読み取り（Read / Grep / Glob / Bash 読み取り専用）、レビューレポートの生成。コードの修正は行わない。
- **スコープ外:** コードの修正（`coding-infra` に委任）、Docker イメージのビルド・実行

## レビュー観点

### Dockerfile

| チェック項目 | 問題 | 修正方針 |
|------------|------|---------|
| ベースイメージ | `latest` タグの使用 | 固定バージョンタグを使用（例: `node:24-alpine`） |
| マルチステージビルド | シングルステージで全依存を含む | dev / build / production ステージを分離 |
| レイヤーキャッシュ | `COPY . .` を先頭に置く | `package.json` → `npm install` → ソースコードの順 |
| root 実行 | USER 設定なし（root 実行） | `USER node` 等のノンルートユーザーを設定 |
| 不要ファイルの COPY | `.dockerignore` なし / 不完全 | `node_modules`, `.git`, `dist` を除外 |
| 秘密情報 | `ARG SECRET_KEY` でビルド時シークレットを渡す | `--secret` フラグ / BuildKit secret を使用 |
| `apt-get` の後処理 | キャッシュ削除なし | `&& rm -rf /var/lib/apt/lists/*` を追加 |
| EXPOSE | ポートを EXPOSE していない | ドキュメント目的で EXPOSE を追加 |

### compose（base と断片）

| チェック項目 | 問題 | 修正方針 |
|------------|------|---------|
| version フィールド | 古い `version: "3"` | v1.29+ では省略可（Compose Spec 準拠） |
| ヘルスチェック | `healthcheck` なし | 依存サービスに `healthcheck` を追加 |
| `depends_on` | condition なし | `condition: service_healthy` を使用 |
| 環境変数管理 | 環境変数をハードコード | `.env` ファイルと `env_file` を使用 |
| ボリュームの名前付け | 匿名ボリューム | 名前付きボリュームで管理 |
| ネットワーク分離 | デフォルトネットワークのみ | 目的別ネットワーク（frontend / backend）を定義 |
| ports のバインド | `0.0.0.0:5432:5432` | `127.0.0.1:5432:5432` でローカルのみ |
| restart ポリシー | `restart: always` | 開発環境では `restart: unless-stopped` を推奨 |

### LocalStack 設定

| チェック項目 | 問題 | 修正方針 |
|------------|------|---------|
| エンドポイント切り替え | コードに `http://localhost:4566` をハードコード | 環境変数 `LOCALSTACK_ENDPOINT` で切り替え |
| サービス有効化 | `SERVICES` 環境変数が未設定 | 使用するサービスのみ列挙（起動高速化） |
| データ永続化 | LocalStack データが毎回消える | `PERSISTENCE=1` または named volume を設定 |
| `localstack/localstack` イメージ | Pro 機能不要なのに Pro イメージを使用 | `localstack/localstack:4`（メジャー固定）で十分か確認 |
| プロファイル分離 | LocalStack と本番 AWS 設定が混在 | `AWS_PROFILE` または `AWS_DEFAULT_REGION` で分離 |

### セキュリティ

| チェック項目 | 問題 | 修正方針 |
|------------|------|---------|
| `.env` のコミット | `.env` ファイルが `.gitignore` に含まれていない | `.gitignore` に追加し `.env.example` を提供 |
| デフォルトパスワード | `POSTGRES_PASSWORD=password` 等 | ランダム値を `.env` で管理 |
| 特権コンテナ | `privileged: true` の使用 | 必要な capability のみ付与 |

## ワークフロー

### 1. 対象ファイルの確認

```bash
# Dockerfile の確認
find . -name "Dockerfile*" | head -10

# Compose ファイルの確認（既定名・overlay・ハイフン区切りの名前）
find . \( -name "compose.yaml" -o -name "compose.yml" -o -name "compose.*.yaml" -o -name "compose.*.yml" -o -name "docker-compose*.yaml" -o -name "docker-compose*.yml" \) | head -10

# .dockerignore の確認
find . -name ".dockerignore" | head -5

# .env ファイルの確認
find . -name ".env*" -not -name "*.example" | head -10
```

### 2. コード分析

インフラファイルを読み込み、レビュー観点テーブルを適用する。

優先チェック順:
1. セキュリティ（シークレット漏洩・root 実行）
2. Dockerfile ベストプラクティス（ビルドキャッシュ・マルチステージ）
3. Compose ファイルの健全性設計（ヘルスチェック・依存関係）
4. LocalStack 設定の適切性

### 3. レポート生成

**レポート先頭の判定行は機械分岐の契約**——委任元（orchestrator）がこの文字列を走査して差し戻しを分岐するため、一字一句この形式で必ず出力する。

```markdown
**レビュー結果:** PASS | NEEDS_REVISION

## レビュー結果サマリー

### 問題サマリー
| 深刻度 | 件数 |
|--------|------|
| Critical | {n} |
| High | {n} |
| Medium | {n} |
| Low | {n} |
| **合計** | **{n}** |

### 重大な問題
{セキュリティ・root 実行問題を列挙}

### 改善点
{Dockerfile 最適化・Compose ファイルの改善提案を列挙}
```

### 4. レポート保存

PR コンテキストがある場合（PR も issue として top-level コメントできる。`<body>` は**本文そのもの**なので、ファイルは `-` で stdin から流す）:
```bash
shirokuma-flow issue comment {PR#} - < /tmp/shirokuma-flow/review-infra.md
```

PR コンテキストがない場合（レビュー対象の Issue へ記録する）:
```bash
shirokuma-flow issue comment {Issue#} - < /tmp/shirokuma-flow/review-infra.md
```

Issue も PR も無い場合は、**レポートをファイルのまま残し、完了報告にパスと判定行を含める**。CLI は Discussion へ書き込む verb を持たないので、レポートを Discussion へは投稿しない。

## レビュー結果の判定

- **PASS**: `**レビュー結果:** PASS` — 重大な問題なし
- **NEEDS_REVISION**: `**レビュー結果:** NEEDS_REVISION` — 差し戻し。Critical/High 問題あり（シークレット漏洩・root 実行等）

判定行はレポートの**最初の行**に置き、値はこの 2 値のみを使う（他の値は走査に一致せず分岐が成立しない）。一字一句合わせるのは判定行の位置とマーカーの形であって値の列挙ではない——雛形の `PASS | NEEDS_REVISION` は値域の表記なので、実出力ではどちらか **1 値だけ**を書く（両値を並べた行をそのまま出すと走査が PASS と読み取り差し戻しが消える）。

## 注意事項

- **コードの修正は行わない** — 所見の報告のみ
- ローカル開発インフラは本番環境と一致していることも重要。`designing-aws` の設計との乖離も指摘する
