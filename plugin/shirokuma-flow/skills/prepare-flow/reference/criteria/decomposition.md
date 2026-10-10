# 分解粒度・親子構造の基準（decomposition）

plan-worker が計画立案で実装サブ Issue へ分解する際の基準。**粒度（S/M）**と**親子構造（承認継承の発火条件）**の 2 点を必ず守る。

> 状態遷移（issue create 後の submit / approve / cancel）は orchestrator が flow verb で行う。worker の責務は正しい構造で起案するところまで。

## 粒度: サブは S/M に収める

| サイズ | 目安 | 扱い |
|--------|------|------|
| S | 数ファイル・数コミットで完結 | そのまま 1 サブ |
| M | 1 PR・1 レビューで差分全体を見渡せる範囲 | そのまま 1 サブ |
| L〜XL | 1 PR で見渡せない・複数の関心が混在 | **着手前に複数サブへ分割**（managing-github-items の「XL は分割」と同方向） |

- 1 サブ = 1 ブランチ = 1 PR が原則（`branch-workflow`）。レビュー可能な規模に保つ。
- **分解の下限: 1 PR で閉じる S は複数のサブに分けない**——分割はコミット単位で行う（既定は [[branch-workflow]]「統合」節の「課題 Issue 単位で PR 1 本」）。
- タスク分解（1 タスク ≈ 1 コミット）とサブの対応を計画本文の表で示す（[../templates/plan-issue.md](../templates/plan-issue.md)）。

## 親子構造: 実装サブは「計画の子」として作る（入れ子 4 階層）

階層モデルは **課題 > 設計（0..1）> 計画（1..n）> 実装サブ（1..n）** の入れ子。実装サブは**計画の子**（`--parent 計画#`）として作る。承認継承（計画 approve 時に実装サブを一括 ToDo 昇格）は「**計画自身の子**」のうち Backlog の sub を走査して発火する。

- ✅ 正: 計画の子として実装サブを作る（サブは `--parent {計画番号}`）→ 計画 approve で承認継承が発火
- ❌ 誤: 実装サブを計画と同じ親（課題）の子＝計画の兄弟として作る → 入れ子構造では計画の子に居ないため承認継承が発火しない

```sh
# 設計 Issue（課題の子・設計が要るときだけ）
shirokuma-flow issue create --title "設計: {要旨}" --body "{設計本文}" --issue-type Design --parent {課題番号}

# 計画 Issue（設計があれば設計の子・設計なし課題なら課題の子）
shirokuma-flow issue create --title "計画: {要旨}" --body "{計画本文}" --issue-type Plan --parent {設計番号}

# 実装サブ（★ 計画の子として作る）
shirokuma-flow issue create --title "{サブ}" --body "{サブ本文}" --issue-type Task --parent {計画番号}
```

> 階層モデル: 課題の下に設計（0..1）、設計の下に計画（複数可）、計画の下に実装サブ（複数可）がぶら下がる。設計が無い課題では計画を課題直下に作り、その計画の子としてサブを作る。

### 継続型（Epic / Research）配下の階層ルール

**継続型（Epic / Research）の子として計画（Plan）/ 設計（Design）を直接作成しない**（継続型の合法子は normal / sub のみ。直付けすると階層飛ばしで `illegal-child-kind` になる）。継続型配下の正しい構造は次の 2 系統:

- **継続型 > sub**: 軽量なサブ作業は継続型に直接ぶら下げる。
- **継続型 > 課題本体(normal) > (設計) > 計画(Plan) > サブ**: 分解が要る場合は、まず課題本体（normal）を継続型の子として置き、その配下に設計・計画・実装サブの入れ子を作る（計画は課題本体の系統の子であって、継続型の直接の子ではない）。

> 計画の子サブが 0 件のときに限り、承認継承は計画の兄弟（課題直下に並ぶ実装サブ）へフォールバックして発火する。新規起案は必ず入れ子（サブは計画の子）で作る。

## 計画 Backlog 中のサブ起案（`--force` の正規用法）

実装サブは**計画がまだ Backlog のうちに** `--force` を付けて起案する。これが `issue create --force` の**正規用法**で、それ以外の `--force` 利用（整理目的で親 Status / 親 state / 最上位 IssueType のゲートを飛ばす等）は既定どおり**例外**の位置づけ。可否そのものの正本は portable rule の [[status-policy]]「入口ゲートの正規例外」で、本節はその手順（何を渡すか・何がスキップされるか）を持つ。

```sh
# 計画がまだ Backlog のうちに実装サブを起案する（正規用法）
shirokuma-flow issue create --title "{サブ}" --body "{サブ本文}" --issue-type Task --parent {計画番号} --force
```

### なぜ Backlog 中なのか（2 経路の事実）

計画の子としてサブを作る経路は機構上 **2 つ**あり、`--force` 経路「しかない」わけではない。ただし**承認継承で自動昇格させるには計画が Backlog のうちに作る必要がある**。

| 経路 | 手順 | 帰結 |
|------|------|------|
| **A: 計画 Backlog 中に `--force` で作る（推奨・正規用法）** | `issue create --parent <計画#> --force` → `submit` → `approve`（**既定は orchestrator が打つ**。`IssueType=ADR` の候補 Issue も既定は orchestrator が打ち、**自律の境界を緩める決定を含む候補だけ人が打つ**〔人が打つ形は `approve` ではなく `shirokuma-flow adr publish <候補番号> --accept-boundary-loosening`。判別は候補本文の宣言欄・`autonomous-flow` の `reference/criteria/irreversible-operations.md`「条件付き自動実行」§1〕／`確認モード: guided` の明示がある回だけ人が打つ。正本は `.shirokuma/rules/confirmation-style.md`「確認モードの解決と中継」節） | approve 時点の直下 Backlog サブが**承認継承**で一括 ToDo 昇格する。approve が計画本文とサブ実物を同時に確定する（承認継承の設計前提） |
| **B: approve 後（計画が ToDo 以降）に作る** | `issue create --parent <計画#>`（親 Status 入口ゲートを素通りするので `--force` 不要） | サブは **Backlog seed のまま残る**。ToDo に上げるには `reconcile --fix`（`approval-inheritance-missed` の修復）の追加実行が要る。approve 時点でサブ実物が存在しない |

経路 B は機構として存在するが、正常フローの帰結が毎回「承認継承の取りこぼし」として逸脱検知に出る形になるため、正規経路にはしない（逸脱の事後修復は safety net であって主経路ではない）。

親 Status 入口ゲートは Backlog の親を拒否するが、その拒否理由自身が `--force` を案内する**サンクション付きバイパス**（禁止の抜け道ではなく、設計上用意された逃げ道）。

### `--force` がスキップするゲート（全件）

`--force` が飛ばすのは**排他の片側だけ**（`--parent` の有無で分岐する）。

- **親あり（`--parent` 指定時）**
  1. **親の事前取得**（親の Status / state を取りに行く処理そのもの。取得できないときの「ゲート判定不能」エラーも出なくなる）
  2. **closed 親 state ゲート**（closed 済みの親の下に子を作らせない）
  3. **親 Status 入口ゲート**（Backlog / Review の親を拒否する）
  4. **ADR 配置ゲート**（`IssueType=ADR` を継続型〔EPIC / Research〕以外の親の下に置かせない検査。IssueType を名指しするゲートなので、ADR 以外の型を作るときは呼ばれても即 no-op＝実装サブ起案では実質効かない）
  5. **親子 kind 階層ゲート**（子 kind が `sub` 以外のときだけ評価される階層エッジ検査）
- **親なし（最上位）**
  6. **最上位 IssueType 階層ゲート**（最上位に置いてよい IssueType の allowlist 検査）

> 確かめた範囲: この列挙は開発側の資料（CLI の実装）で確かめたもので、導入先の版では確かめていない。配布先で現物と突き合わせるときは `shirokuma-flow issue create --help` の `--force` 説明を実行して読む——CLI 側の記述が実行時の正本。

### 使うときの注意

- **他のゲートも同時に飛ぶ**ので、実行前に**親番号と IssueType を必ず確認**する（サブ起案のつもりで親番号を間違えても、上記 1〜5 はもう止めてくれない）。
- **親の存在確認が一切なくなるわけではない**。飛ぶのは親の**事前**取得だけで、作成後の親リンク（sub-issue 追加）は実行される。親が存在しなければそこで失敗し、作成された Issue は**ロールバック close** される。
- 自律進行（autopilot）との関係: `issue create --force` は**作成**操作（失敗時はロールバック close）であって破壊操作ではないため、不可逆／外向き操作リストの「`--force` を伴う破壊操作」には**当たらない**＝一括委任の射程内で実行してよい（`autonomous-flow` の `reference/criteria/irreversible-operations.md`）。
- bootstrap（Project 未作成のリポでセットアップ Issue を起票する場面）で使う `--force` は**用途が別**（最上位 IssueType ゲート向け・`setting-up-project` スキル）。本節が扱うのは**計画配下のサブ起案（親 Status ゲート向け）**。

## 承認継承の発火確認（approve の sideEffects）

`approve` は既定（自律）では orchestrator が実行する（`IssueType=ADR` の候補 Issue も既定は orchestrator が打つ——ただし公開のゲート下＝`autonomous-flow` の `reference/criteria/irreversible-operations.md`「条件付き自動実行」§1 で、**自律の境界を緩める決定を含む候補だけ人が打つ**（人が打つ形は `approve` ではなく `shirokuma-flow adr publish <候補番号> --accept-boundary-loosening`）。`確認モード: guided` の明示がある回だけ人が打つ。**確認モードの受信側既定と中継義務の正本は `.shirokuma/rules/confirmation-style.md`「確認モードの解決と中継」節**——明示が無い回は確認モードではない）。発火確認の手順はどちらのモードでも同じ:

1. `shirokuma-flow approve <計画#>` の出力 `sideEffects` に `承認継承#<サブ>→ToDo` が**全サブ分**含まれているか確認する（例: 計画の子サブが 2 本なら `["親#<課題>→In progress", "承認継承#<サブ 1>→ToDo", "承認継承#<サブ 2>→ToDo"]`。親が既に In progress 以上なら `親#…` は出ない）。
2. 出ていないサブがあれば `shirokuma-flow status <サブ#>` で親と Status を確認する。サブが計画の子になっていない（課題直下に並んでいる等）なら**計画へ再ペアレント**し、orchestrator が遷移を補正する。

## 委任・検査に触れるサブを起案するとき（正本は [[delegation-and-checks]]）

サブ Issue の本文が **委任（「このタスクは既存 worker / skill / 手順へ回す」という割り当て）または検査（ゲート・判定条件・決定表・lint ルール・レビュー観点・テストによる機械検証）に触れている可能性がある**なら、[[delegation-and-checks]] を読んで実際の発火条件を当て、該当したら同規範 D 節 / C 節を満たす形で本文を書く。条件・深刻度の正本は同規範側にあり、**本ファイルは条件を写さない**（写した要約が本体より緩くなる形＝同規範 C5 を避ける）。この開閉条件は正本より広く取ってあり、当たりすぎることはあっても当たらなくなることはない。

分解の段では委任する差分の実物がまだ無いので、同規範 D2 に従い**差分の型**（そのサブでどのファイル群が必ず変わり、どのファイル群が変わりうるか）をサブ本文に書き出して当てる。

## 依存関係の張り方

- 依存は本当に順序が必要なものだけに張る。一律「調査完了後」にしない——確定済み修正の並行着手を阻害する（失敗パターンの詳細カタログは [plan-review.md](plan-review.md) 観点 5）。
- 計画のやり直しでは旧計画を放置しない。採用しない計画は orchestrator に cancel を依頼する（並存は計画レビューで Critical。同 観点 7）。
