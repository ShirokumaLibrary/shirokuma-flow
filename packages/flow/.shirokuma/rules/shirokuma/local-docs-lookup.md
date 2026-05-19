---
scope:
  - coding-worker
  - design-worker
  - plan-worker
  - review-worker
category: general
priority: preferred
---

# ローカルドキュメント優先参照

外部ライブラリの API やパターンを調べる際、WebSearch の前にローカルドキュメントを確認する。

## 発動条件

外部ライブラリの API・設定・パターンを参照する必要がある場合に適用する。プロジェクト内部のコードのみを扱う場合はスキップしてよい。

## 手順

### 1. ドキュメントソース検出

```bash
shirokuma-flow docs detect --format json
```

`status: "ready"` のソースがあるか確認する。ソースがなければこのルールの処理を終了し、必要に応じて WebSearch を使用する。

### 2. ローカル検索

`status: "ready"` のソースに対して検索:

```bash
shirokuma-flow docs search "<技術> <機能>" --source <ソース名> --section --limit 5
```

### 3. フォールバック

ローカルドキュメントに目的の情報がない、または不足する場合のみ WebSearch で補完する。

## 優先順位

1. ローカルドキュメント（`shirokuma-flow docs search`）
2. WebSearch / WebFetch（公式ドキュメント）

## スキル固有オーバーライド

スキルの SKILL.md にローカルドキュメント検索の手順が記載されている場合（例: `review-issue` の `--limit 3`）、スキル固有の `--limit` 値がこのルールのデフォルト（`--limit 5`）より優先される。
