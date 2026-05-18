# Issue 管理

Issue の作成・更新・検索を AI に指示する方法。

## このページでわかること

- Issue を作成して作業を開始する流れ
- 既存の Issue を検索・確認する方法
- Issue のステータスや優先度を更新する方法

## よくある指示パターン

### Issue を作成して作業を開始する

**指示例:** `認証ページの実装を Issue にして`

**結果:** Claude Code が以下を順次実行する:
1. Issue を作成（タイトル・本文・タイプ・優先度を自動設定）
2. GitHub Projects に追加
3. 自動的に `/implement-flow` に引き継ぎ、実装を開始

スラッシュコマンドで直接呼び出すこともできる:

```
/create-item-flow 認証ページの実装
```

### 既存の Issue に取り組む

**指示例:** `#42 に取り組んで` または `#42 やって`

**結果:** Claude Code が Issue を分析し、計画→（必要なら設計）→実装→コミット→PR→ステータス更新（submit checkpoint 経由）を順次実行する。

```
/implement-flow #42
```

### Issue を確認する

**指示例:** `ダッシュボード見せて` または `Issue 一覧を見せて`

**結果:** アクティブな Issue 一覧が Projects フィールド（Status, Priority, Size）付きで表示される。

```
/showing-github
```

CLI から直接見るには:

```bash
shirokuma-flow dashboard
shirokuma-flow issue list
```

### Issue を検索する

**指示例:** `認証に関する Issue を探して`

**結果:** Issues / PR / Discussions を横断検索し、関連するアイテムを表示する。

CLI から:

```bash
shirokuma-flow issue search "認証"               # 既定で issue / pr / discussion を横断
shirokuma-flow issue search "認証" --type issue  # Issue のみ
```

### Issue のステータスを更新する

**指示例:** `#42 をブロックして、理由は API の仕様確定待ち`

**結果:** Issue のステータスが Blocked に更新され、理由がコメントとして追加される。

CLI から（checkpoint コマンド推奨）:

```bash
shirokuma-flow block 42 --reason "API の仕様確定待ち"   # Status: Blocked + 理由をコメント化
shirokuma-flow resume 42                                # In progress に戻す
shirokuma-flow status transition 42 --to "ToDo"         # 任意のステータスに遷移
```

## 指示のコツ

- **Issue 番号を含める**: `#42` のように番号を指定すると、正確に対象を特定できる
- **タイプを明示する**: 「バグ修正」「機能追加」「リファクタ」と伝えると、適切な Issue Type が設定される
- **優先度やサイズを伝える**: 「優先度高めで」「小さい修正だけど」と伝えると、Priority と Size が適切に設定される

## ステータスの流れ

GitHub Projects V2 の Status は **6 値**。

```
Backlog → ToDo → In progress → Review → Done
                      ↑↓
                   Blocked
```

| ステータス | 意味 | 主な遷移コマンド |
|-----------|------|----------------|
| Backlog | 未調査・未トリアージ。Issue 作成時のデフォルト値 | `issue add` 時の初期値 |
| ToDo | 計画承認済み・着手準備完了（計画 Done 後の syncParentStatus 自動遷移） | `approve <計画 Issue>` 副作用 |
| In progress | 作業中（計画 / 設計 / 実装すべて） | `begin <N>` |
| Blocked | 中断中（reason 必須） | `block <N> --reason "..."` |
| Review | レビュー待ち（計画 Issue 子のレビュー / PR コードレビュー） | `submit <N>` |
| Done | 完了（キャンセルも `state_reason: not_planned` で Done に統一） | `pr merge <N>` / `issue cancel <N>` |

> 「Designing / Preparing / Working」は **フェーズ概念（オーケストレーター名）** であり、Status 値ではない。設計フェーズ・計画フェーズ・実装フェーズいずれも GitHub Status は `In progress` で表現される。

## CLI コマンド

主に使うのは以下:

```bash
shirokuma-flow issue list                       # アクティブな Issue 一覧
shirokuma-flow issue pull 42                    # Issue 本体 + コメントをキャッシュ
shirokuma-flow issue add new.md          # Issue 作成
shirokuma-flow issue update 42 edit.md          # 本文・メタデータ更新
shirokuma-flow issue comment 42 note.md  # コメント追加
shirokuma-flow issue close 42                   # クローズ
shirokuma-flow issue branch 42                  # フィーチャーブランチを作成
```

詳細は [CLI クイックリファレンス](../reference/cli-quick-reference.md#issue--issue--関連オペレーション)。

## 関連

- [実装ワークフロー](implementation.md) — Issue の実装を依頼する
- [セッション管理](session-management.md) — checkpoint コマンド (`begin`, `submit`, `block`, `resume`)
- [CLI クイックリファレンス](../reference/cli-quick-reference.md) — `issue` コマンドの詳細
