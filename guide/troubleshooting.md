# トラブルシューティング

よくある問題と対処法。

## インストール関連

### `shirokuma-flow: command not found`

**原因**: パスが通っていないか、インストールが完了していない。

**対処法**:

```bash
# npm グローバルインストールの場合
npm list -g @shirokuma-library/flow

# ワンライナーインストールの場合、~/.local/bin がパスに含まれているか確認
echo $PATH | tr ':' '\n' | grep local

# パスに含まれていない場合
export PATH="$HOME/.local/bin:$PATH"
# 永続化するには ~/.bashrc または ~/.zshrc に追加
```

### `shirokuma-portal` / `shirokuma-lint` が見つからない

`install.sh` は `shirokuma-flow` のみをインストールする。生成系・lint 系は別パッケージで、必要なものを個別にインストールする:

```bash
npm i -g @shirokuma-library/portal      # shirokuma-portal
npm i -g @shirokuma-library/lint        # shirokuma-lint
npm i -g @shirokuma-library/markdown    # shirokuma-md
npm i -g @shirokuma-library/context     # shirokuma-context
npm i -g @shirokuma-library/codemap     # shirokuma-codemap
```

### GitHub 認証エラー

**原因**: `GITHUB_TOKEN` が未設定、または必要なスコープが不足している。

**対処法（推奨）**:

```bash
export GITHUB_TOKEN="ghp_xxxxx"
```

必要なスコープ: `repo`, `read:project`, `project`

**対処法（フォールバック）**:

```bash
gh auth login
gh auth refresh -s read:project,project
```

---

## プラグイン関連

### 新しいスキルがスキルリストに表示されない

**原因**: グローバルキャッシュが更新されていない。

**対処法**:

```bash
shirokuma-flow update
```

更新後は Claude Code を再起動またはセッションを再開する。

自動同期が失敗する場合は [プラグイン管理 > グローバルキャッシュの手動更新](plugins.md#グローバルキャッシュの手動更新フォールバック) を参照。

### `plugin update` が「already at latest」と表示される

**原因**: プラグインのバージョン番号が同じ。`plugin update` はバージョン番号で判断するため、同一バージョンでは更新されない。

**対処法**: uninstall → install で強制更新する:

```bash
claude plugin uninstall shirokuma-skills-ja@shirokuma-library --scope project
claude plugin install shirokuma-skills-ja@shirokuma-library --scope project
```

### あるプロジェクトでスキルが動くが別のプロジェクトでは動かない

**原因**: プラグインのスコープが異なる。

**対処法**: スコープを確認し、必要に応じて再インストールする:

```bash
claude plugin list --scope project
claude plugin install shirokuma-skills-ja@shirokuma-library --scope project
```

### フックがブロックして操作できない

**原因**: `shirokuma-hooks` の安全フックが破壊的コマンドをブロックしている。

**正常な動作の場合**: 本当に実行する必要がある場合は、ユーザーが手動で実行する。

**特定ルールを無効化する場合**: `.shirokuma/config.yaml` の `hooks.allow` で指定する:

```yaml
hooks:
  allow:
    - pr-merge
```

---

## コマンド実行関連

### `Config file not found`

**原因**: `.shirokuma/config.yaml` がカレントディレクトリに存在しない。

**対処法**:

```bash
# 設定ファイルを生成
shirokuma-flow init

# または、パスを明示的に指定
shirokuma-portal generate -c path/to/config.yaml
```

### `shirokuma-portal generate` で特定のコマンドが失敗する

**原因**: そのコマンドに必要な設定が `.shirokuma/config.yaml` に記述されていない。

**対処法**: 個別に実行して詳細を確認する:

```bash
shirokuma-portal generate typedoc -p . -v   # -v で詳細ログ
```

### lint コマンドでエラーが出るが CI を通したい

**対処法**: lint コマンドはデフォルトでは終了コード 0 で終了する。CI で失敗させたい場合は `--strict`（`-s`）を使う。逆に CI を一時的に通したい場合は `--strict` を外す。

---

## GitHub 連携関連

### Projects フィールドが取得できない

**原因**: GitHub Projects V2 がセットアップされていない、またはプロジェクトが Issue にリンクされていない。

**対処法**:

```bash
shirokuma-flow project list
shirokuma-flow project fields
```

プロジェクトが存在しない場合は `/setting-up-project` スキルで初期セットアップするか、CLI で:

```bash
shirokuma-flow project setup --lang ja
shirokuma-flow integrity --setup
```

### セッション引き継ぎが見つからない

**原因**: 作業中の Issue が `In progress` ステータスになっていない、またはコメントによる作業サマリーが残されていない。

**対処法**:

```bash
# In progress Issue を確認
shirokuma-flow issue list --status "In progress"

# 該当 Issue のコメント履歴を確認
shirokuma-flow issue comments <番号>

# 必要に応じてサマリーをコメントとして追記
shirokuma-flow issue comment <番号> --body "..."
```

セッション間のコンテキスト引き継ぎは `In progress` Issue 本文 + コメント（Issue 一元化方針）で完結する。

### クロスリポジトリ操作ができない

**原因**: `.shirokuma/config.yaml` に `crossRepos` が定義されていない。

**対処法**: 設定ファイルにクロスリポジトリの定義を追加する:

```yaml
crossRepos:
  frontend:
    owner: "my-org"
    repo: "frontend-app"
```

---

## ステータス管理関連

### `dashboard` でリポジトリ情報が取得できない

**原因**: git リポジトリ外で実行している、またはリモートが設定されていない。

**対処法**:

```bash
git remote -v
cd /path/to/your-project
shirokuma-flow dashboard
```

### `submit` / `begin` / `block` / `resume` でバリデーションエラー

- 番号が必須（例: `shirokuma-flow submit 42`）
- `block` では `--reason` が必須
- 遷移先ステータスが許可されていない場合は `--force` で強制遷移可能（ただし `status transition` 経由を推奨）

### `integrity` で不整合が検出される

`integrity` は Issue の状態（Open/Closed）と Project Status の整合性を検証する。

| レベル | 条件 | 例 |
|--------|------|---|
| error | OPEN + Done | 完了扱いなのにクローズされていない |
| error | CLOSED + In progress / Review | 作業中なのにクローズされている |
| info | CLOSED + ToDo | 意図的な close の可能性 |

**対処法**: error レベルの不整合を自動修正する:

```bash
shirokuma-flow integrity --fix
```

### 旧 Status 値が残っている場合

現行は 6 値モデル（`Backlog` / `ToDo` / `In progress` / `Blocked` / `Review` / `Done`）。GitHub Projects に旧値（`Approved` / `Completed` / `Pending` / `Ready` / `On Hold` / `Cancelled` 等）が残っている場合の対応:

- **`Approved` 値が残っている場合**: `integrity --fix` が `Approved → Done` に統合する
- **`Completed` / その他 LEGACY 値**: GitHub Project UI で手動更新するか、`shirokuma-flow status transition {N} --to {新値}` で個別に修正する

CLI は旧値を透過的に読み取る（旧値のまま動作するが、書き込みは新値で行われる）。

---

## Git 関連

### 保護ブランチの警告

```
warn Warning: On protected branch "develop". Create a feature branch before committing.
```

**対処法**: フィーチャーブランチを作成する:

```bash
git checkout -b feat/42-my-feature
# または
shirokuma-flow issue branch 42
```

### ブランチ名の規約エラー

**正しいブランチ命名**: `{type}/{issue-number}-{slug}`

例: `feat/42-dashboard`, `fix/15-auth-bug`, `chore/30-update-deps`

`shirokuma-flow issue branch <N>` を使うと自動的に正しい命名で作成される。

### `update` 後にスキルが反映されない

**対処法**:

1. `shirokuma-flow update` を再実行し、出力メッセージを確認する
2. Claude Code を再起動または新しいセッションを開始する
3. それでも反映されない場合は [プラグイン管理 > グローバルキャッシュの手動更新](plugins.md#グローバルキャッシュの手動更新フォールバック) を参照

---

## アンインストール

### CLI を削除する

```bash
# インストーラスクリプト経由の場合
rm -f ~/.local/bin/shirokuma-flow
rm -rf ~/.local/share/shirokuma-flow

# npm 経由の場合
npm uninstall -g @shirokuma-library/flow
```

### プロジェクトごとのファイルを削除する

```bash
rm -rf .claude/rules/shirokuma/
rm -f .shirokuma/config.yaml

claude plugin uninstall shirokuma-skills-ja@shirokuma-library --scope project
claude plugin uninstall shirokuma-hooks@shirokuma-library --scope project
```

---

## それでも解決しない場合

1. `-v` / `--verbose` オプションを付けて詳細ログを確認する
2. GitHub Issues で既知の問題を検索する: https://github.com/ShirokumaLibrary/shirokuma-flow/issues
3. 新しい Issue を作成して報告する
