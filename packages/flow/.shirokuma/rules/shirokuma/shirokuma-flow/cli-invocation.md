---
scope: default
category: shirokuma-flow
priority: required
---

# shirokuma-flow CLI の呼び出し

## 直接呼び出し（npx 不要）

`shirokuma-flow` はグローバルにインストール済み。常に直接呼び出す：

```bash
# 正しい
shirokuma-flow dashboard
shirokuma-flow issue list
shirokuma-flow lint tests -p .

# 間違い - 不要なオーバーヘッド
npx shirokuma-flow dashboard
```

## 禁止コマンド（CLI でカバー済み）

以下のコマンドは `shirokuma-flow` CLI が内部で処理する。直接使用は禁止。

| 禁止コマンド | 代替 CLI |
|-------------|---------|
| `gh issue list`, `gh issue view`, `gh issue create` | `shirokuma-flow issue list`, `issue context {number}`, `issue add` |
| `gh issue comment` | `shirokuma-flow issue comment {number} {file}` |
| `gh issue edit` | `shirokuma-flow issue update {number}` / `status transition {number} --to <status>` |
| `gh issue close` | `shirokuma-flow issue close {number}` |
| `gh pr create`, `gh pr view`, `gh pr list` | `shirokuma-flow pr create`, `pr show`, `pr list` |
| `gh pr review`, `gh api .../pulls/.../comments` | `shirokuma-flow pr comments`, `pr reply`, `pr resolve` |
| `gh project item-list`, `gh project field-list` | `shirokuma-flow issue list`, `issue fields`（`project list/fields` は廃止） |
| `gh api .../discussions` | `shirokuma-flow discussion list`, `discussion search` |
| `gh search issues` | `shirokuma-flow issue search` |
| `gh search issues --include-prs` | `shirokuma-flow issue search --type issues` |
| Discussions 横断検索 | `shirokuma-flow issue search --type discussions` |
| Issues + Discussions 横断検索 | `shirokuma-flow issue search --type issues,discussions` |

### よくある誤りパターン

```bash
# NG: 生の gh コマンド
gh issue view 42
gh pr create --base develop --title "..."

# OK: shirokuma-flow CLI
shirokuma-flow issue context 42
shirokuma-flow pr create --from-file /tmp/shirokuma-flow/pr.md
```

**例外**: `gh repo view`（リポジトリメタデータ取得）など、`shirokuma-flow` CLI でカバーされていない操作は直接 `gh` を使用してよい。

## Verbose オプション

デフォルト出力は最小限（エラー・警告・成功メッセージのみ）。進捗ログや詳細情報は抑制される。

- AI ワークフローでは `--verbose` を**使用しない** — コンテキストウィンドウを消費する
- `--verbose` は人間のデバッグ用途のみ
