# GitHub リポジトリ設定の期待値（正本）

flow のワークフローが前提にする **GitHub リポジトリ設定**の期待値。診断（SKILL.md 手順 1 の項目 ⑧）と人間作業 Issue（`../templates/setup-tasks.md` 節 F）は**このファイルの表を正本**として参照する。

**下の「期待値表」と同じ本文が `../templates/setup-tasks.md` 節 F にもインラインで置かれている**（人が読むのは Issue 本文なので、貼り忘れで表が落ちる経路を作らないため）。**両者の同一性を照らす検査は配布物の外にしか無く、導入先では走らない**。ON/OFF や必須/推奨は、この表の値で読む。

## 取得（read-only）

```
gh api repos/{owner}/{repo} --jq '{default_branch,allow_merge_commit,allow_squash_merge,allow_rebase_merge,delete_branch_on_merge}'
```

Discussions カテゴリ・Project collaborator と違い**機械判定できる**ので、診断では `unknown` にせず充足/不足を出す。これは GET（read）であり、設定の変更（write）は人が UI で行う。

## 期待値表

<!-- FROZEN-BEGIN: 期待値表（../templates/setup-tasks.md 節 F へ逐語コピー） -->

| API フィールド | UI ラベル（Settings → General → Pull Requests） | 期待値 | 必須/推奨 | 不充足で壊れるもの |
|---|---|---|---|---|
| `allow_merge_commit` | Allow merge commits | `true` | **必須** | `merge` verb が動かない（**未観測・仕様からの推論**）。flow の merge は `mergePullRequest` を `mergeMethod` 未指定で発行するため GitHub 既定の MERGE（merge commit）が使われる |
| `allow_squash_merge` | Allow squash merging | `false` | 推奨 | 統合ブランチの取り込みで mainline に別 SHA が載り、統合元が未マージ扱いのまま残る（次のリリース PR が毎回全履歴 diff になる） |
| `allow_rebase_merge` | Allow rebase merging | `false` | 推奨 | 同上（別 SHA が載る） |
| `delete_branch_on_merge` | Automatically delete head branches | `false` | 推奨 | mainline を head とする PR で GitHub 側が head を消しうる（flow 側の head 削除ガードは GitHub の自動削除を止められない） |
| `default_branch` | Settings → General → Default branch | config `project.defaultBranch` と一致 | 推奨 | GitHub が closing 参照を作らず（closing keyword の関連付けは default_branch 宛 PR にしか作られない）、PR 本文フォールバックに全依存する |

※ 表の UI ラベルは `default_branch` 行だけ別セクション（Settings → General → **Default branch**）。他の 4 行は **Pull Requests** セクションにある。

> ⚠️ **取り違え注意**: `Allow merge commits`（**必須**で ON）と `Allow rebase merging`（**推奨**で OFF）は UI 上で隣り合う。片方を OFF にするつもりで取り違えると **merge commit だけが無効**になり `merge` verb が止まる。**上の表を一行ずつ突き合わせて、3 つのチェックボックスの ON/OFF をすべて確認する**（「どれを OFF にするか」だけを見て操作しない）。必須は `allow_merge_commit` の 1 項目だけで、残りは推奨——**表の「必須/推奨」列を必ず見て、推奨を必須と読み替えない**（squash / rebase 運用のプロジェクトを排除しないため）。

<!-- FROZEN-END -->


## 判定（充足/不足の出し方）

- **必須（`allow_merge_commit`）が不充足**＝不足。人間作業 Issue に含め、セットアップ完了とはしない。
- **推奨が不充足**＝警告。**どの項目がどう壊れるか（上表の右端列）を添えて報告**したうえで、セットアップ完了は妨げない。squash 運用など別方針を採るプロジェクトを排除しないため。
- 推奨の不充足を承知で進める場合は、**その判断を記録する**（人間作業 Issue かセットアップ完了報告のどちらかに残す。黙って通さない）。

## ブランチ保護は「可否判定 → 不可なら判断の記録」

```
gh api repos/{owner}/{repo}/branches/{mainline}/protection
```

`{mainline}` は config `project.defaultBranch`（未設定なら `main`）。**この API は環境によって設定自体が選べない**ため、結果は 5 通りに分けて扱う（403 を一律「失敗」と読まない・404 も一律「未設定」と読まない）。

| 応答 | 読み方 | 次手 |
|---|---|---|
| 200（保護あり） | 保護が設定されている | 内容をそのまま報告する（flow は保護ルールの中身に期待値を持たない） |
| 404 かつ本文が `Branch not found` **以外** | 保護は**設定できる**が未設定 | 保護を設定するか否かを人に決めてもらう（設定は人の UI 作業） |
| 404 かつ本文が `Branch not found` | **判定不能（mainline 未作成）**。ブランチ自体が無いので保護の可否は測れていない | ⑦（mainline ブランチ）の作成後に再判定する。**この区分から「保護は設定できる」と読まない**（403-Pro 分岐を通っていない） |
| 403 かつ本文が `Upgrade to GitHub Pro or make this repository public` | **この環境では選べない**（private ＋無償プラン）。失敗ではない | 下記 3 択を人に提示し、**選んだ結果を記録させる** |
| それ以外のエラー（上記以外の 403・401・5xx 等） | **判定不能（その他）**（トークン権限・障害の可能性） | 充足とも不足とも読まず「判定不能（その他）」と報告する。**転記は括弧まで含めた値で行う**——`判定不能` だけでは `判定不能（mainline 未作成）` と区別できず、⑦ 未了と権限障害という別事象が転記の一段で混ざる |

**判定結果は人間作業 Issue（節 F 手順 3）へ転記する**——応答区分（200 / 404 / 403-Pro / 判定不能（mainline 未作成）/ 判定不能（その他））と API の原文メッセージを書き込む。人は Issue だけを見て判断するので、自分の環境がどの区分かが Issue 内に無いと 3 択を選べない。

3 択（`Upgrade to GitHub Pro...` の場合に人へ出す）:

- **(a)** GitHub Pro へ上げてブランチ保護を使う
- **(b)** リポジトリを public 化してブランチ保護を使う — ⚠️ **不可逆**（全コミット履歴と `.shirokuma/` 配下の内部記録がそのまま公開され、public 化後に非公開へ戻しても一度公開された内容は取り消せない）。**AI は実行しない**（人が判断・操作する）
- **(c)** 機構による強制を諦め、**規律＋ hook 層で担保する**

どれを選んだかを人間作業 Issue（節 F）に書き残す。記録が無いと、次に見た人が「気づいていない」のか「許容した」のかを区別できない。**AI は判定（read）と 3 択の提示までで、(a)(b)(c) のどれも自分で実行しない。**
