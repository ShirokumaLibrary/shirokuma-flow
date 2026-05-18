# ワークフローガイド

Claude Code + shirokuma-flow で AI に作業を指示する方法をまとめたガイド集。

## ガイド一覧

| ガイド | 説明 |
|--------|------|
| [ライフサイクル全体像](lifecycle-overview.md) | Issue 作成 → マージまでのシーケンス図とコマンド対応表（俯瞰図） |
| [Issue 管理](issue-management.md) | Issue の作成・管理を AI に指示する |
| [実装](implementation.md) | 機能の実装・バグ修正を AI に依頼する（4 フェーズライフサイクル） |
| [レビューと PR](review-and-pr.md) | コードレビュー・PR 作成を AI に依頼する |
| [セッション管理](session-management.md) | 作業セッションの開始・終了を AI に指示する（checkpoint コマンド含む） |
| [ドキュメントと検証](documentation.md) | ドキュメント生成・コード品質チェックを AI に依頼する |

## 基本的な使い方

shirokuma-flow 環境では、ユーザーは CLI コマンドを直接入力するのではなく、Claude Code に自然言語で指示を出す。Claude Code がスキル（作業パターン）を選択し、内部で CLI コマンドを実行する。

```
ユーザー「#42 に取り組んで」
  → Claude Code が /implement-flow #42 を実行
    → 計画策定（prepare-flow に委任）→ begin → 実装 → コミット → PR → submit
```

### スキルの呼び出し方

| 方法 | 例 | 説明 |
|------|-----|------|
| 自然言語 | 「Issue 作って」「実装して」 | Claude Code がスキルを自動選択 |
| スラッシュコマンド | `/implement-flow #42` | スキルを直接指定 |

どちらの方法でも同じ結果が得られる。

### CLI を直接呼ぶ場合

スキルを介さず CLI を使う場合は、`shirokuma-flow <command>` で直接実行する。日常運用では checkpoint コマンドを優先する:

```bash
shirokuma-flow dashboard          # 状態俯瞰
shirokuma-flow begin 42           # 作業開始
shirokuma-flow submit 42          # レビュー提出
shirokuma-flow status approve 42  # Review → Done
shirokuma-flow integrity --fix    # 整合性修正
```

## 関連ドキュメント

- [Getting Started](../getting-started.md) — インストールとセットアップ
- [プラグイン管理](../plugins.md) — スキル・ルール・フックの詳細
- [CLI クイックリファレンス](../reference/cli-quick-reference.md) — コマンド一覧（補足資料）
