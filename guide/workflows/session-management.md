# セッション管理

作業セッションの開始・進行・終了を AI に指示する方法。

## このページでわかること

- 旧 `session start/end/check` 体系から **dashboard / preflight / integrity** + **checkpoint コマンド** への移行
- セッションを使うべき場面の判断基準
- Issue バウンドセッションの開始と進行
- コンテキスト保存の仕組み（Issue コメントと作業サマリー）
- Issue ステータスの整合性チェック

## コマンド体系の概要

shirokuma-flow にはかつて `session start/end/check/preflight` が 1 コマンドに同居していたが、現在は責務ごとに分離されている。

| やりたいこと | 旧コマンド | 現コマンド |
|------------|-----------|-----------|
| プロジェクトの状態を俯瞰する | `session start` | `shirokuma-flow dashboard` |
| チームの状態を俯瞰する | `session start --team` | `shirokuma-flow dashboard --team` |
| セッション終了前のデータを集める | `session preflight` | `shirokuma-flow preflight` |
| Issue 状態と Project Status の整合性を確認 | `session check` | `shirokuma-flow integrity` |
| 不整合を自動修正 | `session check --fix` | `shirokuma-flow integrity --fix` |
| GitHub 手動設定の検証 | `session check --setup` | `shirokuma-flow integrity --setup` |
| 作業開始（status: In progress + assign） | `session end` の手動ステータス変更 | `shirokuma-flow begin <N>` |
| レビュー提出（status: Review） | `session end --review <N>` | `shirokuma-flow submit <N> [--comment FILE]` |
| ブロック宣言 | （手動） | `shirokuma-flow block <N> --reason <text>` |
| ブロック解除 | （手動） | `shirokuma-flow resume <N>` |
| Review → Done | `session end --done <N>` | `shirokuma-flow status approve <N>` |

`begin/submit/block/resume` は **checkpoint コマンド** と呼ばれ、`status transition` + `issue assign` + `issue comment` を 1 コマンドにまとめる。

> `implement-flow` チェーンが完了すると、内部で `submit` 相当の遷移が自動実行されるため、通常はユーザーが checkpoint を直接打つ必要はない。手動運用や PR 不要の単発タスクのときに使う。

## セッション使用基準

「セッション」は、`/starting-session` で会話を初期化し、Issue 本文（計画）と Issue コメント（作業サマリー）にコンテキストを残しながら作業を進める運用パターンを指す。

| セッションを使う | スタンドアロンで十分 |
|-----------------|-------------------|
| 修正対象ファイルが多い（10+） | 1 会話で完結する |
| エピック（親 Issue + サブ Issue） | 局所的な変更（1-3 ファイル） |
| 複数日にわたる作業（M/L サイズ） | 独立した単発タスク |
| 調査 → 実装の 2 フェーズ作業 | ドキュメント、設定変更 |

## よくある指示パターン

### 特定の Issue で作業する（Issue バウンドセッション）

**指示例:** `セッション開始、#42 に取り組みたい`

**結果:** `starting-session` がルールをロードした後、`/implement-flow #42` にルーティングされる。

```
/starting-session #42
```

`implement-flow` が前回の作業サマリー（Issue コメント）を参照しながら作業を継続する。

### トリアージ・一般セッション（アンバウンド）

**指示例:** `セッション開始` または `作業を始めるよ`

**結果:** デフォルトルールがロードされる（出力は無し）。続けて状態を確認したい場合は `/show-dashboard` を呼ぶ:

- アクティブな Issue 一覧（Status, Priority, Size 付き）
- オープンな PR 一覧
- Git の現在の状態

```
/starting-session
/show-dashboard
```

表示された Issue から作業対象を選び、`#42 に取り組んで` で `/implement-flow #42` に遷移する。

### CLI で状態だけ俯瞰する

スキルを起動せずに状態だけ見たい場合:

```bash
shirokuma-flow dashboard            # 自分担当の Issue + PR + git
shirokuma-flow dashboard --team     # 担当者別ダッシュボード
```

### 作業開始を明示する（checkpoint）

`/implement-flow` が内部で実施するため通常は不要だが、CLI から直接作業を始める場合:

```bash
shirokuma-flow begin 42             # Status: In progress に遷移 + 自己アサイン
```

### レビュー提出を明示する（checkpoint）

PR を作成済みでレビュー待ちにする場合:

```bash
shirokuma-flow submit 42                                # Status: Review
shirokuma-flow submit 42 --comment summary.md           # コメント投稿後に遷移
shirokuma-flow submit 42 --via "In progress"            # 中間ステータスを経由
```

`implement-flow` チェーンが完了すれば自動的に Review に遷移するため、手動 `submit` は CLI から運用するときの最終操作として使う。

### ブロック宣言・解除（checkpoint）

```bash
shirokuma-flow block 42 --reason "API 仕様確定待ち"     # Blocked + 理由をコメント化
shirokuma-flow resume 42                                # In progress に戻す
shirokuma-flow resume 42 --comment unblock-note.md      # コメント付き
```

### PR 不要で完了した場合

PR を作らずに直接完了する場合は、Review を経ずに Done にする:

```bash
shirokuma-flow status transition 42 --to "Done"
```

または、Review 済みの Issue を承認する場合:

```bash
shirokuma-flow status approve 42                        # Review → Done（Issue は Close しない）
```

### セッション終了前のデータ収集

セッションを区切る前に必要なデータを 1 コマンドで取得する:

```bash
shirokuma-flow preflight
```

### 整合性をチェックする

**指示例:** `Issue の状態をチェックして`

```bash
shirokuma-flow integrity                # 不整合を表示
shirokuma-flow integrity --fix          # 不整合を自動修正
shirokuma-flow integrity --setup        # GitHub 手動設定（Issue Types / Discussion カテゴリ）の検証
```

## 指示のコツ

- **作業対象を伝えればチェーンが自動起動する**: 「セッション開始して、#42 に取り組みたい」と伝えると、starting-session → implement-flow が自動的にチェーンする
- **ステータス更新は基本自動**: `implement-flow` チェーン完了時に Status は Review に更新される。手動 `submit` / `status approve` は CLI 運用時のみ必要

## 典型的な 1 日の流れ

```
/starting-session #42            会話初期化 → ルールロード + implement-flow #42 ルーティング
  └→ /implement-flow #42         自動ルーティング
       ├→ 計画策定（未計画なら prepare-flow）
       ├→ 実装（code-issue）
       ├→ コミット・プッシュ（commit-issue）
       ├→ PR 作成（open-pr-issue）
       ├→ 作業サマリーを Issue コメントに投稿
       └→ submit checkpoint で Status を Review に更新
```

## コンテキスト保存の仕組み

### 開発ライフサイクル

各フェーズは通常、別の Claude Code 会話で実行される。会話間のコンテキスト引き継ぎは Issue 本文（計画）と Issue コメント（作業サマリー）が担う。

```
会話 1: Issue 作成（/issue-flow）
    ↓
会話 2: 計画策定（/prepare-flow #N）
    ↓
会話 3: 実装（小規模: /implement-flow #N、大規模: /starting-session #N → implement-flow）
    ↓
会話 4: 実装の続き（大規模のみ、/starting-session #N → implement-flow #N）
    ↓
PR → Review → Done
```

### Issue コメントが一次記録

コンテキストの保存先は Issue コメント:

| スキル | 投稿内容 | 焦点 |
|--------|---------|------|
| `implement-flow` | 作業サマリー | 技術詳細: 変更内容、変更ファイル、PR、技術的判断 |

`starting-session #N` → `implement-flow #N` の起動時にこれらの Issue コメントが参照される。

> セッション間のコンテキスト引き継ぎは Issue 一元化方針（`In progress` Issue 本文 + コメント）で完結する。複数 Issue にまたがる長期作業は親 Issue 本文と各サブ Issue の関係でモデル化する。

## 関連

- [Issue 管理](issue-management.md) — Issue の作成・管理
- [実装ワークフロー](implementation.md) — 実装の自動フロー
- [CLI クイックリファレンス](../reference/cli-quick-reference.md) — `dashboard`, `preflight`, `integrity`, `begin`, `submit`, `block`, `resume`, `status` の詳細
