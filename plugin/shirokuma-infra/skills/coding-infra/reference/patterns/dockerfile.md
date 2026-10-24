# Dockerfile パターン集

> **スコープ**: ビルド・デプロイ準備に集中する。Dockerfile の記述と .dockerignore の設定が対象。本番デプロイ（オーケストレーション、レジストリ push、CI/CD パイプライン）は対象外。

## Next.js standalone output マルチステージビルド

Next.js の `output: "standalone"` 設定に最適化したテンプレート。

### next.config.ts

```typescript
const nextConfig = {
  output: "standalone",
};
export default nextConfig;
```

### Dockerfile

```dockerfile
# syntax=docker/dockerfile:1

# ---- Base ----
FROM node:24-alpine AS base
RUN corepack enable

# ---- Dependencies ----
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---- Builder ----
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ---- Runner ----
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# non-root ユーザー
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# standalone 出力をコピー
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

## ビルド出力の契約分岐（standalone / cdk-nextjs adapterPath）

Next.js アプリの Dockerfile は、本番デプロイ先の選択でビルド出力の契約が二分する。cdk-nextjs をデプロイ先に選んだ場合と、それ以外（**汎用コンテナ経路**＝cdk-nextjs をデプロイ先にしない構成）とで扱いを分ける。**判定軸はフレームワーク名ではなく「cdk-nextjs をデプロイ先にするか」**で、語の定義と帰結の正本は designing-aws の `reference/patterns/nextjs-deploy.md`「2 つのコンテナ経路」節。

| デプロイ先 | next.config | 本番 Dockerfile | 本ファイルの適用 |
|-----------|------------|----------------|----------------|
| **汎用コンテナ経路**（cdk-nextjs 外・ECS Fargate + ALB 等） | `output: "standalone"` | 本ファイルの standalone マルチステージ Dockerfile を使う | **適用** |
| cdk-nextjs（`NextjsGlobalFunctions` ほか 4 構成） | `adapterPath: import.meta.resolve("cdk-nextjs/adapter")`・`output: "standalone"` は使わない | **cdk-nextjs が自前生成**（手書き不要） | 非適用 |

- **cdk-nextjs 経路では本ファイルの standalone Dockerfile を書かない**。cdk-nextjs は Next.js を black box 扱いし、公開 adapter API 経由でビルドして自前で Dockerfile を生成する。`output: "standalone"` と `adapterPath` は同時両立しないため、cdk-nextjs を選ぶなら standalone 設定を外す。
- **汎用コンテナ経路**: 非 Next.js アプリ・cdk-nextjs を選ばない Next.js アプリでは、本ファイルの standalone マルチステージ Dockerfile を使う。
- **前提バージョン**: Next.js はどちらの経路でも 16 系は v16.4.1 以上・15 系は v15.5.28 以上（Next.js 公式ブログのセキュリティ告知〔https://nextjs.org/blog/nextjs-security-update-october-14-2026〕の修正版）。cdk-nextjs 経路は 16 系だけが対象で（互換の要件〔16.2 系以降〕もこの下限で満たす）、Node v24・Docker 必須。デプロイ先スタックの選定と互換契約は designing-aws スキルの `reference/patterns/nextjs-deploy.md` を参照。

## 汎用 Node.js アプリ向けパターン

CLI ツール、API サーバーなど Next.js 以外の Node.js アプリケーション向け。

```dockerfile
# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
RUN corepack enable

FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

COPY --from=deps --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --chown=appuser:nodejs . .

USER appuser

EXPOSE 8080
CMD ["node", "dist/index.js"]
```

## pnpm キャッシュ最適化

BuildKit のキャッシュマウントでビルドを高速化する。

```dockerfile
# pnpm ストアをキャッシュとしてマウント（イメージレイヤーに含まれない）
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
```

| オプション | 説明 |
|-----------|------|
| `--mount=type=cache` | ビルド間で永続するキャッシュ |
| `id=pnpm` | ステージ間で共有するキャッシュ ID |
| `target=...` | pnpm ストアのパス（pnpm が自動検出） |
| `--frozen-lockfile` | ロックファイルが古い場合にビルド失敗 |

> **npm の場合**: `--mount=type=cache,target=/root/.npm`

## セキュリティベストプラクティス

### non-root ユーザー

```dockerfile
# システムグループとユーザーを作成
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# ファイルコピー時にオーナーシップを付与
COPY --chown=appuser:nodejs . .

# non-root ユーザーに切り替え
USER appuser
```

> コンテナは常に non-root で実行する。侵害されたコンテナがホストシステムに書き込めなくなる。

### .dockerignore

```gitignore
# 依存関係（コンテナ内で再インストール）
node_modules

# ビルド成果物
.next
dist
build

# ローカル開発ファイル
.env
.env.local
.env.*.local

# バージョン管理
.git
.gitignore

# エディタ設定
.vscode
.idea
*.swp

# ログ
*.log
npm-debug.log*

# テストファイル
__tests__
*.test.ts
*.spec.ts
coverage

# ドキュメント
*.md
docs

# IaC / CDK（build context に infra コード・機微情報を混入させない）
infra
cdk.out
cdk.context.json

# Docker ファイル（イメージにコピー不要）
Dockerfile*
docker-compose*
.dockerignore
```

> **infra 除外の背景（手書き AppService 経路向け）**: `infra`・`cdk.out`・`cdk.context.json` の除外は、手書き `AppService`（ECS + ALB の Docker build）でリポ root を build context にする経路のためのもの。build context に infra の CDK コードや `cdk.context.json`（account ID 等の機微情報）が混入するのを防ぐ。cdk-nextjs 既定経路は `buildDirectory`（Next.js プロジェクト root のみをビルド）を使うため infra はそもそも混入せず、この除外は不要。なお除外はビルド成果物の分離であり、リポ分割（infra の submodule 化）とは直交する — 同一 build context に入れば submodule でも混入するため、`.dockerignore` での除外が本質。

## イメージサイズ最適化テクニック

### マルチステージビルド戦略

| ステージ | 用途 | 最終イメージに含まれる |
|---------|------|---------------------|
| `base` | 共通ベースイメージ | いいえ |
| `deps` | 全依存関係インストール | いいえ |
| `builder` | アプリケーションビルド | いいえ |
| `runner` | 本番ランタイム | はい |

最終イメージには `runner` ステージのみが含まれる。ビルドツールと開発依存関係は除外される。

### Alpine イメージ

```dockerfile
FROM node:24-alpine  # 約50MB（Debian の約330MB に対して）
```

> **注意**: ネイティブモジュール（bcrypt、canvas 等）は Alpine で動作しない場合がある。問題が発生した場合は `node:24-slim` を使用する。

### レイヤー数の最小化

```dockerfile
# 悪い例: 複数の RUN が複数のレイヤーを作成
RUN apk add --no-cache curl
RUN apk add --no-cache git

# 良い例: 1 つの RUN で 1 レイヤーに削減
RUN apk add --no-cache curl git
```

## ビルド引数と環境変数

```dockerfile
# ビルド時変数（デフォルトではイメージに含まれない）
ARG NEXT_PUBLIC_API_URL

# ランタイム環境変数
ENV NODE_ENV=production

# ARG を ENV にコピー（イメージに永続化）
ARG BUILD_VERSION
ENV APP_VERSION=$BUILD_VERSION
```

| 種別 | 構文 | ビルド時に利用可 | ランタイムに利用可 |
|------|------|----------------|-----------------|
| ARG | `ARG KEY=default` | はい | いいえ（ENV にコピーした場合のみ） |
| ENV | `ENV KEY=value` | はい | はい |

> **セキュリティ**: シークレット（API キー、パスワード）を ARG や ENV に渡さないこと。Docker secrets またはランタイム環境変数注入を使用する。

## よくある問題と対策

| 問題 | 原因 | 対策 |
|------|------|------|
| イメージサイズが大きい | ホストの `node_modules` をコピー | 必ず `deps` ステージからコピーし、ホストから直接コピーしない |
| CI でビルドが失敗する | キャッシュミス | 一貫した `id` で `--mount=type=cache` を使用する |
| コンテナ内で Permission denied | root 実行またはオーナーシップ不一致 | non-root ユーザーを追加し、COPY に `--chown` を付ける |
| `.env` ファイルがイメージに含まれる | `.dockerignore` の設定漏れ | 必ず `.env*` を `.dockerignore` に追加する |
| ネイティブモジュールのビルドエラー | Alpine 非互換 | `node:24-slim`（Debian ベース）に切り替える |
