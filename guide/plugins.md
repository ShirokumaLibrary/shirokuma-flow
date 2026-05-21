# プラグイン管理

Claude Code 用のスキル・ルール・フックをインストール・更新・管理する方法。

## プラグインのアーキテクチャ

shirokuma-flow のプラグインはマーケットプレース経由で配信される:

```
shirokuma-flow init / update
  → マーケットプレース登録 (shirokuma-library)
    → GitHub からリモートフェッチ (ShirokumaLibrary/shirokuma-plugins)
      → グローバルキャッシュ (~/.claude/plugins/cache/) に保存
        → Claude Code がここからスキルを読み込む
```

- Claude Code はグローバルキャッシュからスキルを読み込む
- プロジェクトローカルへのコピー（`.claude/plugins/`）は不要
- `update` コマンドでキャッシュの最新化を自動実行する

## 提供されるプラグイン

| プラグイン名 | 内容 |
|-------------|------|
| `shirokuma-skills-ja` | スキル + ルール（日本語版） |
| `shirokuma-skills-en` | スキル + ルール（英語版） |
| `shirokuma-nextjs-ja` | Next.js 向けスキル（日本語版、`--with-nextjs` で追加） |
| `shirokuma-nextjs-en` | Next.js 向けスキル（英語版、`--with-nextjs` で追加） |
| `shirokuma-hooks` | 安全フック（言語非依存） |

`--lang` オプションで選んだ言語に応じて `-ja` または `-en` 版がインストールされる。`shirokuma-hooks` は言語に関係なく常にインストールされる。

## インストール方法

### 方法 A: init コマンドで一括インストールする（推奨）

```bash
shirokuma-flow init --with-skills --with-rules --lang ja
```

以下が実行される:

1. `.shirokuma/config.yaml` の生成
2. マーケットプレース（`shirokuma-library`）の登録
3. GitHub からプラグインをフェッチし、グローバルキャッシュに登録
4. `.claude/rules/shirokuma/` にルールファイルをデプロイ
5. `shirokuma-hooks` プラグインを自動インストール

> `--with-skills` と `--with-rules` の両方を指定するのが推奨。ルールはスキルプラグインに同梱されているが、`.claude/rules/` に展開しないと Claude Code に認識されない。

### 方法 B: 手動でインストールする

```bash
# 1. マーケットプレースを登録
claude plugin marketplace add ShirokumaLibrary/shirokuma-plugins

# 2. プラグインをインストール
claude plugin install shirokuma-skills-ja@shirokuma-library --scope project
claude plugin install shirokuma-hooks@shirokuma-library --scope project

# 3. ルールをデプロイ
shirokuma-flow update --with-rules
```

## チャネル切替（stable / prerelease）

shirokuma-flow は 2 つの配信チャネルを提供する:

| チャネル | 配信元 | 用途 |
|---------|--------|------|
| stable | `ShirokumaLibrary/shirokuma-plugins` | 一般ユーザー（推奨） |
| prerelease (alpha/beta) | `ShirokumaDevelopment/shirokuma-plugins` | 早期検証・開発者 |

### CLI コマンドで切替（推奨）

`shirokuma-flow plugin install` が内部で `claude plugin marketplace remove` → `add` の 2 ステップを実行し、確実に片方のチャネルのみ install された状態に切り替える:

```bash
# prerelease に切り替え
shirokuma-flow plugin install --prerelease

# stable に戻す
shirokuma-flow plugin install

# プレビュー（変更なし）
shirokuma-flow plugin install --prerelease --dry-run
```

CLI 自体も alpha 版に切り替えたい場合は `install.sh --prerelease` を使う:

```bash
curl -fsSL https://raw.githubusercontent.com/ShirokumaLibrary/shirokuma-flow/main/install.sh | bash -s -- --prerelease
shirokuma-flow plugin install --prerelease
```

### 手動切替（CLI 経由が使えない環境向け）

```bash
# prerelease
claude plugin marketplace remove shirokuma-library
claude plugin marketplace add ShirokumaDevelopment/shirokuma-plugins

# stable
claude plugin marketplace remove shirokuma-library
claude plugin marketplace add ShirokumaLibrary/shirokuma-plugins
```

> **注意**: `claude plugin marketplace add` を直接実行すると、同名 marketplace は silent overwrite される（警告なし）。意図せず切り替わらないよう、まず `claude plugin marketplace list` で現状を確認することを推奨。

### 同時利用について

stable と prerelease は **同時に登録できない**（同じ `marketplace.json#name = shirokuma-library` を使うため）。常に片方のみが登録される。

### 既存 alpha ユーザーの移行

過去に `claude plugin marketplace add ShirokumaLibrary/shirokuma-plugins` で alpha 版を install していたユーザーは、引き続き同じコマンドで stable チャネルを受ける。prerelease を試したい場合のみ上記の `shirokuma-flow plugin install --prerelease` を実行する。

### 方法 C: ローカル plugin/ をテストする（緊急時のみ）

CDN 障害や publish 前の動作確認など、レジストリ経由が使えない場合の脱出弁:

```bash
shirokuma-flow plugin-install-local

# 過去 plugin リリースが配置した管理外ルール（.shirokuma/rules/shirokuma/ 配下の orphan ファイル）も削除する
shirokuma-flow plugin-install-local --cleanup-rules
```

`--cleanup-rules` のデフォルトは無効。通常開発は **alpha publish + `shirokuma-flow plugin install --prerelease`** の経路を使うこと。詳細は本リポ開発者向けドキュメント [.claude/rules/dev-cli-switch.md](../.claude/rules/dev-cli-switch.md) を参照。

## 更新方法

### 推奨: `update` コマンドで一括更新する

```bash
shirokuma-flow update
```

`update` は以下を一括実行する（`--sync` はデフォルト有効）:

1. マーケットプレースの確認・登録
2. `claude plugin update` でグローバルキャッシュを最新化
3. `.claude/rules/shirokuma/` のルールファイルを更新

更新後は Claude Code のセッションを再起動する。

### 詳細オプション

```bash
shirokuma-flow update --sync --with-rules
```

| オプション | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `--sync` | boolean | `true` | 新規スキルの追加・旧スキルの削除を検出する（デフォルト有効） |
| `--with-rules` | boolean | `false` | ルールファイルも更新する |
| `--dry-run` | boolean | `false` | プレビューのみ実行する |
| `-f, --force` | boolean | `false` | ローカルの変更を無視して強制更新する |
| `--install-cache` | boolean | `false` | グローバルキャッシュを強制更新する |

各オプションの詳細は [CLI クイックリファレンス](reference/cli-quick-reference.md) を参照。

### グローバルキャッシュの手動更新（フォールバック）

`update` の自動同期が失敗した場合のみ手動で更新する。

プラグインのバージョンが変わった場合:

```bash
claude plugin update shirokuma-skills-ja@shirokuma-library --scope project
claude plugin update shirokuma-hooks@shirokuma-library --scope project
```

バージョンが同じで内容が変わった場合（`plugin update` が「already at latest」と表示される場合）:

```bash
claude plugin uninstall shirokuma-skills-ja@shirokuma-library --scope project
claude plugin install shirokuma-skills-ja@shirokuma-library --scope project
```

## スキル

スキルは Claude Code に特定の作業パターンを教えるファイル。`/スキル名` で呼び出す。

### オーケストレーション（4 フェーズライフサイクル）

| スキル | 呼び出し方 | 機能 |
|-------|-----------|------|
| `implement-flow` | `/implement-flow #42` | 作業ディスパッチャー（全作業のエントリーポイント） |
| `prepare-flow` | `/prepare-flow #42` | 計画フェーズのオーケストレーター |
| `design-flow` | `/design-flow #42` | 設計フェーズのオーケストレーター（必要な場合のみ） |
| `requirements-flow` | `/requirements-flow` | 要件定義フェーズ（独立、Issue 操作なし） |
| `review-flow` | `/review-flow #5` | PR レビューコメントへの対応 |

### 会話初期化

| スキル | 呼び出し方 | 機能 |
|-------|-----------|------|
| `starting-session` | `/starting-session [#N]` | 会話初期化（デフォルトルールをロード）。Issue 番号指定時は `implement-flow #N` にルーティング |

### 開発（汎用）

| スキル | 呼び出し方 | 機能 |
|-------|-----------|------|
| `plan-issue` | `/plan-issue #42` | Issue の実装計画を策定（subagent: plan-worker） |
| `code-issue` | — | 汎用コーディング（implement-flow から自動委任） |
| `review-issue` | `/review-issue` | コードレビュー・セキュリティ監査 |
| `analyze-issue` | `/analyze-issue` | Issue 分析（plan / requirements / design / research の役割） |
| `designing-generic` | `/designing-generic` | フレームワーク非依存のアーキテクチャ設計 |
| `discovering-design` | — | Design Brief 作成・Aesthetic Direction（design-flow Phase 2） |
| `evaluating-design` | — | Visual evaluation loop（design-flow Phase 4） |
| `discovering-codebase-rules` | `/discovering-codebase-rules` | コードベースのパターン発見と規約提案 |
| `auditing-security` | `/auditing-security` | 依存パッケージのセキュリティ脆弱性監査 |
| `researching-best-practices` | `/researching-best-practices` | ベストプラクティス調査 |
| `reviewing-claude-config` | `/reviewing-claude-config` | Claude Code 設定ファイルの品質レビュー |
| `reviewing-security` | `/reviewing-security` | セキュリティレビュー（finalize-changes チェーン） |
| `finalize-changes` | — | 後処理チェーン（/simplify → security review → improvement commit） |
| `evolving-rules` | `/evolving-rules` | ルール・スキルの進化シグナル分析と改善提案 |

### Git / GitHub

| スキル | 呼び出し方 | 機能 |
|-------|-----------|------|
| `issue-flow` | `/issue-flow` | Issue 作成 → implement-flow に自動チェーン |
| `commit-issue` | `/commit-issue` | ステージ → コミット → プッシュ（subagent: commit-worker） |
| `open-pr-issue` | `/open-pr-issue` | PR 作成（subagent: pr-worker） |
| `managing-github-items` | — | Issue / Discussion エンジン（内部利用） |
| `showing-github` | `/showing-github` | プロジェクトデータ・ダッシュボード表示 |
| `setting-up-project` | `/setting-up-project` | 新規プロジェクト初期設定（対話式） |

### 設定管理（開発者向け）

| スキル | 呼び出し方 | 機能 |
|-------|-----------|------|
| `coding-claude-config` | `/coding-claude-config` | スキル・ルール・エージェント・プラグイン・出力スタイルの作成・更新（EN/JA 同期） |
| `write-adr` | `/write-adr` | ADR を GitHub Discussion に作成 |
| `publishing` | `/publishing` | パブリックリリース（repo pairs） |
| `project-config-generator` | `/project-config-generator` | プロジェクト設定ファイル生成 |

### Next.js 拡張（shirokuma-nextjs プラグイン）

`--with-nextjs` オプションでインストールされる追加スキル:

| スキル | 呼び出し方 | 機能 |
|-------|-----------|------|
| `coding-nextjs` | — | Next.js TDD 実装（implement-flow から自動委任） |
| `designing-nextjs` | `/designing-nextjs` | Next.js アーキテクチャ設計（ルーティング、コンポーネント、データ層） |
| `designing-shadcn-ui` | `/designing-shadcn-ui` | 印象的な UI / 独自デザイン |
| `designing-drizzle` | `/designing-drizzle` | Drizzle ORM データモデル設計（テーブル、リレーション、マイグレーション） |

全スキル一覧は [`skills-index.md`](../../.shirokuma/rules/shirokuma-flow/skills-index.md) を参照。

## ルール

ルールは Claude Code に従うべき規約を伝えるファイル。`.claude/rules/` に配置されると自動的に読み込まれる。

### ルールの配置

```
.claude/rules/
├── shirokuma/                  # プラグインからデプロイされたルール（gitignore）
│   ├── best-practices-first.md
│   ├── git-commit-style.md
│   ├── github/
│   │   ├── branch-workflow.md
│   │   └── project-items.md
│   └── nextjs/
│       ├── tech-stack.md
│       └── known-issues.md
└── （プロジェクト固有ルールは .shirokuma/rules/<project-name>/ 配下に置く）
```

| ディレクトリ | 説明 | 編集 | Git 管理 |
|-------------|------|------|----------|
| `.claude/rules/shirokuma/` | プラグインからデプロイ | 編集禁止（`update` で上書きされる） | `.gitignore` に含まれる |
| `.shirokuma/rules/<project-name>/` | プロジェクト固有 | 自由に編集可能 | Git 管理対象 |

## フック

フックは Claude Code の操作前に自動実行されるスクリプト。`shirokuma-hooks` プラグインに含まれている。

### デフォルトでブロックされるコマンド

| コマンド | 理由 |
|---------|------|
| `gh pr merge` | PR マージは人間の承認が必要 |
| `git push --force` | リモート履歴の上書きを防止 |
| `git reset --hard` | 未コミット変更の消失を防止 |
| `git checkout .` / `git restore .` | 作業内容の消失を防止 |
| `git clean -f` | 未追跡ファイルの削除を防止 |
| `git branch -D` | ブランチの強制削除を防止 |

ブロックされた場合、Claude Code はユーザーに確認を求める。

### プロジェクトごとにオーバーライドする

`.shirokuma/config.yaml` の `hooks.allow` で許可するコマンドを指定する:

```yaml
hooks:
  allow:
    - pr-merge              # gh pr merge / pr merge を許可
    # - force-push          # git push --force
    # - hard-reset          # git reset --hard
```

`hooks.allow` が未設定の場合、全ルールが有効（全ブロック）。コメントを外すとそのコマンドが許可される。

## 関連ドキュメント

- [Getting Started](getting-started.md) — インストールとプロジェクト初期化
- [CLI クイックリファレンス](reference/cli-quick-reference.md) — `init`, `update` の構文
- [設定ファイルリファレンス](config.md) — `hooks.allow` の設定
- [トラブルシューティング](troubleshooting.md#プラグイン関連) — プラグイン関連のよくある問題
