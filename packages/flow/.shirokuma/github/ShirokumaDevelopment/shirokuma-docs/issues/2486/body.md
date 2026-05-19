---
title: "feat(cli): discussion add の本文受け渡しも positional file argument に統一する"
type: Feature
priority: Low
size: S
labels:
  - "area:cli"
  - "area:github"
status: "In progress"
---

## 目的

`discussion add` の本文受け渡し経路を **positional file argument に統一**し、`issue add <file>` / `issue comment <number> <file>` と CLI シグネチャの対称性を取り戻す。

## 背景

#2482 / PR #2485 で `issue add` / `issue comment` / `pr create` / `pr edit` / `pr reply` / `issue update` を positional file argument に統一し、インライン body の物理的封鎖を達成した。一方で `discussion add` は同じ「frontmatter 付き md ファイルからアイテムを作成する」操作にもかかわらず `--file <file>` フラグのまま残っている。

PR #2485 のレビューでも Medium #8 として以下の指摘があった:

> PR の動機「AI から見た CLI の素直さを上げる」に照らすと、同じ「frontmatter 付き md ファイルからアイテムを作成する」操作の `issue add` と `discussion add` で記法が分かれることになる。本 PR 後追いで `discussion add` も positional 化するなら follow-up Issue を作成し、しないなら理由を仕様書（`docs/specs/cli/items-create.md` 等）に明記したい。

スコープを絞る判断で本 PR からは外したが、対称性を保つために follow-up として対応する。

## 検討事項

- **シグネチャ変更**: `discussion add --file <file>` → `discussion add <file>`（required positional）
- **`--from-file` との関係**: `pr create` と同様、positional `[body-file]` と `--from-file` の排他にする必要があるか確認（discussion add に `--from-file` があれば）
- **テスト影響**: `__tests__/commands/discussion/**` の既存呼び出し箇所を grep して positional 形式に書き換え
- **ドキュメントの追従**:
  - `.shirokuma/rules/shirokuma-flow/github-commands.md` の例（`shirokuma-flow discussion add --file ...` → positional）
  - `plugin/shirokuma-skills-{en,ja}/skills/**/SKILL.md` 内の `discussion add` 例示
  - `.claude/agents/knowledge-manager/reference/github-operations.md` の `discussion add`
  - `docs/guide/**` 配下の `discussion add` 言及
- **stdin (`-`) サポート**: `discussion add -` で stdin から読み込めるようにする（他 positional コマンドと挙動を揃える）
- **pre-release alpha のため互換スタブ不要**: `--file` 廃止で破壊的変更とするのが CLAUDE.md の方針と整合的

## 成果物

- **`discussion add` の signature 変更**: `discussion add --file <file>` → `discussion add <file>`（`packages/flow/src/commands/discussion/index.ts` の Commander 定義）
- **テスト書き換え**: `__tests__/commands/discussion/**` の既存呼び出し箇所
- **ドキュメント一括更新**: 上記の検討事項参照
- **`positional-body-file.test.ts` 相当のテスト**: `discussion add --file` が unknown option として拒否されることのアサーション（PR #2485 の `pr create --body` 拒否テストと同パターン）

## 関連

- 親要件: #2482（feat(cli): issue/pr の body 受け渡し経路を positional file argument に統一しインライン --body を廃止）
- 参考 PR: #2485（PR #2482 の実装 PR、レビュー対応コミット f6d95b1）
- レビュー指摘: PR #2485 のコードレビュー Medium #8
