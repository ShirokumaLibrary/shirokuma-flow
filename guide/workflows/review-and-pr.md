# レビューと PR

コードレビュー・PR 作成・レビューコメントへの対応を AI に依頼する方法。

## このページでわかること

- コードレビューを依頼する方法
- PR 作成の自動化
- レビューコメントへの対応を指示する方法
- submit checkpoint で Review ステータスに移行する流れ

## よくある指示パターン

### コードレビューを依頼する

**指示例:** `レビューして`

**結果:** `review-issue` スキルが起動し、以下の観点でレビューを実行する:
- コード品質（可読性、重複、エラーハンドリング）
- セキュリティ（XSS、SQL インジェクション、認証バイパス等）
- テストカバレッジ
- パフォーマンス

レビュー結果は PR にコメントとして投稿される。

```
/review-issue
```

### セキュリティ監査を依頼する

**指示例:** `セキュリティチェックして`

**結果:** セキュリティに特化したレビュー（`reviewing-security`）または依存パッケージの脆弱性監査（`auditing-security`）が実行される。OWASP Top 10 の観点でチェックし、脆弱性があれば報告する。

### PR を手動で作成する

通常は `implement-flow` チェーンで自動作成されるが、手動で作成することもできる。

**指示例:** `PR 作って`

**結果:** 現在のブランチから `develop` への PR を作成する。タイトル・本文が自動生成される。

```
/open-pr-issue
```

CLI から:

```bash
shirokuma-flow pr create 42                              # Issue 番号でターゲット・タイトル自動判定
shirokuma-flow pr create --base develop --title "..."
```

### レビュー提出（status: Review）を明示する

PR 作成済みでレビュー待ちにするには checkpoint を使う:

```bash
shirokuma-flow submit 42                                # Status: Review に遷移
shirokuma-flow submit 42 --comment summary.md           # コメント投稿後に遷移
```

`implement-flow` チェーンが完了すれば自動的に submit が走るため、CLI から直接呼ぶ必要があるのは手動運用時だけ。

### レビューコメントに対応する

**指示例:** `PR #15 のレビューコメントに対応して`

**結果:** Claude Code が以下を実行する:
1. PR のレビューコメントを全件取得（`pr comments 15`）
2. 未解決のコメントごとにコード修正または返信を実施（`pr reply 15 --reply-to <id> ...`）
3. 修正をコミット・プッシュ
4. コメントスレッドを解決（`pr resolve 15 --thread-id <id>`）

```
/review-flow #15
```

### Review → Done を承認する

Review 中の Issue を承認して Done に遷移する（Issue は Close しない）:

```bash
shirokuma-flow status approve 42
```

PR が merge されると、Projects の自動化により Issue がクローズされる（GitHub Projects のワークフロー設定による）。

### コミットだけ実行する

**指示例:** `コミットして` または `変更をプッシュして`

**結果:** 変更をステージ・コミット・プッシュする。コミットメッセージは Conventional Commits 形式で自動生成される。

```
/commit-issue
```

CLI から:

```bash
shirokuma-flow git commit-push --message "feat: ..."
```

## 指示のコツ

- **レビュー観点を指定する**: 「セキュリティ重視で」「テストの品質を見て」と伝えると、その観点が優先される
- **PR のコンテキストを伝える**: 「#42 の PR を作って」と Issue 番号を含めると、PR 本文に Issue へのリンクが自動追加される

## レビューの流れ

```
/review-flow #15
  ├→ pr comments 15            未解決スレッドの取得
  ├→ review-worker 経由        コードレビュー実行
  ├→ コード修正 + commit-push
  ├→ pr reply / pr resolve     スレッド対応
  └→ Status: Review に維持（または submit 経由で再投入）
```

## CLI チートシート

| やりたいこと | コマンド |
|------------|---------|
| PR 作成 | `shirokuma-flow pr create [42]` |
| PR 一覧 | `shirokuma-flow pr list` |
| PR 詳細 | `shirokuma-flow pr show 15` |
| レビュースレッド取得 | `shirokuma-flow pr comments 15` |
| スレッド返信 | `shirokuma-flow pr reply 15 --reply-to <id> ...` |
| スレッド解決 | `shirokuma-flow pr resolve 15 --thread-id <id>` |
| PR メタ更新 | `shirokuma-flow pr edit 15 --base develop --title "..."` |
| マージ | `shirokuma-flow pr merge 15`（hooks で人間の承認を必須化） |
| Review 提出 | `shirokuma-flow submit 42 [--comment FILE]` |
| Review → Done | `shirokuma-flow status approve 42` |

## 関連

- [実装ワークフロー](implementation.md) — 実装の自動フロー
- [セッション管理](session-management.md) — checkpoint コマンド
- [CLI クイックリファレンス](../reference/cli-quick-reference.md#pr--pull-request-管理) — `pr` コマンドの詳細
