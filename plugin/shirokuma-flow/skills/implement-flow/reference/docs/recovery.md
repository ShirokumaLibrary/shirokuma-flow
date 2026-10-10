# 中断回復手順（implement-flow）

implement-flow の途中（実装 → 品質ゲート → コミット → PR）でセッション切断・worker 失敗などにより中断したとき、orchestrator がどこから安全に再開するかの手順。チェーン規律そのものの正本は rule `orchestration-discipline`——本ファイルは**中断点別の状態検出チェックリストと冪等性表**を提供する。

## 一般的な回復フロー

1. **事前登録した全ステップの一覧を確認**: rule `orchestration-discipline` の C2 で事前登録したステップのうち、**最初の未完**がリカバリの入口（完了済みのステップは再実行しない）。**一覧をどこから引くかは C2 が選んだ手段で決まる**——タスク管理ツールで登録していればそこから引く。応答本文の手順表で登録していれば**直近の表を transcript から拾う**（一箇所から引けないので、拾えなかったときは一覧が無いものとして次の項以降の実状態確認だけで再開点を決める）。**一覧を拾えなかった回は、実状態から完了を確認できない段をすべて未完として扱い、再実行する**——「完了済みは再実行しない」は一覧がある前提の規律であって、一覧が無い回にそれを適用すると**検査が当たる量が黙って減る**。とくにレビュー段（3a / 3b / コードレビュー）の成果物は git / PR の実状態に現れないので、項 2〜4 では完了を復元できない。**不明な段は再実行側へ倒す。**
2. **Status を確認**: `shirokuma-flow status <n>`（Status / 許可遷移を取得）。**状態遷移（verb）は再実行しない**——既に `In progress` なら `begin` を打ち直さず、冪等確認のみ行う。
3. **実状態を確認**: 下表の中断点別チェックリストで git / PR の実状態を特定する。
4. **失敗した worker のみ再委任**: orchestrator が同じブリーフ（計画コンテキスト）で該当 worker に再委任する。ステップを飛ばさない——各 worker の出力は次の worker が使う。

回復が繰り返し失敗する場合は、現在の状態を人に報告して停止する（自走で押し切らない）。

## 実装サブを In progress から再開する

`next <サブ>` が `working` / `sub_started` を返した回の入口（SKILL.md routing ②）。以下の `<n>` はそのサブの番号。

1. `begin` は打たない。作業ブランチは `shirokuma-flow branch name <n>` で導出し、既に在ればそれへ切り替える。
2. 上の「一般的な回復フロー」2〜4 と下のチェックリストで再開点を決め、段の順序（段 3 以降）の未完の段から続ける。
3. **PR を伴わないサブ**（SKILL.md「PR を伴わないサブの終端」）は、成果物（GitHub 上のアイテム）が在るかを確かめる。
   - 在る → 同節の手順で終端する（epic 期は統合 PR を先に立ててから `done <n>`）。
   - 無い → 成果物の作成から再開する。
   - 作成済みかを判定できない → `done` しない。止まって報告する。

## 中断点別の状態検出チェックリスト

### coding-worker が失敗した場合

| 確認項目 | コマンド |
|---------|---------|
| コミットされていない変更があるか | `git status` |
| 途中まで実装されているか | `git diff` で変更ファイルを確認 |
| テストが失敗しているか | `pnpm test` 等プロジェクトのテストコマンド |

**冪等性**: あり——再委任は安全。既存の変更は worker が必要に応じて上書きまたは継続する。

**リカバリ操作**: orchestrator が `coding-worker` に同じ計画ブリーフで再委任する。再委任前に `shirokuma-flow status <n>` で Status を確認し、**状態遷移は再実行しない**（verb は orchestrator の責務・冪等確認のみ）。

### finalize-worker（品質ゲート）が失敗した場合

| 確認項目 | コマンド |
|---------|---------|
| 改善コミットが作られたか | `git log --oneline -3` |
| lint が通るか | `shirokuma-flow lint areas all`（security 含む area 系・finalize ゲートと同系統） |

**exit code の読み方**: `lint areas`（`all` 含む）は `0`=pass・`1`=error 検出・`2`=skip のみで fail（監査できなかった）を返す。**`2` は監査できなかったことを表す**——0 以外を一律 failure として扱う確認手順は、これも失敗として扱う。「lint が通るか」を exit code だけで判定する場合、`2` は「違反があった」ではなく「監査できなかった」を意味するので、再委任前に原因を先に確かめる: JSON 出力（`--format json`）の各領域が持つ `skipReasonId`（`audit-unavailable` / `audit-output-truncated` / `audit-error` / `audit-unparseable` / `audit-incomplete` のいずれか）を見る（ネットワーク・lockfile の有無は原因の一部にすぎない——`skipReasonId` の値ごとに原因が異なる）。

**冪等性**: あり——/simplify・セキュリティ・docs lint の再実行は無害。

**リカバリ操作**: `finalize-worker` に再委任する。

### commit-worker が失敗した場合

| 確認項目 | コマンド |
|---------|---------|
| ステージ済みだがコミットされていない変更があるか | `git status` |
| 途中のコミットが作成されたか | `git log --oneline -3` |
| ブランチがプッシュされているか | `git log --oneline origin/{branch}..HEAD` |

**冪等性**: あり——`commit-worker` は git status を確認して差分なしを検出するため、再委任しても重複コミットしない。

**リカバリ操作**: `commit-worker` に再委任する。

### pr-worker が失敗した場合

| 確認項目 | コマンド |
|---------|---------|
| PR がすでに作成されているか | `shirokuma-flow pr list --head {branch}` |
| コミットがリモートにプッシュされているか | `git log --oneline origin/{branch}..HEAD` |

**冪等性**: 条件付き——PR が既に存在する場合、`pr-worker` は検出してスキップする。存在しない場合は新規作成する。

**リカバリ操作**: `pr-worker` に再委任する。

### レビュー以降で中断した場合

PR 作成後（PR は `Backlog`）の中断は implement-flow の回復対象外——次は `review-flow` を起動するだけでよい（`review-worker` の再委任は review-flow の手順 1 と同じ・レポート再生成は冪等）。

## 冪等性保証（再開時の安全表）

新しい会話で同じ Issue の implement-flow を再実行した場合の動作:

| 状態 | 動作 |
|------|------|
| ブランチが既に存在する | `git checkout {branch}` で既存ブランチに切り替え（再作成しない） |
| Status が既に In progress | `begin` を再実行しない（`status <n>` で確認のみ） |
| コミット済み・プッシュ済み | `commit-worker` が差分なしを検出しスキップ |
| PR が既に存在する | `pr-worker` が既存 PR を検出しスキップ |
| 品質ゲート適用済み | finalize の再実行は無害（冪等） |
