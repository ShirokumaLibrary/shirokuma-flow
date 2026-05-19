/**
 * Parent status reactive sync (#1833)
 *
 * サブ Issue のステータス変更時に親 Issue のステータスを自動導出・更新する。
 * `deriveExpectedParentStatus()` は integrity/index.ts から移動。
 * `syncParentStatus()` は各コマンドから呼び出すファサード。
 */
import { Logger } from "./logger.js";
export declare const GRAPHQL_QUERY_PARENT_NUMBER = "\nquery($owner: String!, $name: String!, $number: Int!) {\n  repository(owner: $owner, name: $name) {\n    issue(number: $number) {\n      parent {\n        number\n      }\n    }\n  }\n}\n";
/**
 * 単一 Issue を `SubIssueNode` 互換シェイプで取得する GraphQL クエリ。
 * `detectApprovablePlanIssues()` に「親自身」を候補として渡すために使用する。
 */
export declare const GRAPHQL_QUERY_PLAN_CANDIDATE_NODE = "\nquery($owner: String!, $name: String!, $number: Int!) {\n  repository(owner: $owner, name: $name) {\n    issue(number: $number) {\n      number\n      title\n      state\n      labels(first: 10) {\n        nodes { name }\n      }\n      projectItems(first: 5) {\n        nodes {\n          status: fieldValueByName(name: \"Status\") {\n            ... on ProjectV2ItemFieldSingleSelectValue { name }\n          }\n        }\n      }\n    }\n  }\n}\n";
export interface ParentQueryResult {
    data?: {
        repository?: {
            issue?: {
                parent?: {
                    number?: number;
                } | null;
            };
        };
    };
}
export interface SubIssueNode {
    number?: number;
    title?: string;
    state?: string;
    labels?: {
        nodes?: Array<{
            name?: string;
        }>;
    };
    projectItems?: {
        nodes?: Array<{
            id?: string;
            status?: {
                name?: string;
            } | null;
        }>;
    };
}
export interface SubIssuesQueryResult {
    data?: {
        repository?: {
            issue?: {
                subIssues?: {
                    nodes?: SubIssueNode[];
                };
                subIssuesSummary?: {
                    total?: number;
                };
            };
        };
    };
}
/** syncParentStatus の戻り値 */
export interface SyncParentResult {
    parentNumber?: number;
    subIssueNodes?: SubIssueNode[];
}
/**
 * 親 Issue を `SubIssueNode` 形式で取得する。
 *
 * `close` / `pr merge` で work issue 操作後に、親（計画 Issue 候補）自身を
 * `detectApprovablePlanIssues()` に渡すためのデータを取得するヘルパー。
 * `syncParentStatus().subIssueNodes` には親自身が含まれないため、ここで補完する。
 */
export declare function fetchPlanCandidateNode(owner: string, repo: string, number: number): Promise<SubIssueNode | null>;
/**
 * ノードが計画 Issue かどうかを判定する。
 * 判定基準: `area:plan` ラベル OR タイトルが「計画:」/「Plan:」で始まる。
 * ラベルを正とし、タイトルプレフィックスはフォールバック。
 * integrity/index.ts, syncParentStatus() で共通使用。
 */
export declare function isPlanIssue(node: {
    title?: string;
    labels?: {
        nodes?: Array<{
            name?: string;
        }>;
    };
}): boolean;
/**
 * `labels: string[]` 形式向けの計画 Issue 判定。
 * IssueData など labels が文字列配列の型で使用する。
 * isPlanIssue() と判定基準は同一。
 */
export declare function isPlanIssueFromLabels(labels: string[], title?: string): boolean;
/**
 * ノードが設計 Issue かどうかを判定する。
 * 判定基準: `area:design` ラベル OR タイトルが「設計:」/「Design:」で始まる。
 * ラベルを正とし、タイトルプレフィックスはフォールバック（`isPlanIssue()` と同パターン）。
 * `area:design` ラベルは現時点で未運用だが、将来追加された場合に備えてラベル優先判定を組み込む。
 */
export declare function isDesignIssue(node: {
    title?: string;
    labels?: {
        nodes?: Array<{
            name?: string;
        }>;
    };
}): boolean;
/**
 * 兄弟の実作業 Issue（計画 Issue 以外）に未完了のものが存在するかを判定する。
 *
 * 計画 Issue の Close タイミングと Integration PR 自動作成条件を統一するための共通ヘルパー。
 * 呼び出し元: `closeSiblingPlanIssues()` (push/issue.ts)、`closePlanIssues()` / Integration PR 判定 (pr/merge.ts)。
 *
 * 判定基準:
 * - `state === "OPEN"` → 未完了
 * - `state === "CLOSED"` でも Status が Backlog/Ready/In Progress/Review/Blocked → 未完了（integrity 不整合の保険）
 * - Status 未設定の CLOSED ノードは完了扱い（CLOSED 単独で十分なシグナル）
 *
 * 実作業 Issue が 0 件の場合は常に `false`（通常 Issue 構成では計画 Issue を Close してよい）。
 *
 * @param excludeNumber push 中の Issue 自身を判定対象から除外するための番号。
 *        `syncParentStatus` が返す `subIssueNodes` には push 中の自身が OPEN で含まれるため、
 *        `#1932` の In Progress 遷移時フローではこの引数で自身を除外する必要がある。
 *        PR マージ後の判定（pr/merge.ts）では対象 Issue も CLOSED + Done になっているため省略可。
 */
export declare function hasIncompleteWorkSiblings(subIssueNodes: SubIssueNode[], excludeNumber?: number): boolean;
/**
 * Sub-Issue ノード配列から Project ステータス名を抽出する。
 * integrity/index.ts と syncParentStatus() の両方で使用される共通ロジック。
 *
 * ステータス未設定（Project 未追加 / null）のノードは Backlog として扱う (#1955)。
 * これにより、未設定ノードが集計から除外されて誤った Done 判定になることを防止する。
 */
export declare function extractSubIssueStatuses(nodes: Array<{
    projectItems?: {
        nodes?: Array<{
            status?: {
                name?: string;
            } | null;
        }>;
    };
}>): string[];
/**
 * アクティブ（進行中）とみなすステータス。
 * これらが1つでも存在する場合、親は In Progress になるべき。
 *
 * ADR-v3-013: Completed は廃止予定のため ACTIVE_STATUSES から除外。
 * Completed のみ・Completed + Done の混在は allDoneOrCompleted 条件で Review に導出される。
 *
 * @since #2202 READY / PENDING を除外（Backlog に統合。未着手扱いのためアクティブではない）
 * @since #2203 ON_HOLD を BLOCKED に置換
 */
export declare const ACTIVE_STATUSES: readonly string[];
/**
 * Sub-Issue のステータスリストから親 Issue の期待ステータスを導出する。
 * 導出不能な場合は null を返す。
 * Pure function。
 */
export declare function deriveExpectedParentStatus(subIssueStatuses: string[]): string | null;
/**
 * サブ Issue のステータス変更後に親 Issue のステータスを自動導出・更新する。
 *
 * 処理フロー:
 * 1. Issue の親番号を取得
 * 2. 親の全サブ Issue ステータスを取得
 * 3. deriveExpectedParentStatus() で期待値を算出
 * 4. 差分があれば resolveAndUpdateStatus() で更新
 *
 * best-effort: エラーが発生してもログのみで続行する。
 *
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param issueNumber - ステータスが変更されたサブ Issue の番号
 * @param logger - ロガー
 */
export declare function syncParentStatus(owner: string, repo: string, issueNumber: number, logger: Logger): Promise<SyncParentResult>;
/** checkChildrenAllDone の戻り値 */
export interface CheckChildrenAllDoneResult {
    /** 全子が Done または Cancelled 相当であれば true */
    allDone: boolean;
    /** 未完了の子 Issue の一覧 */
    openChildren: Array<{
        number: number;
        status: string | null;
    }>;
}
/**
 * 親 Issue の全子 Issue が完了済み（Done または Cancelled 相当）かどうかを確認する。
 *
 * 判定基準:
 * - `state === "OPEN"` → 未完了
 * - `state === "CLOSED"` かつ Status が Backlog/In progress/Review/Blocked/Completed → 未完了（integrity 不整合の保険）
 * - `state === "CLOSED"` かつ Status 未設定 → 完了扱い
 * - Status が `isCancelledEquivalent()` に該当 → 完了扱い
 * - 子 Issue が 0 件 → allDone: true（ガード no-op）
 * - GraphQL 失敗 → allDone: true（best-effort、誤発動防止）
 *
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param parentNumber - 親 Issue 番号
 * @returns CheckChildrenAllDoneResult
 */
export declare function checkChildrenAllDone(owner: string, repo: string, parentNumber: number): Promise<CheckChildrenAllDoneResult>;
/**
 * 親 Issue が Close されたとき、連動 Close 対象の子 Issue を Close する。
 *
 * ADR-v3-013: Done(Open) は中間状態（承認済みだが親が閉じるまで Open 維持）であり、
 * 親の Close と同時に子も Close するカスケード動作を実装する。
 *
 * 連動 Close 対象:
 * - Done(Open) の全子 Issue（従来通り）
 * - Open 状態の計画 Issue（Review/Ready/In Progress/Backlog 等、全オープン状態）
 *   計画 Issue は Done 到達前でも親 Close 時に閉じる（#2140 の拡張）。
 *   ※ ステータス列挙ではなく Open 状態を基準にすることで将来のステータス追加にも対応。
 *   ※ `classifyOrphanedPlanIssues()` は「親紐付けなし」の計画 Issue を検出する設計であり、
 *      親に紐付けられた計画 Issue の漏れ Close は本関数が担う。
 *
 * best-effort: 個別エラーは警告ログのみで処理を継続し、成功した Close のみ返す。
 *
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param parentIssueNumber - 親 Issue 番号
 * @param logger - ロガー
 * @returns 実際に Close した子 Issue 番号の配列
 */
export declare function syncChildCloseOnParentClose(owner: string, repo: string, parentIssueNumber: number, logger: Logger): Promise<number[]>;
//# sourceMappingURL=parent-status.d.ts.map