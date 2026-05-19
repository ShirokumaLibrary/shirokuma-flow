---
title: "test: finalize-worker SubAgent から `Skill(skill: \"simplify\")` で builtin 起動可能かを手動検証"
type: Chore
priority: Low
size: XS
status: Backlog
labels:
  - area:plugin
---

## 背景

PR #2614 のレビュー指摘 Low-1 より:

`finalize-worker.md` Step B/C で `Skill(skill: "simplify")` / `Skill(skill: "reviewing-security")` を呼び出しているが、`/simplify` は builtin Slash コマンド、`reviewing-security` はプラグインスキル。SubAgent 内から builtin Slash コマンドを `Skill` ツール経由で起動する動作が、`SlashCommand` ツールと比較してどちらが正規かは reference に当たれていない。

`implement-flow/SKILL.md` L284 等で `/simplify` 表記が混在しているため見た目の整合性は取れているが、SubAgent コンテキストでの実起動動作は別途検証が必要。

## 検証手順

1. 適当な変更（例: コメント1行追加）をワーキングディレクトリに作成
2. `finalize-changes` スキルを Skill ツールで起動（`Skill(skill: "finalize-changes")`）
3. `finalize-worker` SubAgent のログを確認:
   - Step B: `/simplify` が builtin として起動したか / Skill ツールが simplify スキルを探そうとして失敗したか
   - Step C: `reviewing-security` プラグインスキルが起動したか
4. Step B が失敗していた場合は `SlashCommand` ツール経由（`SlashCommand(name: "simplify")`）に書き換える検討

## 期待する成果

- `finalize-worker.md` Step B/C の Skill 呼び出し記法が動作確認済み（または修正済み）であることが diff から判別できる
- 動作不能なら `SlashCommand` ツール使用に切り替え

## 関連

- PR #2614 レビュー指摘 Low-1
- 親 Issue: #2612
- 参考: `plugin/shirokuma-skills-ja/agents/finalize-worker.md`、`plugin/shirokuma-skills-ja/skills/finalize-changes/SKILL.md`
