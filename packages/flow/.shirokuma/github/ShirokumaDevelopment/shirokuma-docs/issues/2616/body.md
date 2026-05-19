---
title: "evolution: finalize-worker の opus 切り替えトリガーをメトリック化"
type: Evolution
priority: Low
size: S
status: Backlog
labels:
  - area:plugin
---

## 背景

PR #2614 のレビュー指摘 Low-2 より:

`finalize-worker` の `model: sonnet` 選定について、DESIGN.md L43 で「AI-consumed asset 5 観点の品質維持に懸念が出た場合は opus への切り替えを検討」と記載されているが、「懸念が出た場合」のトリガーが定性的で、誰がいつ判断するかが不明確。

将来の品質劣化を検知しやすくするため、判断基準のメトリック化を残しておく。

## 検討事項

### メトリック候補

- `reviewing-security` の指摘漏れ件数（後続レビューで指摘 → 改善コミットで取り込まれた件数）
- `/simplify` の改善コミット発生率（変更ありの比率）
- `finalize-worker` 完了サマリーで FAIL 終了した件数
- 1 回あたりの SubAgent context 消費トークン数（cap への近接度）

### 閾値設計

- ベースライン期間: 30 日 / 50 PR 程度の実運用データ収集
- アラート閾値: ベースラインの ±X% を超えた場合に Issue として記録
- 閾値超過時アクション: `finalize-worker.md` frontmatter `model` を `sonnet → opus` に書き換える PR を起票

## 関連

- PR #2614 レビュー指摘 Low-2
- 親 Issue: #2612
- 参考: `plugin/shirokuma-skills-ja/agents/finalize-worker.md`、`plugin/specs/skills/finalize-changes/DESIGN.md` L43
