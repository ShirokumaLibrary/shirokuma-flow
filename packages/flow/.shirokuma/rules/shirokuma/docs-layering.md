---
scope:
  - main
  - coding-worker
category: documentation
priority: recommended
---

# ドキュメント配置ルール（docs-layering）

新しいドキュメント・ルール・スキル・ADR を作成する際に「どこに置くか」を判定するための基準。

## 三層配置モデル

| カテゴリ | 配置先 | 理由 |
|---------|-------|------|
| ワークフローを駆動するルール（常時必要） | `CLAUDE.md`（index 形式） | LLM が毎回読み込む。必要最小限にとどめる |
| コードと同期必須の reference | `.shirokuma/rules/{project}/` | コード変更と同一コミットで更新する |
| プラグイン配布ルール（汎用・AI 向け） | `plugin/shirokuma-skills-{en,ja}/rules/` | `init` で展開、AI が実行時に参照 |
| 人間向け説明・tutorial | `docs/` | 人間が読む。AI は通常参照しない |
| スキル / ルールの設計ドキュメント | `plugin/specs/` | 設計メモ。実行時に AI は読まない |
| 意思決定・議論ログ（ADR） | GitHub Discussion（ADR カテゴリ） | 永続的な意思決定の記録 |
| 一時的な計画・TODO | Issue 本文 | 揮発的。完了したら消える |

## 判定フロー

新しいドキュメントを作成する前に次の質問に答える:

```
Q1: コードと密結合しているか（コード変更のたびに更新が必要か）？
  → YES: .shirokuma/rules/{project}/ に置く

Q2: LLM が毎回のワークフロー実行時に参照する必要があるか？
  → YES: CLAUDE.md に index エントリとして追加（本文は別ファイルに）
  → NO, but AI が任意で参照する汎用知識: plugin/shirokuma-skills-{en,ja}/rules/ に置く

Q3: アーキテクチャ上の意思決定を記録するものか？
  → YES: GitHub Discussion（ADR カテゴリ）に write-adr スキルで作成

Q4: 一時的な計画・TODO か？
  → YES: Issue 本文に書く（docs/ やルールに書かない）

Q5: スキル / ルールの設計背景・評価基準を記録するか？
  → YES: plugin/specs/skills/{name}/DESIGN.md または plugin/specs/rules/（または同等の設計メモ置き場）に置く

Q6: 人間が読む説明・チュートリアルか？
  → YES: docs/ に置く
```

## 境界ケース（具体例）

### 1. reference（コード同期必須）vs tutorial（人間向け説明）

**reference**: 例: CLI コマンド実装のサブコマンド一覧とオプション定義。コード変更時に更新が必要 → `.shirokuma/rules/{project}/command-reference.md`

**tutorial**: 例: 「機能 X を使う手順」のガイド。コードに依存しない人間向け説明 → `docs/guide/`

### 2. project rule vs plugin rule

**project rule**（`.shirokuma/rules/{project}/`）: 当該プロジェクト固有の実装詳細（コマンドの内部挙動、スキーマ定義等）。他プロジェクトでは意味を持たない。

**plugin rule**（`plugin/shirokuma-skills-{en,ja}/rules/`）: 汎用的なプラクティス（コミットスタイル、ADR の書き方等）。他プロジェクトの `init` で展開して使える。

**判定基準**: 「他のプロジェクトでも使えるか？」→ YES なら plugin rule、NO なら project rule。

### 3. skill spec（`plugin/specs/`）vs SKILL.md

**SKILL.md**: AI がスキル実行時に読む「作業手順書」。500 行以内厳守。

**plugin/specs/skills/{name}/DESIGN.md**: スキルの設計背景・代替案の検討記録・評価基準。実行時には不要。人間がスキルを改善するときに参照する。

**判定基準**: 「AI がこのスキルを実行するために必要か？」→ YES なら SKILL.md、NO なら plugin/specs/

### 4. ADR（GitHub Discussion）vs reference doc

**ADR**: 「なぜ X を選んだか」という意思決定の理由と経緯。Discussion として永続保存。変更する場合は新 ADR で supersede する。

**reference doc**: 「X の使い方・設定方法」という実装知識。コードと同期して更新される。

**判定基準**: 「過去の意思決定の理由を残すものか？」→ YES なら ADR。

### 5. 一時的な計画（Issue 本文）vs reference doc

**Issue 本文**: スプリントの計画・作業の手順・一時的な TODO リスト。Issue が閉じたら消える。

**reference doc**: 繰り返し参照される手順・規約・制約事項。Issue が閉じた後も有効。

**判定基準**: 「このタスクが完了した後も参照価値があるか？」→ YES なら reference doc に切り出す。

### 6. 開発環境固有ルール（プラグイン対象外）

**例**: ビルド手順、dev/release の切り替えスクリプト、ローカル環境セットアップ手順。

**配置先**: リポジトリ固有の開発環境知識は本汎用ルールの対象外。各プロジェクトの**プロジェクト固有規約**（例: shirokuma-docs では `.claude/rules/`、`.shirokuma/rules/{project}/docs-layout.md` でディレクトリ規約を定義）で扱う。

**判定基準**: 「他プロジェクトでも価値があるか？」→ NO ならプロジェクト固有規約。汎用ルール（本ファイル）は他プロジェクトでも価値がある判定基準のみを扱う。

## 新規ファイル作成チェックリスト

- [ ] 上記判定フローで配置先を決定した
- [ ] `plugin/` 配下のルール追加 → `rules-index.md` も更新した
- [ ] `.shirokuma/rules/{project}/` 追加 → CLAUDE.md のルールテーブルに追記した（必要な場合）
- [ ] ADR として記録する場合 → `write-adr` スキルを使用した
- [ ] SKILL.md が 500 行を超えそう → 設計メモは `plugin/specs/` に移動した
- [ ] plugin ルール → EN/JA 両方に同内容（対訳）を作成した

## 関連ルール

| ルール | 責務の分担 |
|-------|-----------|
| `skill-authoring.md` | スキル記述の命名・言語ガイドライン（汎用） |

各プロジェクトでは `.shirokuma/rules/{project}/` 配下に補完的なルール（`rule-maintenance`、`spec-modification-policy`、`skill-authoring-quality` 等）を配置することがある。本ルールは「配置先決定」のみを担い、配置済みドキュメントの保守・品質規約はプロジェクト固有規約に委ねる。
