---
scope:
  - main
category: shirokuma-flow
priority: required
---

# プラグインキャッシュ管理

## アーキテクチャ

Claude Code はスキルを**グローバルキャッシュ**から読み込む。プラグインは `shirokuma-plugins` marketplace リポジトリから配信される。

```
ShirokumaLibrary/shirokuma-plugins (marketplace リポジトリ)
    ↓ claude plugin install/update
~/.claude/plugins/cache/shirokuma-library/...  (グローバルキャッシュ — Claude Code はここから読み込む)
    ↓ shirokuma-flow init / update
.claude/rules/shirokuma/  (デプロイ済みルール — プロジェクトローカル、gitignored)
```

**重要な変更（#486）:** プロジェクトローカルの `.claude/plugins/` ディレクトリは廃止。プラグインは marketplace からグローバルキャッシュに直接配信される。

## 推奨: `shirokuma-flow update`

`shirokuma-flow update` はグローバルキャッシュ更新+ルール再展開を一発で実行するコマンド。`--sync` はデフォルト有効。`--with-rules` 等のオプションも使用可能（旧 `update-skills` コマンドのオプションを統合）。

```bash
# 推奨
shirokuma-flow update

# 追加オプション付き
shirokuma-flow update --sync --with-rules
```

## 初期セットアップ

`shirokuma-flow init --with-skills` が自動的に:
1. marketplace を登録（`claude plugin marketplace add`）
2. プラグインをグローバルキャッシュにインストール（`claude plugin install`）
3. ルールを `.claude/rules/shirokuma/` に展開

## 手動キャッシュ操作

```bash
# 最新バージョンに更新
claude plugin update shirokuma-skills-ja@shirokuma-library --scope project

# 強制再インストール（バージョン同じだが内容更新）
claude plugin uninstall shirokuma-skills-ja@shirokuma-library --scope project
claude plugin install shirokuma-skills-ja@shirokuma-library --scope project
```

キャッシュ更新後、スキルが表示されるには新しいセッションが必要。

## キャッシュの衛生管理

`shirokuma-flow update` は自動的に以下を実行する:

- **古いキャッシュバージョンの削除**: `keepCount = 3` で最新3バージョンを保持し、古いディレクトリを削除
- **semver ソート**: バージョンディレクトリを semver 順で解決（辞書順ではなく数値比較）
- **marketplace ソース確認**: `Source: Directory`（ローカル参照）を検出した場合、`Source: GitHub`（fresh clone）に自動再登録
- **`local/` ディレクトリ除外**: `local/` ディレクトリはローカルインストール用（`plugin install-local` で使用）であり、semver バージョンではないためバージョンソート・クリーンアップの対象外

## ユーザーへのガイダンスが必要な場合

| 症状 | 原因 | アクション |
|------|------|----------|
| 新しいスキルがスキルリストにない | キャッシュ未更新 | `shirokuma-flow update` または `claude plugin uninstall` + `install` |
| `plugin update` が「already at latest」と表示 | バージョン番号が同じ | uninstall + install を使用 |
| あるプロジェクトでスキルが動くが別では動かない | プラグインスコープの不一致 | `--scope`（user vs project）を確認 |
| `.claude/plugins/` ディレクトリがまだ存在する | レガシーインストール | `shirokuma-flow update` で自動クリーンアップ |
| `disable` / `uninstall` でスコープ不一致エラー | プラグインが `--scope project` でインストール済み | `--scope project` を指定、または `--scope` を省略して auto-detect |
| marketplace が `Source: Directory` で登録されている | ローカル参照が残存 | `shirokuma-flow update` で自動再登録、または手動: `claude plugin marketplace remove shirokuma-library` → `claude plugin marketplace add ShirokumaLibrary/shirokuma-plugins` |

## ルール

1. **グローバルキャッシュに直接書き込まない** — `claude plugin` コマンドを使用
2. **`shirokuma-flow update` を推奨** — キャッシュ更新+ルール再展開を一発で実行
3. **バージョンが同じ場合の更新は uninstall + install** — `plugin update` はバージョン未変更時にスキップする
4. **`.claude/plugins/` はレガシー** — 存在する場合、`shirokuma-flow update` が自動的にクリーンアップ
5. **キャッシュクリーンアップは自動** — `shirokuma-flow update` が古いバージョンを自動削除（最新3つを保持）
