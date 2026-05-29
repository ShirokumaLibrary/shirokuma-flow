---
scope: default
category: github
priority: required
---

# プロジェクトアイテムルール

## 必須フィールド

| フィールド | 必須 | オプション |
|-----------|------|-----------|
| Status | はい | 下記ワークフロー参照 |
| Priority | はい | Critical / High / Medium / Low |
| Size | 推奨 | XS / S / M / L / XL |
| Type | はい | Organization Issue Types で管理（手動セットアップ） |

## ステータスワークフロー（5 値モデル、ADR-v3-018）

```mermaid
stateDiagram-v2
    [*] --> InProgress: 新規作成（issue add / plan-issue / pr create）
    InProgress --> Review: submit（AI 自己レビュー完了）
    Review --> ToDo: approve（承認、着手待ち）
    ToDo --> InProgress: begin（着手）
    InProgress --> Blocked: block（理由必須）
    Review --> Blocked: block（理由必須）
    Blocked --> InProgress: resume
    Review --> InProgress: reject（理由必須）
    InProgress --> Done: pr merge（課題・計画 Issue）
    Review --> Done: pr merge（PR）
    ToDo --> Done: cancel（not_planned）
    InProgress --> Done: cancel
    Blocked --> Done: cancel
```

| ステータス | 説明 |
|-----------|------|
| ToDo | 未着手 / 承認済み着手待ち。旧称「Backlog」。新規バックログと `approve` 後の着手待ちを同一値で表現する |
| In progress | 作業中（計画策定・設計・実装すべて含む）。Issue / 計画 Issue / PR 作成直後の初期値 |
| Blocked | 外部依存待ち・確認待ち等でブロック中。`block --reason` で遷移し、理由がコメントに記録される |
| Review | AI 作業完了・人間レビュー可能（計画承認ゲートまたはコードレビュー待ち） |
| Done | 完了・クローズ済み（キャンセルも `state_reason: not_planned` で Done に統一） |

> 旧 Status（`Backlog` / `Approved` / `Completed` / `Pending` / `Ready` / `On Hold` / `Cancelled` 等）は ADR-v3-018 で廃止。LEGACY 値は `LEGACY_STATUS_VALUES` で透過読み取りされる。

### status approve と ToDo への遷移（ADR-v3-018）

`approve {number}` は Review 状態の Issue を承認する checkpoint コマンド（ADR-v3-018）。

- **全 Issue Type 共通**: Review → **ToDo**（承認済み、着手待ち）
- **Review 以外では失敗**: `result: "error"` で exit 1
- **JSON 出力**: `{ "result": "ok" | "error", "to": "ToDo", "next_suggestions": [...] }`

**承認モデル（ADR-v3-018）**: `approve` は Issue Type を問わず Review → ToDo に遷移する。「承認済みで待機」を独立した Approved ステータスで表現せず、ToDo（着手予定リスト）で表現することで Status 値を 5 値に圧縮する。

### PR のステータスワークフロー

PR は Issue と同じ Status フィールドを使用し、Issue ワークフローのサブセットで運用する。レビュー状態の詳細は GitHub PR ネイティブの `review_decision`（APPROVED / CHANGES_REQUESTED / REVIEW_REQUIRED）で管理する。

| Status | 説明 | 遷移トリガー |
|--------|------|-------------|
| Backlog | PR 作成直後（AI レビュー待ち、#2802） | `pr create` が PR を Projects に追加時に自動設定 |
| Review | コードレビュー完了（AI レビュー PASS） | `review-flow` の AI レビュー PASS 後に `status transition {PR#} --to Review`（Backlog → Review）で遷移 |
| Done | マージ後 | `pr merge` で自動設定 |

**PR は ToDo を経由しない**: PR の approve はマージ承認を意味し、`pr merge` で Review → Done に直行する。

> `integrity` は PR ステータスの不整合を検出する（OPEN PR が Done、MERGED/CLOSED PR がアクティブステータス）。

### 2 階層ステータスモデル（エピック / サブ Issue）

エピック Issue のステータスはサブ Issue の状態から**自動導出**される。手動更新は原則不要。

| サブ Issue の状態 | 親 Issue への影響 |
|----------------|----------------|
| 全サブ Issue が Done | 親を Done に自動遷移 |
| 一部が In progress / Review | 親を In progress に維持 |
| 一部が Done + 残りが ToDo | 親を In progress に維持（進行中とみなす） |
| 全サブ Issue が Done + cancel | 親を Done に自動遷移 |

**親 Close 時の連動 Close**: 親 Issue が Close されると、OPEN 状態の子 Issue は `syncChildCloseOnParentClose` により自動的に Done + Close される。

**リアクティブ自動導出**: CLI が `status transition`、`issue close`（`issue cancel` 含む）、`status update-batch`、`pr merge` 実行時にサブ Issue のステータス変更を検出し、親のステータスを自動的に導出・更新する。

### 計画リセットフロー

エピックの計画を白紙に戻す場合（サブ Issue が作成済みの場合）:

1. 全サブ Issue を `issue cancel {sub-numbers}` で Done（not_planned）に変更
2. `prepare-flow` で再計画

### アイデア → Issue フロー

アイデアや提案は **Discussions**（Research または Knowledge カテゴリ）から始める。Issue ではない。

| 段階 | 場所 | 移行条件 |
|------|------|---------|
| アイデア / 探索 | Discussion | アイデアが最初に挙がったとき |
| 実装決定 | Issue (ToDo) | チームが実装に合意したとき |
| 要件確定 | Issue (Review) | 要件の正式レビューが必要なとき |

## サイズ見積もり

| サイズ | 目安時間 | 例 |
|--------|---------|-----|
| XS | ~1時間 | タイポ修正、設定変更 |
| S | ~4時間 | 小規模機能、バグ修正 |
| M | ~1日 | 中規模機能 |
| L | ~3日 | 大規模機能 |
| XL | 3日以上 | エピック（分割すべき） |

## 本文テンプレート

```markdown
## 目的
{誰}が{何}できるようにする。{なぜ}。

## 概要
{内容}

## 背景
{現状の問題、関連する制約や依存関係}

## 検討事項
- {計画策定時に考慮すべき視点・制約}

## 成果物
{"完了" の定義}
```

> 種別ごとの詳細テンプレート（bug の再現手順、research の調査項目等）は `create-item` リファレンスを参照。

## ステータス更新トリガー

AI は以下のタイミングで Issue ステータスを更新する必要がある:

| トリガー | アクション | 責任者 | コマンド |
|---------|----------|--------|---------|
| 計画策定開始 | → In progress + アサイン | `prepare-flow` | `begin {n}` |
| 計画策定完了 | → Review | `prepare-flow` | `submit {n}` |
| 設計開始 | → In progress + アサイン | `design-flow` | `begin {n}` |
| 設計完了 | → Review | `design-flow` | `submit {n}` |
| ユーザーが Issue を承認 | Review → **ToDo**（Issue Type 共通） | `approve` スキル / 手動 | `approve {n}` |
| ユーザーが着手指示 | ToDo → In progress + アサイン + ブランチ | `implement-flow` | `begin {n}` |
| implement-flow 全工程完了 | → Review | `implement-flow` | `submit {n}`（PR 作成・simplify・security-review・lint docs・作業サマリー後） |
| review-flow 開始時 | → In progress + アサイン | `review-flow` | `begin {n}` |
| review-flow レビュー対応完了後 | → Review | `review-flow` | `submit {n}` |
| マージ | → Done | `commit-issue` (via `pr merge`) | 自動更新 |
| ブロック | → Blocked | 手動 | `block {n} --reason "理由"` (reason は自動コメント化) |
| ブロック解除 | → In progress | 手動 | `resume {n}` または `resume {n} --comment FILE` |
| 完了（PR不要） | → Done | 手動 | `status update-batch --done {n}` |
| キャンセル | → Done（not_planned） | `issue cancel` | `cancel {n}` |

> **GitHub Projects 組み込み自動化**: `Pull request linked to issue` ワークフローを有効化すると、PR が Issue にリンクされた時点で Issue と PR が自動的に Project に追加される。また PR の日時フィールド（Start at / Review at / End at）は `integrity` が自動で設定する。ワークフロー有効化手順は `github-commands.md` の「GitHub Projects ワークフロー設定」セクションを参照。

### In Progress の運用（計画・設計・実装すべてを含む）

- **目的**: アクティブな作業中であることの可視化（計画策定・設計・実装を問わず）
- **入口**: `prepare-flow` が計画開始時、`design-flow` が設計開始時、または `implement-flow` が実装開始時に設定
- **出口**: 作業完了後 → Review

### Review の運用（AI 作業完了・ユーザーレビュー可能）

Review は「AI の作業が完了し、ユーザー（人間）がレビュー可能な状態」を意味する。**正本ドキュメント [`docs/guide/workflows/lifecycle-overview.md`](../../../../../docs/guide/workflows/lifecycle-overview.md) L325-330** の決定に従い、エンティティ（課題 Issue / 計画 Issue / PR）のライフサイクル中で **Review は 1 度のみ** 経由する。

#### **DO NOT**: Review に遷移してはならないケース

**以下のいずれかに該当する場合、`submit` を呼んではならない:**

- 課題 Issue / 計画 Issue が既に一度 Review を経由している（再遷移は禁止 — 1 エンティティ 1 Review 原則）
- 直近の作業がレビュー指摘の修正対応であり、追加の指摘が想定される（中間サイクル）
- ユーザーに質問・確認したいだけの中間チェックポイント
- 部分完了（PR 作成のみ・テスト未実施・simplify 未実行・lint docs 未実行など）
- 「自己レビュー」「自分でチェック」など AI 自身の確認作業を Review と表現したくなった場合（→ 正しくは `In progress` のまま）
- レビュー対応を `review-flow` で実施中（コードレビュー対応は In progress のまま PR スレッドで完結する）

> LLM の学習データにある「Review = 自己レビュー中・中間チェックポイント」の広義に引きずられないこと。本プロジェクトでは Review = **「人間が判断する番が来た」専用** の意味で運用する。

#### Review に入る経路（各 Issue Type で 1 度のみ）

| エンティティ | Review に入るタイミング | Review からの遷移 |
|---|---|---|
| 課題 Issue | 作成時の AI 自己レビュー（`analyze-issue`）完了後（**作成時のみ**） | `approve` → ToDo（着手待ち） |
| 計画 Issue | `prepare-flow` の計画策定 + AI 自己レビュー完了後（**作成時のみ**） | `approve` → ToDo（実装着手待ち） |
| 設計 Discussion | `design-flow` の設計策定 + AI 自己レビュー完了後（**作成時のみ**） | `approve` → ToDo（設計承認） |
| PR | `pr create` で Backlog 作成 → `review-flow` の AI レビュー PASS で Review（Backlog → Review、#2802） | `pr merge` → Done |

#### 実装フェーズの課題 Issue / 計画 Issue は Review に再遷移しない

ADR-v3-017 / `lifecycle-overview.md` L327 の決定により、実装フェーズで PR が動く間、課題 Issue・計画 Issue は **In progress のまま触らない**。コードレビューは **PR 自身が Status: Review を担う**。

そのため `implement-flow` / `review-flow` のチェーン末尾で課題 Issue / 計画 Issue を `submit` してはならない。PR 自身は `pr create` で Backlog で作成され、`review-flow` の AI レビュー PASS 後に `Backlog → Review` に遷移する（#2802）。

### ルール

1. **同時に In progress は1つ** — 新しい作業を始める前に前のアイテムを移動する（例外: バッチモード、エピック）
2. **Issue ごとにブランチ** — 作業開始時にフィーチャーブランチを作成（例外: バッチ・エピック）
3. **イベント駆動**: Status 変更はイベント発生時に即座に実行する
4. **block は理由必須** — ブロッカーを説明するコメントを追加
5. **冪等性**: 既に正しい Status なら更新をスキップ（エラーにしない）

### CLI と GitHub Projects Workflows の責務分担

GitHub Projects には組み込みの Workflows（`Item closed` → Status を Done に設定等）があり、CLI の `issue close` も Status を Done に設定する。これにより同じ Status 更新が二重に実行される場合がある。

| 操作 | CLI の責務 | Workflows の責務 | 二重実行 |
|------|-----------|-----------------|---------|
| Issue クローズ | `issue close` が Status → Done | `Item closed` が Status → Done | あり（冪等） |
| PR マージ | `pr merge` が Status → Done | `Pull request merged` が Status → Done | あり（冪等） |
| Issue リオープン | `issue reopen` が Status 復元 | `Item reopened` が Status → ToDo | 競合の可能性あり |

**原則:**
- CLI が**権威ある Status 更新**を行う（タイムスタンプ更新・親 Issue 導出を含む）
- Workflows は**バックストップ**として機能する（CLI を経由しない手動操作をカバー）
- 二重実行は冪等性により実害なし
- リオープン時のみ CLI の Status 復元と Workflows の ToDo 設定が競合し得るが、CLI 実行後に Workflows が上書きする可能性がある。競合した場合は `shirokuma-flow status update-batch {number} --status {正しいステータス}` で修正する

## Issue 作成時の初期ステータス

`issue add` コマンドで Issue を作成する際、初期 Status は **In progress**（作業開始直後の状態）がデフォルト。

**計画 Issue の作成手順:**

```bash
# 1. In progress で作成（初期値）
shirokuma-flow issue add /tmp/shirokuma-flow/{n}-plan-issue.md
# 2. submit で In progress → Review に遷移
shirokuma-flow submit {PLAN_ISSUE_NUMBER}
```

## 計画 Issue 方式

計画は親 Issue の子 Issue（タイトルが「計画:」または「Plan:」で始まる Issue）として作成される。これにより計画が独立した Issue として管理され、GitHub Projects 上でフェーズ進捗を可視化できる。

### 計画 Issue の構造

- **タイトル**: `計画: {親 Issue のタイトル}`
- **ステータス**: `In progress`（作成直後）→ `Review`（計画レビュー完了後）
- **ラベル**: `area:plan`
- **本文**: 計画の全内容（アプローチ・変更ファイル・タスク分解・リスク等）

### 計画 Issue のステータス遷移

計画 Issue は実作業の進捗には関与せず、計画自体のライフサイクルを表す。

| Status | 説明 | 遷移トリガー |
|--------|------|-------------|
| In progress | 計画策定中（作成直後） | `prepare-flow` が計画 Issue を作成時 |
| Review | 計画策定完了、レビュー待ち | `prepare-flow` が計画レビュー通過後に `submit N` |
| ToDo | 計画承認済み・実装着手待ち | `approve {plan-number}`（Review → ToDo） |
| In progress | 実装着手中 | `implement-flow` が `begin {plan-number}` |
| Done | PR マージで完了 | `pr merge` が `Closes #N` を解析して自動遷移 |

**`integrity` の集計除外**: 親 Issue のステータス自動導出時、`area:plan` ラベルの計画 Issue はサブ Issue ステータス集計から除外する。これにより、計画 Issue が Review のまま残っていても親の In progress 導出に影響しない。

### 計画 Issue 中心ステータスモデル（ADR-v3-017）

**基本原則**: ステータス遷移の主体は「計画 Issue」であり、課題 Issue（親 Issue）のステータスは `syncParentStatus` が子 Issue のステータスから自動導出する。AI セッション・CLI コマンドは**計画 Issue を対象**として操作すること。

#### ライフサイクルと対象 Issue

| フェーズ | 対象 Issue | ステータス | トリガー |
|---------|-----------|-----------|---------|
| 計画策定中 | 計画 Issue | In progress | `prepare-flow` が `begin {plan-number}` を実行 |
| 計画レビュー待ち | 計画 Issue | Review | `prepare-flow` が `submit {plan-number}` を実行 |
| 計画承認済み | 計画 Issue | ToDo | `approve {plan-number}` |
| 実装中 | 計画 Issue | In progress | `implement-flow` が `begin {plan-number}` を実行 |
| PR レビュー待ち | 計画 Issue | In progress のまま（PR は Backlog→Review を担う、#2802） | `pr create`（PR は Backlog、review-flow の AI レビュー PASS で Review） |
| 実装完了 | 計画 Issue | Done | `pr merge` が `Closes #N` を解析して自動遷移 |
| 課題クローズ | 計画 Issue | Done + Closed | 親 Issue Close 時に `syncChildCloseOnParentClose` で連動 Close |

**課題 Issue（親 Issue）のステータスは自動導出される**: 計画 Issue の Done 遷移後、`syncParentStatus` が子 Issue 群のステータスを集計して親の期待ステータスを導出・更新する。計画 Issue 単独サブ（課題 Issue の子が計画 Issue のみ）の場合は、`pr merge` 側でフォールバックとして親を直接 Done に遷移する。

#### `pr create` / `pr merge` の計画 Issue リダイレクト

| コマンド | リンク Issue に計画 Issue が存在する場合 | 計画 Issue がない場合（XS/S 直接パス） |
|---------|---------------------------------------|--------------------------------------|
| `pr create` | 計画 Issue を Review に遷移（`Closes #N` の N の計画 Issue を特定） | リンク Issue を直接 Review に遷移（従来通り） |
| `pr merge` | 計画 Issue を Done に遷移（親は `syncParentStatus` で自動導出） | リンク Issue を直接 Done に遷移（従来通り） |

#### `integrity` の不整合検出パターン（ADR-v3-017）

| パターン | Severity | 状況 | `--fix` のアクション |
|---------|---------|------|-------------------|
| P1 | error | 計画 Issue が ToDo なのに親が In progress/Review | 計画 Issue を In progress に遷移 |
| P2a | warning | 計画 Issue が In progress なのに親が Review | `syncParentStatus` で親を再導出 |
| P3 | error | 計画 Issue が OPEN のまま親が Done/CLOSED | 計画 Issue を Done + Close |

### 計画 Issue の参照

`subIssuesSummary` からタイトルが「計画:」で始まる子 Issue を特定し、`issue context {plan-issue-number}` で本文を取得する。

```bash
shirokuma-flow issue context {parent-number}
# → subIssuesSummary からタイトルが「計画:」で始まる子 Issue を特定
shirokuma-flow issue context {plan-issue-number}
# → .shirokuma/github/{org}/{repo}/issues/{plan-issue-number}/body.md を Read ツールで読み込む
```

> **後方互換**: 計画 Issue が存在せず Issue 本文に `## 計画` セクションがある場合（旧方式）は、フォールバックとして使用する。

## 計画と実装の乖離時の Issue 本文更新

Issue 本文はレビュワーにとっての一次情報源である。実装が計画から逸脱した場合、Issue 本文を実態に合わせて更新する。

### 更新が必要なケース

| 判定基準 | 更新が必要 | 更新不要 |
|---------|----------|---------|
| ファイル構成 | 計画にないファイルを追加/削除した | 計画通りのファイルを変更した |
| アプローチ | 計画と異なる実装方針を採用した | 計画通りの方針で実装した |
| スコープ | タスクを追加/削除/分割した | 計画通りのタスクを完了した |

### 更新内容

1. **タスクチェックリスト**: `## 計画` の `### タスク分解` にある `- [ ]` を完了分について `- [x]` に更新する
2. **計画変更の注記**: 変更箇所に取り消し線と変更理由を追記する

```markdown
### アプローチ

~~フラットファイルに要約・統合する~~
→ サブディレクトリにコピーする（実装時に変更: 知識欠落リスクを回避するため）
```

### タイミング

チェーンの一部として自動化しない。以下のタイミングで AI が判断して実行する:

- 実装中に方針変更が確定した時点
- PR 作成後のセルフレビュー時
- レビュワーから指摘を受けた時点

コメントファースト原則に従い、乖離の理由をコメントとして記録してから本文を更新する。コメントは判断根拠・検討した代替案など「なぜそうしたか」を含む一次記録であること。

### コマンド

```bash
shirokuma-flow issue update {number} /tmp/shirokuma-flow/{number}-body.md
```

エピックのステータス管理・ビルトイン自動化・ラベル詳細・アイテム本文メンテナンス・アイテム作成ガイドラインの詳細は `managing-github-items` スキル実行時に自動ロードされる。

## Issue/PR/Discussion 確認時のコメント取得規約

### `issue context` vs サブコマンド直接呼び出しの使い分け

| コマンド | 返却内容 | 用途 |
|---------|---------|------|
| `shirokuma-flow issue context {number}` | 本文 + コメント全件（キャッシュ） | Issue/PR/Discussion の内容確認、レビュー、実装前調査 |
| `shirokuma-flow issue show {number}` | 本文のみ | フィールド値（Status/Priority 等）の確認のみ |
| `shirokuma-flow pr show {number}` | 本文のみ | PR メタデータ（ブランチ、変更数等）の確認のみ |
| `shirokuma-flow discussion show {number}` | 本文のみ | Discussion 本文の確認のみ |

### コメント全件読み込みを前提とするワークフロー

AI が Issue/PR/Discussion の内容を確認する場合は、**`shirokuma-flow issue context {number}` を使いコメントをキャッシュし、`.shirokuma/github/{org}/{repo}/issues/{number}/body.md` を Read ツールで読み込む**。これにより、以下の情報を把握できる:

- Issue: 本文 + 全コメント（計画詳細、議論の経緯、ブロッカー情報）
- PR: 本文 + レビューコメント + レビュースレッド + 通常コメント
- Discussion: 本文 + 全コメント + 返信（スレッド構造）

### コメントの書き方規約

| 目的 | コメントに含める内容 |
|------|-------------------|
| 計画の判断根拠 | 選定アプローチの理由・検討した代替案・調査で判明した制約（計画 Issue へのコメントとして投稿） |
| 実装中の方針変更 | 変更理由・検討した代替案・「なぜそうしたか」の一次記録 |
| ブロッカー通知 | ブロッカーの内容・影響範囲・解除条件 |
| レビュー指摘への返答 | 対応内容・変更箇所・残課題 |

コメントは「なぜ」を含む一次記録であること。単なる「何をした」の記録は避ける。

### 本文更新のトリガー

コメントで記録した内容が Issue/PR の最終状態と乖離する場合は本文を更新する。ただし**コメントファースト原則**を守り、先にコメントで記録してから本文を更新する。

| 更新が必要 | 更新不要 |
|-----------|---------|
| 計画と異なる実装方針を採用した | 計画通りの実装が完了した |
| スコープ（タスク・ファイル）が変更された | 細部の実装詳細のみ変更された |
| 成果物の定義が変わった | バグ修正・微調整レベルの変更 |
