# はじめての開発ワークフロー

このチュートリアルでは、shirokuma-flow のセットアップが完了した状態から、最初の Issue 作成・実装・PR マージまでを体験する。

所要時間: 約15〜30分

## 前提条件

- [Getting Started](../getting-started.md) の手順が完了している
- Claude Code がインストール済み
- GitHub リポジトリと GitHub Projects V2 がセットアップ済み

## 全体の流れ

```
1. セッションを開始する       /starting-session
2. Issue を作成する           /issue-flow
3. 計画を確認・承認する       （AI が計画を提示、ユーザーが承認）
4. 実装を待つ                 （自動フロー: begin → code → commit → PR → submit）
5. PR を確認してマージする    （GitHub 上で操作）
```

## ステップ 1: セッションを開始する

Claude Code のチャット画面を開き、次のように入力する:

```
セッション開始
```

または:

```
/starting-session
```

**AI の動作:** `starting-session` スキルが起動し、プロジェクトのデフォルトルールが読み込まれる（出力なし）。

続けてプロジェクト状態を確認する場合は `/show-dashboard` を呼ぶ:

```
/show-dashboard
```

- アクティブな Issue 一覧（Status: In Progress / Review など）
- オープンな PR 一覧
- Git の現在の状態

セッション間のコンテキストは `In progress` Issue 本文 + コメントに残るため、対象 Issue が分かっている場合は `/starting-session #N` で直接 `implement-flow` にルーティングする。

## ステップ 2: Issue を作成する

新しい機能や作業内容を Issue として登録する。自然な日本語で指示するだけで良い:

```
/issue-flow ユーザープロフィールページの作成
```

または:

```
新しい Issue を作りたい。ユーザーがプロフィールを編集できるページを実装したい
```

**AI の動作:** `issue-flow` スキルが起動し、以下を実行する:

1. Issue のタイプ・優先度・サイズを推定
2. GitHub に Issue を作成
3. GitHub Projects V2 にフィールドを設定
4. 自動的に `/implement-flow` に引き継ぐ

> 既存の Issue に取り組む場合は `#42 に取り組んで` と直接指定してもよい。

## ステップ 3: 計画を確認・承認する

AI が Issue の要件を分析し、実装計画を策定する。計画は Issue 本文に `## 計画` セクションとして書き込まれる。

**AI が示すもの（例）:**

```
## 計画

### タスク
- [ ] プロフィールページのルート作成 (app/profile/page.tsx)
- [ ] プロフィール編集フォームの実装
- [ ] バリデーション追加
- [ ] テスト作成

### 変更ファイル
- app/profile/page.tsx（新規）
- app/profile/edit/page.tsx（新規）
- src/actions/profile.ts（新規）

計画を承認して実装を開始しますか？
```

計画を確認し、問題なければ承認する:

```
承認、実装を開始して
```

修正が必要な場合は指示する:

```
バリデーションは後回しにして、まずページの骨格だけ作ってほしい
```

## ステップ 4: 実装を待つ（自動フロー）

承認後、AI が以下を自動的に順次実行する:

```
begin           checkpoint で Status: In progress + 自己アサイン + フィーチャーブランチ作成
  ↓
code-issue      TDD 実装（テストを先に書き、実装を追加）
  ↓
commit-issue    変更をコミット・プッシュ
  ↓
open-pr-issue   プルリクエストを作成
  ↓
作業サマリーを Issue コメントに投稿
  ↓
submit          checkpoint で Status: Review に更新
```

完了すると、PR 番号と作業内容のサマリーが表示される。

**待機中の注意:**
- 実装中に質問や確認が来ることがある。その場合は回答して作業を続けてもらう
- 実装が長引く場合（大規模な Issue）は会話を一旦終了し、次回 `/starting-session #N` で `implement-flow #N` にルーティングして再開する。コンテキストは `In progress` Issue 本文 + コメントから自動で参照される

## ステップ 5: PR を確認してマージする

AI が PR を作成したら、GitHub 上で内容を確認する。

### GitHub で PR を確認する

1. GitHub リポジトリを開く
2. Pull requests タブを確認
3. 作成された PR を開き、変更内容を確認する

### Claude Code でレビューを依頼する（任意）

```
/review-issue
```

**AI の動作:** コードの品質・セキュリティ・パターンの整合性をチェックし、フィードバックを返す。

レビューコメントが付いた後、その対応を自動化したい場合は:

```
/review-flow #5
```

### PR をマージする

GitHub の Pull request ページで「Merge pull request」ボタンをクリックしてマージする。

> AI に直接マージを指示しても、安全フック（`shirokuma-hooks`）によりブロックされる。PR マージは人間が GitHub UI から行う。

マージ後、Issue のステータスが自動的に Done に更新される（GitHub Projects の自動化が有効な場合）。

手動で Review → Done に進める場合:

```bash
shirokuma-flow status approve 42
```

## 次のセッションでコンテキストを復元する

次回 Claude Code を起動したとき、特定の Issue の続きから始める場合:

```
/starting-session #5
```

前回 `implement-flow` が Issue コメントに投稿した作業サマリーを参照しながら作業を再開できる。

## ステータスを手動更新する（必要な場合のみ）

PR 不要で作業が完了した場合など、手動でステータスを更新する。checkpoint コマンドを使う:

```bash
# レビュー提出（Status: Review）
shirokuma-flow submit 42

# Review 承認（Review → Done）
shirokuma-flow status approve 42

# 任意のステータスに遷移
shirokuma-flow status transition 42 --to "Done"
```

通常は `implement-flow` チェーンが自動的にステータスを更新するため、手動での実行は不要。

## よくある質問

### Q: 計画策定はいつも必要ですか？

XS/S サイズの明確な Issue は計画策定をスキップして直接実装に進む場合がある。`implement-flow` が Issue のサイズと要件を判断して自動的に選択する。

### Q: セッションとスタンドアロンの違いは？

| | セッション | スタンドアロン |
|--|---------|-------------|
| 開始 | `/starting-session` | 不要 |
| 使いどき | 複数 Issue、複数日の作業 | 単発タスク |
| コンテキスト | 自動保存（Issue コメント） | 自動保存（Issue コメント） |

簡単な修正や単一タスクならセッションなしで `#42 に取り組んで` と直接指示するだけでよい。

### Q: 実装が意図と違う場合は？

計画承認後でも、実装中に方針変更を指示できる:

```
フォームのデザインをもっとシンプルにして
バリデーションのロジックを src/lib/validation.ts に移動して
```

## 次のステップ

- より詳しいワークフローを知る → [ワークフロー概要](README.md)
- Issue 管理の詳細 → [Issue 管理](issue-management.md)
- セッション管理の詳細（checkpoint コマンド含む） → [セッション管理](session-management.md)
- スキルとルールの詳細 → [プラグイン管理](../plugins.md)
