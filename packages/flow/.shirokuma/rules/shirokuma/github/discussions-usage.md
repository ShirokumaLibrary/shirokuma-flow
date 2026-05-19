---
scope:
  - main
category: github
priority: required
---

# GitHub Discussions 活用ガイド

## 目的

Discussions は人間向けの知識を蓄積し、Rules は AI 向けの抽出情報を格納します。

| レイヤー | 対象 | 言語 | 内容 |
|---------|------|------|------|
| Discussions | 人間 | 日本語 | コンテキスト、根拠、詳細 |
| Rules/Skills | AI | 英語 | 簡潔なパターン、コマンド |

## カテゴリ

| カテゴリ | Emoji | Format | 用途 |
|---------|-------|--------|------|
| ADR | 📐 | Open-ended discussion | 確定したアーキテクチャ決定 |
| Knowledge | 💡 | Open-ended discussion | 確認されたパターン・解決策 |
| Research | 🔬 | Open-ended discussion | 調査が必要な事項 |

> Evolution シグナルは Discussion ではなく Issue で管理します。詳細は `rule-evolution` ルールを参照。

## ワークフロー

```
Research → ADR（決定の場合）→ Knowledge → Rule 抽出
```

### Discussion → Issue フロー

アイデアや提案は、実装が決定されるまで Discussions に置きます。

```
Discussion（アイデア）→ 実装決定 → Issue（ToDo）→ In progress
```

| アクション | タイミング |
|-----------|-----------|
| Discussion を作成 | 新しいアイデア、提案、調査トピック |
| Issue に変換 | チームが実装を決定 |
| Discussion のまま | アイデアが却下、延期、または情報提供のみ |

未決定のアイデアで Issue を作成しないでください。まず Discussions で探索と意思決定を行います。

## AI の行動指針

1. **検索**: 新規作成前に `shirokuma-flow discussion search "{keyword}"` または `shirokuma-flow issue search --type discussions "{keyword}"` で確認
2. **読む**: リサーチ時にコンテキストとして Discussions を確認
3. **書く**: 重要な知見について Discussions を作成
4. **抽出**: パターンが確認されたら `managing-rules` スキルで Rule 化を提案
5. **本文メンテ**: コメント後に必ず本文も統合版として更新（`project-items` ルール参照）

Knowledge→Rule 抽出ワークフロー・検索コマンド詳細は `managing-github-items` スキル実行時に自動ロードされる。

> Auto Memory に詳細情報を書かない。memory はポインタのみ、詳細は Discussion に記録する（`memory-operations` ルール参照）。

## タイトル形式

| カテゴリ | 形式 |
|---------|------|
| ADR | `ADR-{NNN}: {タイトル}` |
| Knowledge | `{トピック名}` |
| Research | `[Research] {トピック}` |
