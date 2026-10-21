---
name: coding-cicd
description: CI/CD パイプラインの構築・修正を支援する。GitHub Actions テンプレート（CI=lint→test→build、CD=環境別デプロイ）を提供。Use when 「CI/CD」「GitHub Actions」「パイプライン」「デプロイワークフロー」「ci-test」「cd-deploy」と言われたとき。
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
disable-model-invocation: true
---

# CI/CD コーディング

CI/CD パイプラインの構築・修正を支援する。初回はプロジェクトの CI/CD 方針を確認・記録し、GitHub Actions テンプレートを使った実装をガイドする。

## スコープ

- **カテゴリ:** 変更系ワーカー
- **スコープ:** GitHub Actions ワークフローファイルの実装・修正（Write / Edit / Bash）。CI（テスト・ビルド）と CD（環境別デプロイ）の両ワークフローを対象とする。
- **スコープ外:** AWS リソース設計（`designing-aws` に委任）、CDK コンストラクト実装（`coding-cdk` に委任）、docker-compose によるローカル環境構築（`coding-infra` に委任）

### coding-cdk との責務境界

| 担当 | スキル |
|------|--------|
| CDK diff/deploy ジョブ単体 | `coding-cdk`（`reference/templates/github-actions-cdk.yml.template` 参照） |
| CI パイプライン全体（lint/test/build） | `coding-cicd`（本スキル） |
| CD パイプライン全体（環境別デプロイ） | `coding-cicd`（本スキル） |
| CD 内の CDK デプロイステップ | `coding-cicd` から `coding-cdk` テンプレートをクロスリファレンス |

## 開始前に

1. プロジェクトの `CLAUDE.md` や `designing-aws` 設計成果物に CI/CD 方針が記録済みか確認
2. 既存の `.github/workflows/` ディレクトリを確認（重複ワークフローを避ける）
3. [reference/patterns/github-actions-patterns.md](reference/patterns/github-actions-patterns.md) の OIDC 認証設定を確認

## ワークフロー

### ステップ 1: CI/CD 方針確認

`CLAUDE.md`、Issue 本文、`designing-aws` の設計成果物に CI/CD 方針が記録されているか確認する。

**方針が記録済みの場合** → その方針に従ってステップ 2 に進む。

**方針が未記録の場合** → AskUserQuestion で以下を確認:

| 確認項目 | 選択肢の例 |
|---------|-----------|
| CI/CD ツール | GitHub Actions / CircleCI / GitLab CI / Jenkins / 不要（手動デプロイ） |
| CI の範囲 | lint + test + build / test のみ / 不要 |
| CD の範囲 | 環境別自動デプロイ / 手動デプロイ / 不要 |
| デプロイ先 | AWS（ECS / Lambda / S3）/ Vercel / その他 |
| 環境構成 | dev + staging + prod / dev + prod / prod のみ |

確認後、方針の記録先もユーザーに確認する（`CLAUDE.md` のテック構成セクション / Issue 本文 / その他）。記録したらステップ 2 に進む。

> **CI/CD 不要の場合**: ユーザーが「不要」と判断した場合はその旨を記録して終了。無理に CI/CD を導入しない。

### ステップ 2: 既存構成確認

```bash
# 既存ワークフロー確認
ls -la .github/workflows/ 2>/dev/null || echo "ワークフローなし"

# パッケージマネージャーとスクリプト確認
cat package.json | grep -E '"(test|build|lint|typecheck)'

# Node.js バージョン確認
cat .nvmrc 2>/dev/null || cat .node-version 2>/dev/null || echo "バージョンファイルなし"
```

確認事項:
- 既存ワークフローとの重複・競合
- テスト・ビルド・lint のコマンド名
- パッケージマネージャー（npm / pnpm / yarn）
- キャッシュ対象のロックファイル

### ステップ 3: 実装計画

進捗トラッカー（全ステップの一覧）を作成し、開始時・完了時に状態を更新する。本 skill はタスク管理ツールを使わないので、手順表を応答本文に状態つき（`todo` / `in_progress` / `done`）で残し、更新のたびに書き直す。手順表は省かない。完了報告には、手順表で進めたことを書く。応答本文の手順表は Stop hook の検知に掛からないので、省いても機械では気づかれない。

```markdown
## 実装計画

### 作成・変更ファイル
- [ ] `.github/workflows/ci.yml` - CI ワークフロー（lint/test/build）
- [ ] `.github/workflows/cd.yml` - CD ワークフロー（環境別デプロイ）

### 確認事項
- [ ] GitHub Environments 設定（dev/staging/production）
- [ ] OIDC ロール ARN の Secrets 設定
- [ ] ブランチ戦略（開発ブランチ→dev, mainline→staging/prod）。mainline の実名を `gh repo view --json defaultBranchRef -q .defaultBranchRef.name` で確認して `{MAIN_BRANCH}` に、開発ブランチ名を `{DEV_BRANCH}` に入れる（**両者は必ず別名**。mainline が `develop` のリポでは特に注意。開発ブランチが無いなら dev 経路を削除する）
- [ ] CDK デプロイを含む場合は coding-cdk テンプレートとの整合
```

### ステップ 4: 実装

パターンを参照して実装:

- デプロイ戦略の選択: [reference/patterns/deploy-strategies.md](reference/patterns/deploy-strategies.md)
- **DB スキーマ変更を伴う場合**の適用媒体・打つ位置・失敗時の扱い・ネットワーク: [reference/patterns/db-migration-delivery.md](reference/patterns/db-migration-delivery.md)（戦略を決めた**後**に読む。4 軸を決めずに CD へマイグレーションを入れると、失敗が後続ジョブへ伝わらない形＝fail-silent に倒れやすい）
- GitHub Actions パターン（OIDC・キャッシュ・Reusable Workflows）: [reference/patterns/github-actions-patterns.md](reference/patterns/github-actions-patterns.md)

CI ワークフロー雛形: [reference/templates/ci-test-build.yml.template](reference/templates/ci-test-build.yml.template)

CD ワークフロー雛形: [reference/templates/cd-deploy.yml.template](reference/templates/cd-deploy.yml.template)

CDK デプロイを CD に含む場合: `coding-cdk` の `reference/templates/github-actions-cdk.yml.template` を参照してデプロイジョブを組み込む

**テンプレートのプレースホルダ置換（必須）**:

テンプレートは `{...}` のプレースホルダを含み、**そのままでは動かない**。ヘッダコメントの「カスタマイズ箇所」を正本として全件置換する。

- `{PACKAGE_MANAGER}` / `{LOCK_FILE}` / `{NODE_VERSION}`
- `{MAIN_BRANCH}` — **このリポジトリの mainline ブランチ名**。決め打ちせず実測する:

  ```bash
  gh repo view --json defaultBranchRef -q .defaultBranchRef.name
  ```

  `on.push.branches` / `on.pull_request.branches` と `if: github.ref == 'refs/heads/{MAIN_BRANCH}'` の両方に出るので、まとめて置換する。

- `{DEV_BRANCH}` — **dev 環境へデプロイする開発ブランチ名**。
  - **`{MAIN_BRANCH}` と必ず異なる名前**にする。同じ名前を入れると、そのブランチへの 1 回の push が `deploy-dev` / `deploy-staging` / `deploy-prod` の `if` を同時に満たし、**本番を含む 3 環境が同時にデプロイされる**。mainline が `develop` のリポジトリでこの事故が起きやすい。
  - **dev 用ブランチが無い（mainline 1 本）なら、別の名前に置換するのではなく dev 経路を削除する**。cd-deploy の場合は次の 5 つを漏らさない:
    1. `on.push.branches` の `'{DEV_BRANCH}'` 行
    2. `deploy-dev` job 全体
    3. 他 job の `needs:` に残った `deploy-dev` 参照
    4. `on.workflow_dispatch.inputs.environment.options` の `dev` — **落とすと手動実行で `dev` を選んでも受け取る job が無く、全 job skip で緑のまま何も起きない**（本 skill が消そうとしている沈黙そのもの）
    5. ヘッダの `{DEV_BRANCH}` 解説ブロック — **落とすと下の `grep` 検査に残存 `{DEV_BRANCH}` が引っかかり続け、正しく削除した人ほど検査に落ちる**

    手動デプロイを残したい場合は 2〜5 を行わず、`deploy-dev` の `if` から push 側の条件式だけを削り `workflow_dispatch` 側を残す。

- 置換後に**残っていないことを機械で確認**する（0 件になること）:

  ```bash
  grep -rnE "\{[A-Z_]+\}" .github/workflows/
  ```

  ディレクトリ再帰にしてあるのは、`*.yml` / `*.yaml` の glob 指定だと該当ファイルが無い側で警告が出て終了コードが 2 になり、「出力が空＝クリーン」と読み違えやすいため。

**⚠️ 「緑だから置換済み」とは言えない**: 未置換の影響はプレースホルダによって違う。

| 未置換の箇所 | 起きること | 気づけるか |
|---|---|---|
| `{MAIN_BRANCH}` / `{DEV_BRANCH}` が `on.*.branches` に残る | 実在しないブランチ名として扱われ、workflow が一切トリガーしない | **沈黙**（赤くならない） |
| `{MAIN_BRANCH}` / `{DEV_BRANCH}` が job の `if:` に残る | 条件が真にならず job が skip される・チェックは緑 | **沈黙**（赤くならない） |
| `{PACKAGE_MANAGER}` | `run: {PACKAGE_MANAGER} ...` が YAML として不正になり workflow が invalid 扱い | **workflow がトリガーされれば**赤くなる（パース段階） |
| `{LOCK_FILE}` / `{NODE_VERSION}` | YAML は通るが `setup-node` が不正なバージョン / 存在しないパスで失敗する | **workflow がトリガーされれば**赤くなる（ステップ実行時） |
| IAM 信頼ポリシーの `sub`（値を IAM 側へ転記したとき） | AssumeRole が拒否される | **workflow がトリガーされれば**赤くなる（ステップ実行時） |

**「赤くなる」側には成立条件がある——workflow がトリガーされること。** 最も普通の失敗（テンプレートをコピーして何も置換しない）では `on.*.branches` も未置換なのでイベントが 1 つもマッチせず、赤が出る前に沈黙する側へ倒れうる。したがって逆向きの推論（「赤い＝置換漏れではない」「緑＝置換済み」）はどちらも成り立たない。

> 上表のうち「ステップ実行時に赤」は、YAML パースまでを実測した上での**推論**であって GitHub Actions 上で実走検証したものではない。配置後に必ず 1 度 mainline へ変更を反映（PR を merge）し、該当 job の run が実際に作られたことを確認すること。

**実装チェック**:
- OIDC 認証を使用し、IAM アクセスキーを Secrets に保存しない
- `permissions` を最小限に絞る（`id-token: write`, `contents: read` など）
- `cache-dependency-path` にロックファイルを指定してキャッシュを有効化
- GitHub Environments の `environment:` キーで承認フローを設定

### ステップ 5: 検証

```bash
# YAML 構文チェック（actionlint がある場合）
actionlint .github/workflows/*.yml 2>/dev/null || echo "actionlint 未インストール"

# GitHub Actions の構文を手動確認
cat .github/workflows/ci.yml
cat .github/workflows/cd.yml
```

検証チェック:
- **テンプレートのプレースホルダ（`{MAIN_BRANCH}` 等）が 1 つも残っていないか**（`grep -rnE "\{[A-Z_]+\}" .github/workflows/` が 0 件）
- `on:` トリガーが意図したブランチ・パスに設定されているか（`{MAIN_BRANCH}` の置換値が `gh repo view --json defaultBranchRef -q .defaultBranchRef.name` と一致するか）
- **`{MAIN_BRANCH}` と `{DEV_BRANCH}` の置換値が別名になっているか**（同名だと dev / staging / prod が同時発火する）
- `needs:` によるジョブ依存関係が正しいか
- `environment:` が正しい環境名を参照しているか（GitHub 設定と一致）
- DB マイグレーションのステップを含む場合、**失敗が終了コードで後続ジョブへ伝わるか**（`reference/patterns/db-migration-delivery.md` の「実装後の確認」を全項目通す。伝わらない形は緑のまま通る＝fail-silent）
- シークレット名（`secrets.DEPLOY_ROLE_ARN` 等）が一貫しているか

### ステップ 6: 完了レポート

変更内容をコメントとして Issue に記録する。

## リファレンスドキュメント

| ドキュメント | 内容 | 読むタイミング |
|------------|------|--------------|
| [reference/patterns/deploy-strategies.md](reference/patterns/deploy-strategies.md) | Blue/Green・Rolling・Canary 戦略比較、GitHub Environments 承認フロー、ロールバック手順 | デプロイ戦略選定時 |
| [reference/patterns/db-migration-delivery.md](reference/patterns/db-migration-delivery.md) | DB マイグレーションの実行媒体・打つ位置（拡張→切替→縮約）・戦略別の失敗時の扱い・VPC 内実行 | DB スキーマ変更を伴うデプロイを組む時（戦略決定の直後） |
| [reference/patterns/github-actions-patterns.md](reference/patterns/github-actions-patterns.md) | OIDC 認証設定、キャッシュ戦略、Reusable Workflows、secrets 管理 | ワークフロー実装時 |
| [reference/templates/ci-test-build.yml.template](reference/templates/ci-test-build.yml.template) | lint→test→build CI パイプライン雛形 | CI ワークフロー作成時 |
| [reference/templates/cd-deploy.yml.template](reference/templates/cd-deploy.yml.template) | dev→staging→prod 環境別デプロイ雛形 | CD ワークフロー作成時 |

## クイックコマンド

```bash
# ワークフローファイル一覧
ls -la .github/workflows/

# actionlint でローカル検証（要インストール）
brew install actionlint && actionlint

# act でローカル実行（要インストール）
act pull_request --dry-run

# GitHub CLI でワークフロー実行状況確認
gh run list --limit 10
gh run view {run-id}
```

## 次のステップ

`implement-flow` チェーンではなくスタンドアロンで起動された場合:

```
実装完了。次のステップ:
→ `implement-flow` の手順でコミットへ進む（コミットは `commit-worker` が行う）
```

## 注意事項

- **IAM アクセスキーをコードに埋め込まない** — OIDC 認証を使用し、長期クレデンシャルは一切使用しない
- **`permissions` は最小権限** — 必要なスコープのみ明示的に許可する
- **CDK デプロイステップは `coding-cdk` テンプレートを参照** — 独自実装せずクロスリファレンス
- **環境名は GitHub Environments と一致させる** — `environment: dev` は GitHub の environment 名と完全一致が必要
- **prod 承認は必須** — production 環境には必ず manual approval を設定する
- **ロックファイルを `cache-dependency-path` に指定** — `package-lock.json` / `pnpm-lock.yaml` / `yarn.lock` でキャッシュを有効化
