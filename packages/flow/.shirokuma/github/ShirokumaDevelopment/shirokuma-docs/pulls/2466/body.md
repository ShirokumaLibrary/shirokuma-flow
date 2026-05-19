---
number: 2466
type: pull_request
updated_at: "2026-05-09T00:21:24Z"
title: "fix(rules): bundled プラグインの rules/ 不在時を明示エラー化"
cached_at: "2026-05-09T00:21:25.195Z"
---

## 概要

`rules inject` の bundled フォールバック経路において、bundled プラグインディレクトリが存在しない場合にサイレントに 0 件出力していた問題を修正する。不在時に exit 1 と説明的エラーメッセージを返し、`shirokuma-flow init` の実行を案内する。

- `packages/flow/src/commands/rules/inject.ts` に `existsSync` チェックを追加し、不在時は `process.stderr.write` でエラー出力後 `setExitCode(1)` で exit 1 設定
- 対応するユニットテスト (`rules-inject-bundled-missing.test.ts`) を新規追加

## 関連 Issue
Closes #2462

## テスト計画
- [x] `rules inject` — `.shirokuma/rules/` 不在 + bundled 不在の場合に exit 1 と案内メッセージが出力される（新規テスト 2 件）
- [x] `rules inject` — 正常系（`.shirokuma/rules/` 存在）は挙動が変わらない（既存テスト 12 件 PASS）
- [x] `rules inject` — 正常系（bundled 存在）は挙動が変わらない（既存テスト PASS）
