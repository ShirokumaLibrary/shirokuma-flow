/**
 * プロジェクト関連ユーティリティ（共有関数）。
 *
 * projects.ts から抽出。複数の commands/utils ファイルから参照される
 * 共有関数を集約し、Phase 2 の並行作業でコンフリクトを防ぐ。
 */
/** ワークフロー情報 */
export interface ProjectWorkflow {
    id: string;
    name: string;
    number: number;
    enabled: boolean;
}
/** #250 推奨ワークフロー: 有効にすべき自動化 */
export declare const RECOMMENDED_WORKFLOWS: string[];
/**
 * プロジェクト名から GitHub Projects V2 の ID を取得する（デフォルトはリポジトリ名）。
 * Organization を先に試行し、失敗時に User にフォールバックする。
 * 名前一致するプロジェクトがない場合は最初のプロジェクトをフォールバックとして使用する。
 *
 * @param owner - GitHub Organization または User のログイン名
 * @param projectName - 検索するプロジェクト名。省略時はカレントリポジトリ名を使用
 * @returns プロジェクトの GraphQL Node ID。取得失敗時は `null`
 *
 * @example
 * ```typescript
 * const projectId = await getProjectId("my-org")
 * const namedId = await getProjectId("my-org", "my-project")
 * ```
 *
 * @category Project
 */
export declare function getProjectId(owner: string, projectName?: string): Promise<string | null>;
/**
 * Owner の GraphQL Node ID を取得する。
 * Organization を先に試行し、失敗時に User にフォールバック。
 * `createProjectV2` mutation に必要。
 *
 * @param owner - GitHub Organization または User のログイン名
 * @returns GraphQL Node ID 文字列。Organization / User いずれも取得失敗時は `null`
 *
 * @example
 * ```typescript
 * const nodeId = await getOwnerNodeId("my-org")
 * ```
 *
 * @category Project
 */
export declare function getOwnerNodeId(owner: string): Promise<string | null>;
/**
 * プロジェクトのワークフロー一覧を取得する。
 * GitHub Projects V2 のビルトイン自動化を確認するために使用。
 *
 * @param projectId - プロジェクトの GraphQL Node ID
 * @returns ワークフロー配列。取得失敗時は空配列
 *
 * @example
 * ```typescript
 * const workflows = await fetchWorkflows(projectId)
 * const enabled = workflows.filter(w => w.enabled)
 * ```
 *
 * @category Project
 */
export declare function fetchWorkflows(projectId: string): Promise<ProjectWorkflow[]>;
//# sourceMappingURL=project-utils.d.ts.map