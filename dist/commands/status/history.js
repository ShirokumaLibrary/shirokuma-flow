/**
 * status history サブコマンド (#2224 Phase 5-8)
 *
 * Issue の Status 変更履歴を GitHub GraphQL API（`ProjectV2ItemStatusChangedEvent`）から取得して
 * タイムスタンプ付きで表示する。Projects V2 のみ対応（classic Projects は対象外）。
 */
import { parseIssueNumber, isIssueNumber, runGraphQL } from "../../utils/github.js";
import { resolveTargetRepo } from "../../utils/repo-pairs.js";
import { formatOutput } from "../../utils/formatters.js";
const GRAPHQL_QUERY_STATUS_HISTORY = `
query($owner: String!, $repo: String!, $number: Int!, $first: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      number
      title
      timelineItems(first: $first, itemTypes: [PROJECT_V2_ITEM_STATUS_CHANGED_EVENT]) {
        totalCount
        nodes {
          ... on ProjectV2ItemStatusChangedEvent {
            createdAt
            previousStatus
            status
            wasAutomated
            actor { login }
            project { number title }
          }
        }
      }
    }
  }
}
`;
export async function cmdStatusHistory(numberStr, options, logger) {
    if (!isIssueNumber(numberStr)) {
        logger.error("有効な Issue 番号を指定してください");
        return 1;
    }
    const repoInfo = resolveTargetRepo(options);
    if (!repoInfo) {
        logger.error("リポジトリを特定できません");
        return 1;
    }
    const { owner, name: repo } = repoInfo;
    const number = parseIssueNumber(numberStr);
    const limit = options.limit ?? 100;
    const result = await runGraphQL(GRAPHQL_QUERY_STATUS_HISTORY, {
        owner,
        repo,
        number,
        first: limit,
    });
    if (!result.success) {
        logger.error(`GraphQL クエリ失敗: ${result.error}`);
        return 1;
    }
    const issue = result.data?.data?.repository?.issue;
    if (!issue) {
        logger.error(`Issue #${number} が見つかりません`);
        return 1;
    }
    const filteredNodes = options.project
        ? issue.timelineItems.nodes.filter((n) => n.project?.number === options.project)
        : issue.timelineItems.nodes;
    const history = filteredNodes.map((node) => ({
        timestamp: node.createdAt,
        from: node.previousStatus === "" ? null : node.previousStatus,
        to: node.status,
        actor: node.actor?.login ?? null,
        was_automated: node.wasAutomated,
        project_number: node.project?.number ?? null,
        project_title: node.project?.title ?? null,
    }));
    const output = {
        number: issue.number,
        title: issue.title,
        total: history.length,
        history,
    };
    const format = (options.format ?? "table-json");
    const formatted = formatOutput(output, format, {
        arrayKey: "history",
        columns: ["timestamp", "from", "to", "actor", "was_automated", "project_title"],
    });
    console.log(formatted);
    return 0;
}
//# sourceMappingURL=history.js.map