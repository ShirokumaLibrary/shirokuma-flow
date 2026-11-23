# shirokuma-flow プラグイン（orchestration 層）

`flow` CLI（状態機械エンジン）の上に、**フェーズ進行・人ゲート・worker 委任**を載せる層。

## 構成

- **orchestrator skill（`*-flow`）** — フェーズを仕切る。`flow` CLI verb で状態を進め、人ゲートで止まる。管理セッションのメインが自分で行うのは方向の指示・委任・状態遷移・人への確認だけで（例外は実行環境の永続メモリの更新で、これはメインが行う）、課題の作業（設計・計画の起案・実装・品質ゲート・commit・PR 作成・是正）とそれに伴う GitHub への記録は作業セッションのメインが行い、それ以外の作業（レビュー・確認ビューの生成・管理セッションに残る本文の書き換え・調査・依存更新の検証など）は下表の worker へ委任する。フェーズを仕切る orchestrator はそのフェーズと 1:1 で、フェーズを持たない入口・横断の orchestrator もある（下表の「フェーズ」列を参照）。
- **worker agent（`*-worker`）** — 隔離した実作業。1 種の仕事に集中し、圧縮サマリーのみ返す。

| orchestrator | フェーズ | 主な worker |
|---|---|---|
| `issue-flow` | 入口・トリアージ | requirements（課題本体の本文）・review（提出前の分析） |
| `design-flow` | Designing | review（設計の起案は作業セッションのメイン） |
| `prepare-flow` | Preparing | review（計画の起案は作業セッションのメイン） |
| `implement-flow` | Working | —（実装・品質ゲート・commit・PR 作成は作業セッションのメインが手順書で行う） |
| `review-flow` | Reviewing | security-review・code-review・asset-safety-review（R1）・review（判定器が要る回）・merge-verify（merge の前の全体の検査を宣言した構成） |
| `requirements-flow` | Requirements（独立） | requirements・research・review |
| `dependency-flow` | 依存更新 PR（独立・入口） | dependency-verify |
| `issue-run-flow` | 入口・作業セッション（人の打鍵か、管理セッションからの名指しの SendMessage で起動） | review・R1 のレビュー worker（レビューを委任する） |
| `autonomous-flow` | 横断（包括委任で自動進行） | 上記を順に起動 |

確認ビュー（人に確認させる What の HTML）の生成と記録行は、どの orchestrator も explainer へ委任する（生成するかの判定と委任先の正本は規範 `html-report-criteria`）。

## 不変則

- **作業と GitHub への記録は管理セッションのメインが行わない**（作業セッションのメインか worker が行う。管理セッションのメインが自分で行うのは方向の指示・委任・状態遷移・人への確認だけ。例外は実行環境の永続メモリの更新で、これはメインが行う。作業セッションのメインが課題の作業を自分で行う範囲は C16。Creator-Checker 分離は変えない。線引きの正本は規範 `orchestration-discipline` C16。運用規範。機構的強制は worker(agent) の tools 制限だけで、skill ではツール制限が効かないので、管理セッションと作業セッションのメインが守る分は規律で支える）。状態遷移は `flow` verb のみ。
- `approve` は**既定（自律）では orchestrator が打つ**（`確認モード: guided` の明示がある回だけ人が打つ。**確認モードの受信側既定と中継義務の正本は 規範 `confirmation-style`「確認モードの解決と中継」節**——条件はそちらが正本）。**`IssueType=ADR` の候補 Issue の `approve`（＝確定）も既定は orchestrator が打つ**——確定した決定は以後を縛るので `autonomous-flow` の [reference/criteria/irreversible-operations.md](skills/autonomous-flow/reference/criteria/irreversible-operations.md)「条件付き自動実行」のゲート下にあり、**自律の境界そのものを緩める決定を含む候補**は `shirokuma-flow adr publish <候補番号> --accept-boundary-loosening` で確定し（素の `approve` / 素の `adr publish` は人が打っても CLI が拒否する。この形を打つのは既定では人で、緩める側の事前授権がある構成では AI も打つ）、条件を 1 件ずつ通せない回は人が打つ（判別は候補本文の宣言欄＝`shirokuma-flow gate vocab --field adr-autonomy-boundary`）。ADR 候補の確定の打ち手は `next` の `runBy` に従う（形と主体の正本は [[status-policy]] の `approve` 条項）。`adr publish` の直打ちは既定では人専有（config の事前授権がある構成で AI に開く条件は [[permission-boundary]]「verb 名では見分けられない副作用」節が正本）。mainline への `merge` は既定では人ゲートで、config に事前授権がある範囲でだけ AI が打つ（授権の読み方の正本は [[branch-workflow]]「自律境界」）。`autonomous-flow --autopilot` 時の**包括委任**は**常設の事前授権**（人が規範として与えた事前承認）で、承認の主体は依然として人。**代替の射程は `autonomous-flow` の停止境界（不可逆／外向き操作リスト）が正本**で、射程外の操作は包括委任下でも都度人に確認する——本節はその条件を要約しない（要約は必ず正本の真部分集合になり、緩いほうが広く読まれる）。
- 決定は AgDR（Why-first。正本は `adr.dir` のファイル）。

> CLI verb の正本: CLI（`@shirokuma-library/flow`）。`shirokuma-flow <verb> <number>` を呼ぶ。
