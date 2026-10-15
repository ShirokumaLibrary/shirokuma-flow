# shirokuma-flow プラグイン（orchestration 層）

`flow` CLI（状態機械エンジン）の上に、**フェーズ進行・人ゲート・worker 委任**を載せる層。

## 構成

- **orchestrator skill（`*-flow`）** — フェーズを仕切る。`flow` CLI verb で状態を進め、実作業のうち Creator-Checker 分離が要る段と、独立で規模の大きい作業はサブエージェントへ委任し（機械的な段は自分で回す）、人ゲートで止まる。フェーズを仕切る orchestrator はそのフェーズと 1:1 で、フェーズを持たない入口・横断の orchestrator もある（下表の「フェーズ」列を参照）。
- **worker agent（`*-worker`）** — 隔離した実作業。1 種の仕事に集中し、圧縮サマリーのみ返す。

| orchestrator | フェーズ | 主な worker |
|---|---|---|
| `issue-flow` | 入口・トリアージ | — |
| `design-flow` | Designing | design |
| `prepare-flow` | Preparing | plan |
| `implement-flow` | Working | coding / commit / pr / finalize |
| `review-flow` | Reviewing | review |
| `requirements-flow` | Requirements（独立） | requirements |
| `dependency-flow` | 依存更新 PR（独立・入口） | dependency-verify |
| `autonomous-flow` | 横断（包括委任で自動進行） | 上記を順に起動 |

## 不変則

- **実作業のうち Creator-Checker 分離が要る段と、独立で規模の大きい作業はサブエージェント**（機械的な段は orchestrator が直接回してよい。どの段を誰が実行するかは `implement-flow`「レーン」節が正本。運用規範。機構的強制は worker(agent) の tools 制限で担保。skill ではツール制限が効かない）。状態遷移は `flow` verb のみ。
- `approve` は**既定（自律）では orchestrator が打つ**（`確認モード: guided` の明示がある回だけ人が打つ。**確認モードの受信側既定と中継義務の正本は 規範 `confirmation-style`「確認モードの解決と中継」節**——条件はそちらが正本）。**`IssueType=ADR` の候補 Issue の `approve`（＝確定）も既定は orchestrator が打つ**——確定した決定は以後を縛るので `autonomous-flow` の [reference/criteria/irreversible-operations.md](skills/autonomous-flow/reference/criteria/irreversible-operations.md)「条件付き自動実行」のゲート下にあり、**自律の境界そのものを緩める決定を含む候補**は `shirokuma-flow adr publish <候補番号> --accept-boundary-loosening` で確定し（素の `approve` / 素の `adr publish` は人が打っても CLI が拒否する。この形を打つのは既定では人で、緩める側の事前授権がある構成では AI も打つ）、条件を 1 件ずつ通せない回は人が打つ（判別は候補本文の宣言欄＝`shirokuma-flow gate vocab --field adr-autonomy-boundary`）。ADR 候補の確定の打ち手は `next` の `runBy` に従う（形と主体の正本は [[status-policy]] の `approve` 条項）。`adr publish` の直打ちは既定では人専有（config の事前授権がある構成で AI に開く条件は [[permission-boundary]]「verb 名では見分けられない副作用」節が正本）。mainline への `merge` は既定では人ゲートで、config に事前授権がある範囲でだけ AI が打つ（授権の読み方の正本は [[branch-workflow]]「自律境界」）。`autonomous-flow --autopilot` 時の**包括委任**は**常設の事前授権**（人が規範として与えた事前承認）で、承認の主体は依然として人。**代替の射程は `autonomous-flow` の停止境界（不可逆／外向き操作リスト）が正本**で、射程外の操作は包括委任下でも都度人に確認する——本節はその条件を要約しない（要約は必ず正本の真部分集合になり、緩いほうが広く読まれる）。
- 決定は AgDR（Why-first。正本は `adr.dir` のファイル）。

> CLI verb の正本: CLI（`@shirokuma-library/flow`）。`shirokuma-flow <verb> <number>` を呼ぶ。
