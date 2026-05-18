# Changelog

このファイルはプロジェクトの全ての注目すべき変更を記録します。

フォーマットは [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) に基づき、
バージョン管理は [Semantic Versioning](https://semver.org/spec/v2.0.0.html) に従います。

## [Unreleased]

### Breaking Changes (ADR-v3-022 第二改訂版 #2527)

- **`approve` の意味変更**: `Review → ToDo`（旧 ADR-v3-018）から `Review → Done`（新 ADR-v3-022）に変更。計画 Issue は完了として close され、親 Issue は `syncParentStatus` が `Backlog → ToDo` に自動同期する。
- **`--rollback` フラグ必須化**: `status transition --to {ロールバック先}` を直接呼んでいた全箇所がエラーになる。`--rollback` を明示する必要あり。
- **`validateStatusTransition` シグネチャ変更**: 旧 `validateStatusTransition(from, to)` を削除し、新 `validateTransition(itemType, from, to, opts)` に切り替え。`itemType: "issue" | "pr"` が必須引数。
- **`STATUS_TRANSITIONS` 定数の廃止**: 単一テーブルから 4 テーブル（`ISSUE_FORWARD_TRANSITIONS` / `ISSUE_ROLLBACK_TRANSITIONS` / `PR_FORWARD_TRANSITIONS` / `PR_ROLLBACK_TRANSITIONS`）に分離。
- **`INITIAL_STATUSES` 変更**: `In progress` から `Backlog` に変更。`issue add --status "In progress"` 明示はエラー。
- **`migrate-v3-018` CLI 削除**: 既存 Issue の自動移行は提供しない。

### 過渡期の対応手順

ADR-v3-018 リリース後に運用された Issue で「親 Issue が Review にある」ケースが残る場合:

```bash
# 親 Issue が誤って Review にある場合の戻し方
shirokuma-flow status transition {親 Issue 番号} --to "In progress" --rollback

# 計画 Issue 子を Done に approve（Review → Done）
shirokuma-flow approve {計画 Issue 番号}

# 親 Issue が Backlog → ToDo に自動同期されることを確認
shirokuma-flow issue context {親 Issue 番号}
```

### Added (ADR-v3-022 第二改訂版)

- `getAllowedTransitions(itemType, from, opts)` / `validateTransition(itemType, from, to, opts)` 新 API
- `--rollback` フラグ（`status transition` / `reject` 等）
- `STATUS_VALUES.BACKLOG`（6 値モデル復活）
- `isInvestigationPending` (Backlog 専用) / `isReadyForImplementation` (ToDo 専用)
- `submit` の動的ルーティング（issue: Backlog→Review, pr: In progress→Review）
- `reject` の `itemType` 別動的ルーティング
