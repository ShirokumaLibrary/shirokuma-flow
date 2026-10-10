---
name: reviewing-cicd
description: GitHub Actions ワークフローのレビューを行う。デプロイ戦略・シークレット管理・権限設計・ジョブ構成をレビュー。Use when 「CICDレビュー」「GitHub Actionsレビュー」「ワークフローレビュー」「cicd review」「デプロイパイプラインレビュー」と言われたとき。
allowed-tools: Read, Grep, Glob, Bash, WebSearch, WebFetch
model: opus
---

# CI/CD パイプライン コードレビュー

GitHub Actions ワークフローのレビューを行う。セキュリティ（シークレット管理・権限）、デプロイ戦略、効率性（キャッシュ・並列化）に集中する。

## スコープ

- **カテゴリ:** 調査系ワーカー
- **スコープ:** GitHub Actions ワークフローファイルの読み取り（Read / Grep / Glob / Bash 読み取り専用）、レビューレポートの生成。コードの修正は行わない。
- **スコープ外:** ワークフローの修正（`coding-cicd` に委任）、実際のデプロイ実行

## レビュー観点

### セキュリティ（シークレット管理）

| チェック項目 | 問題 | 修正方針 |
|------------|------|---------|
| シークレットのログ出力 | `echo ${{ secrets.KEY }}` | シークレットをエコーしない |
| ENV でのシークレット露出 | `env: SECRET: ${{ secrets.KEY }}` をすべてのジョブに設定 | 必要なジョブのみに限定 |
| ハードコードされた値 | ワークフローに API キー / パスワードを直書き | GitHub Secrets を使用 |
| `pull_request_target` | フォーク PR でのシークレット漏洩リスク | `pull_request` を使用、または慎重に制御 |
| サードパーティ action の固定 | `uses: actions/checkout@v3` | SHA でピン留め（例: `@abc1234`） |

### 権限設計

| チェック項目 | 問題 | 修正方針 |
|------------|------|---------|
| 過剰な `permissions` | `permissions: write-all` | 最小権限を明示（`contents: read` 等） |
| GITHUB_TOKEN スコープ | デフォルトの広いスコープ | ジョブ単位で `permissions` を制限 |
| OIDC 未使用 | 長期 AWS 認証情報を Secrets に格納 | `aws-actions/configure-aws-credentials` + OIDC |

### ジョブ構成 / 効率性

| チェック項目 | 問題 | 修正方針 |
|------------|------|---------|
| 依存関係キャッシュ | `npm install` が毎回フルインストール | `actions/cache` で `node_modules` をキャッシュ |
| 並列実行 | テスト / リント / ビルドが直列 | `needs` で依存関係を正しく設定し並列化 |
| マトリクス戦略 | 複数環境のテストを手動で繰り返す | `strategy.matrix` を使用 |
| タイムアウト | `timeout-minutes` 未設定 | デフォルト 360 分は長すぎる、適切な値を設定 |
| 失敗時のアーティファクト | テスト失敗時のログを取得できない | `if: failure()` でアーティファクトをアップロード |

### デプロイ戦略

| チェック項目 | 問題 | 修正方針 |
|------------|------|---------|
| 環境別デプロイ | mainline ブランチへの push で直接 prod デプロイ（`main` 決め打ちで探さない。`gh repo view --json defaultBranchRef -q .defaultBranchRef.name` で実名を確認してから該当箇所を探す） | `environment` とアプルーバル設定を使用 |
| ブランチ名の決め打ち | `on.*.branches` や `if:` の条件が特定のブランチ名を直書きしており、そのリポジトリの mainline 名と一致していない | 発火条件のブランチ名が実際の mainline / 開発ブランチと一致するか照合する（不一致だと job が skip されるだけで**赤くならない**） |
| ロールバック戦略 | ロールバック手順がない | 前のバージョンへの切り戻し手順を文書化 |
| Blue/Green の欠如 | 停止時間のあるデプロイ | ECS Blue/Green / Lambda エイリアス切り替えを検討 |
| カナリアデプロイ | 全トラフィックを一度に切り替え | 段階的デプロイ（10% → 50% → 100%）を検討 |
| ドリフト検知 | CDK デプロイ後のドリフト確認なし | `cdk diff` をポストデプロイに追加 |

### CDK 固有

| チェック項目 | 問題 | 修正方針 |
|------------|------|---------|
| `cdk bootstrap` | 毎回実行している | 初回のみ実行（冪等だが遅い） |
| `--require-approval` | インタラクティブな承認を求める | CI では `--require-approval never` |
| `--all` フラグ | 全スタックを常にデプロイ | 変更のあるスタックのみターゲット |
| CloudFormation の失敗 | デプロイ失敗時のロールバック確認なし | `--no-rollback` は使わない |

### コード品質

| チェック項目 | 問題 | 修正方針 |
|------------|------|---------|
| リント / 型チェック | CI にリントがない | `pnpm lint` / `tsc --noEmit` をジョブに追加 |
| テスト | テストがない / スキップ | テストジョブを必須にする |
| ビルド確認 | ビルドなしでデプロイ | ビルド → テスト → デプロイの順を強制 |
| セキュリティスキャン | 依存関係の脆弱性チェックなし | `npm audit` / `pnpm audit` を追加 |

## ワークフロー

### 1. 対象ファイルの確認

```bash
# GitHub Actions ワークフローの確認
find .github/workflows -name "*.yml" -o -name "*.yaml" | head -20

# シークレット使用箇所
grep -r "secrets\." .github/workflows/ | head -20

# OIDC 設定
grep -r "aws-actions/configure-aws-credentials" .github/workflows/ | head -10
```

### 2. コード分析

ワークフローファイルを読み込み、レビュー観点テーブルを適用する。

優先チェック順:
1. シークレット漏洩リスク
2. 権限の最小化（OIDC 使用）
3. デプロイ戦略の安全性
4. CI 効率性（キャッシュ・並列化）

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
{シークレット漏洩・過剰権限問題を列挙}

### 改善点
{CI 効率化・デプロイ戦略改善提案を列挙}
```

### 4. レポート保存

PR コンテキストがある場合（PR も issue として top-level コメントできる。`<body>` は**本文そのもの**なので、ファイルは `-` で stdin から流す）:
```bash
shirokuma-flow issue comment {PR#} - < /tmp/shirokuma-flow/review-cicd.md
```

PR コンテキストがない場合（レビュー対象の Issue へ記録する）:
```bash
shirokuma-flow issue comment {Issue#} - < /tmp/shirokuma-flow/review-cicd.md
```

Issue も PR も無い場合は、**レポートをファイルのまま残し、完了報告にパスと判定行を含める**。Discussion への新規投稿は使わない——`discussion` のサブコマンドは `create` / `update` のみで、`create` は `--category` に Discussion カテゴリの node ID を要求し、CLI にはそれを解決する verb が無い（`adr create` はカテゴリを config `adr.category`〔既定 `ADR`〕で解決する——ADR 経路専用の値なので、レビュー投稿のために書き換えない）。

## レビュー結果の判定

- **PASS**: `**レビュー結果:** PASS` — 重大な問題なし
- **NEEDS_REVISION**: `**レビュー結果:** NEEDS_REVISION` — 差し戻し。Critical/High 問題あり（シークレット漏洩・`permissions: write-all` 等）

判定行はレポートの**最初の行**に置き、値はこの 2 値のみを使う（他の値は走査に一致せず分岐が成立しない）。一字一句合わせるのは判定行の位置とマーカーの形であって値の列挙ではない——雛形の `PASS | NEEDS_REVISION` は値域の表記なので、実出力ではどちらか **1 値だけ**を書く（両値を並べた行をそのまま出すと走査が PASS と読み取り差し戻しが消える）。

## 注意事項

- **コードの修正は行わない** — 所見の報告のみ
- GitHub Actions のバージョンは定期的に変わる。`@v3` → `@v4` 等のアップデートも提案してよい
- OIDC を使った AWS 認証は長期認証情報より安全。常に推奨する
