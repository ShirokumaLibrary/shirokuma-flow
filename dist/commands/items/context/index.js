/**
 * items context サブコマンド (#2024 Phase 1)
 *
 * 指定された Issue / PR を起点に関連情報を一括取得し、
 * `.shirokuma/cache/` にキャッシュとして書き込む。
 *
 * 取得内容:
 * - 対象 Issue / PR の本文・ステータス・ラベル・担当者
 * - 親 Issue（あれば）
 * - 子 Issue（あれば）
 * - 本文からリンクされた Discussion
 * - 関連 PR（Closes #{N} の逆引き）
 * - 各アイテムの最新コメント
 */
import { runGraphQL, parseIssueNumber, isIssueNumber } from "../../../utils/github.js";
import { resolveTargetRepo } from "../../../utils/repo-pairs.js";
import { readContextCache, writeContextCache, } from "../../../utils/context-cache.js";
// =============================================================================
// GraphQL クエリ定義
// =============================================================================
/** Issue の関連情報を一括取得するクエリ */
const GRAPHQL_QUERY_ISSUE_CONTEXT = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      number
      title
      body
      state
      url
      issueType { name }
      labels(first: 20) { nodes { name } }
      assignees(first: 10) { nodes { login } }
      parent {
        number
        title
        state
        projectItems(first: 5) {
          nodes {
            status: fieldValueByName(name: "Status") {
              ... on ProjectV2ItemFieldSingleSelectValue { name }
            }
          }
        }
      }
      subIssues(first: 50) {
        nodes {
          number
          title
          state
          labels(first: 10) { nodes { name } }
          projectItems(first: 5) {
            nodes {
              status: fieldValueByName(name: "Status") {
                ... on ProjectV2ItemFieldSingleSelectValue { name }
              }
            }
          }
        }
      }
      projectItems(first: 5) {
        nodes {
          id
          project { id title }
          status: fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue { name optionId }
          }
          priority: fieldValueByName(name: "Priority") {
            ... on ProjectV2ItemFieldSingleSelectValue { name optionId }
          }
          size: fieldValueByName(name: "Size") {
            ... on ProjectV2ItemFieldSingleSelectValue { name optionId }
          }
        }
      }
      timelineItems(first: 5, itemTypes: [CONNECTED_EVENT]) {
        nodes {
          ... on ConnectedEvent {
            subject {
              ... on PullRequest {
                number
                title
                state
                baseRefName
                headRefName
              }
            }
          }
        }
      }
      comments(last: 3) {
        nodes {
          databaseId
          author { login }
          body
          createdAt
        }
      }
    }
  }
}
`;
/** PR の関連情報を一括取得するクエリ */
const GRAPHQL_QUERY_PR_CONTEXT = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      number
      title
      body
      state
      url
      baseRefName
      headRefName
      labels(first: 20) { nodes { name } }
      assignees(first: 10) { nodes { login } }
      closingIssuesReferences(first: 10) {
        nodes {
          number
          title
          state
        }
      }
      comments(last: 3) {
        nodes {
          databaseId
          author { login }
          body
          createdAt
        }
      }
    }
  }
}
`;
/** Discussion の情報を取得するクエリ */
const GRAPHQL_QUERY_DISCUSSION_CONTEXT = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    discussion(number: $number) {
      number
      title
      body
      url
      category { name }
    }
  }
}
`;
// =============================================================================
// ヘルパー関数
// =============================================================================
/**
 * Issue 本文から Discussion へのリンクを検出する。
 * 検出パターン:
 * - https://github.com/{owner}/{repo}/discussions/{number}
 * - #D{number}（shirokuma-docs 独自記法）
 */
function extractDiscussionNumbers(body, owner, repo) {
    const numbers = [];
    // フル URL パターン
    const urlPattern = new RegExp(`https://github\\.com/${owner}/${repo}/discussions/(\\d+)`, "g");
    let match;
    while ((match = urlPattern.exec(body)) !== null) {
        const num = parseInt(match[1], 10);
        if (!numbers.includes(num))
            numbers.push(num);
    }
    // #D{number} パターン（shirokuma-docs 独自記法）
    const shortPattern = /#D(\d+)/g;
    while ((match = shortPattern.exec(body)) !== null) {
        const num = parseInt(match[1], 10);
        if (!numbers.includes(num))
            numbers.push(num);
    }
    return numbers;
}
/**
 * Project Items から現在のステータスを取得する。
 */
function extractStatusFromProjectItems(projectItems) {
    if (!projectItems)
        return undefined;
    for (const item of projectItems) {
        if (item.status?.name)
            return item.status.name;
    }
    return undefined;
}
// =============================================================================
// コマンドエントリポイント
// =============================================================================
/**
 * items context サブコマンド
 *
 * Issue / PR を起点に関連情報を一括取得し、コンテキストキャッシュに書き込む。
 */
export async function cmdItemContext(numberStr, options, logger) {
    if (!isIssueNumber(numberStr)) {
        logger.error("有効なアイテム番号を指定してください");
        return 1;
    }
    const repoInfo = resolveTargetRepo(options);
    if (!repoInfo) {
        logger.error("リポジトリを特定できません");
        return 1;
    }
    const { owner, name: repo } = repoInfo;
    const number = parseIssueNumber(numberStr);
    // キャッシュ確認（--no-cache でない場合）
    // ContextData 全体は context-{N} キーに保存（ContextTarget とは別キー）
    if (!options.noCache) {
        const cached = readContextCache("issues", `context-${number}`);
        if (cached) {
            logger.info(`Issue #${number} のキャッシュを使用します`);
            console.log(JSON.stringify(cached, null, 2));
            return 0;
        }
    }
    // Issue として取得を試みる
    const issueResult = await runGraphQL(GRAPHQL_QUERY_ISSUE_CONTEXT, { owner, name: repo, number });
    if (issueResult.success) {
        const issue = issueResult.data?.data?.repository?.issue;
        if (issue?.number) {
            return await processIssueContext(issue, owner, repo, number, logger);
        }
    }
    // PR として取得を試みる
    const prResult = await runGraphQL(GRAPHQL_QUERY_PR_CONTEXT, { owner, name: repo, number });
    if (prResult.success) {
        const pr = prResult.data?.data?.repository?.pullRequest;
        if (pr?.number) {
            return await processPRContext(pr, owner, repo, number, logger);
        }
    }
    logger.error(`#${number} が見つかりません（Issue または PR として取得を試みましたが見つかりませんでした）`);
    return 1;
}
/**
 * Issue コンテキストを処理してキャッシュに書き込む。
 */
async function processIssueContext(issue, owner, repo, number, logger) {
    const projectItems = issue.projectItems?.nodes ?? [];
    const status = extractStatusFromProjectItems(projectItems);
    // 対象 Issue の情報を整形
    const target = {
        number: issue.number ?? number,
        type: "issue",
        title: issue.title ?? "",
        body: issue.body ?? "",
        status,
        labels: (issue.labels?.nodes ?? []).map((l) => l.name ?? "").filter(Boolean),
        assignees: (issue.assignees?.nodes ?? []).map((a) => a.login ?? "").filter(Boolean),
    };
    // 親 Issue の整形
    let parent = null;
    if (issue.parent?.number) {
        const parentProjectItems = issue.parent.projectItems?.nodes ?? [];
        const parentStatus = extractStatusFromProjectItems(parentProjectItems);
        parent = {
            number: issue.parent.number,
            title: issue.parent.title ?? "",
            status: parentStatus,
        };
        // 親 Issue もキャッシュに書き込む
        writeContextCache("issues", String(issue.parent.number), {
            number: issue.parent.number,
            type: "issue",
            title: issue.parent.title ?? "",
            body: "",
            status: parentStatus,
            labels: [],
            assignees: [],
        });
    }
    // 子 Issue の整形
    const children = (issue.subIssues?.nodes ?? []).map((child) => {
        const childStatus = extractStatusFromProjectItems(child.projectItems?.nodes);
        return {
            number: child.number ?? 0,
            title: child.title ?? "",
            status: childStatus,
        };
    }).filter((c) => c.number > 0);
    // 子 Issue もキャッシュに書き込む
    for (const child of children) {
        writeContextCache("issues", String(child.number), {
            number: child.number,
            type: "issue",
            title: child.title,
            body: "",
            status: child.status,
            labels: [],
            assignees: [],
        });
    }
    // Discussion リンクの検出と取得
    const discussions = await fetchLinkedDiscussions(issue.body ?? "", owner, repo, logger);
    // 関連 PR の整形（timelineItems から）
    const pullRequests = (issue.timelineItems?.nodes ?? [])
        .map((node) => node.subject)
        .filter((pr) => pr !== undefined && pr.number !== undefined)
        .map((pr) => ({
        number: pr.number ?? 0,
        title: pr.title ?? "",
        state: pr.state ?? "",
        base: pr.baseRefName ?? "",
        head: pr.headRefName ?? "",
    }))
        .filter((pr) => pr.number > 0);
    // 最新コメントの整形
    const recentComments = (issue.comments?.nodes ?? []).map((comment) => ({
        source: `#${number}`,
        author: comment.author?.login ?? "unknown",
        body: comment.body ?? "",
        created_at: comment.createdAt ?? "",
    }));
    // コメントをキャッシュに書き込む
    if (recentComments.length > 0) {
        writeContextCache("comments", `issue-${number}`, recentComments);
    }
    // コンテキストデータをまとめる
    const contextData = {
        target,
        parent,
        children,
        discussions,
        pull_requests: pullRequests,
        recent_comments: recentComments,
    };
    // ContextTarget を他コマンド用にキャッシュ（transition/update/link/comments が参照）
    writeContextCache("issues", String(number), target);
    // ContextData 全体を items context 用にキャッシュ（cache hit 時に完全なデータを返す）
    writeContextCache("issues", `context-${number}`, contextData);
    logger.success(`Issue #${number} のコンテキストを取得しました`);
    console.log(JSON.stringify(contextData, null, 2));
    return 0;
}
/**
 * PR コンテキストを処理する。
 */
async function processPRContext(pr, owner, repo, number, logger) {
    // 対象 PR の情報を整形
    const target = {
        number: pr.number ?? number,
        type: "pull_request",
        title: pr.title ?? "",
        body: pr.body ?? "",
        labels: (pr.labels?.nodes ?? []).map((l) => l.name ?? "").filter(Boolean),
        assignees: (pr.assignees?.nodes ?? []).map((a) => a.login ?? "").filter(Boolean),
    };
    // 関連 Issue の整形（Closes #{N}）
    const closingIssues = (pr.closingIssuesReferences?.nodes ?? []).map((issue) => ({
        number: issue.number ?? 0,
        title: issue.title ?? "",
        status: undefined,
    })).filter((i) => i.number > 0);
    // Discussion リンクの検出と取得
    const discussions = await fetchLinkedDiscussions(pr.body ?? "", owner, repo, logger);
    // 最新コメントの整形
    const recentComments = (pr.comments?.nodes ?? []).map((comment) => ({
        source: `#${number}`,
        author: comment.author?.login ?? "unknown",
        body: comment.body ?? "",
        created_at: comment.createdAt ?? "",
    }));
    const contextData = {
        target,
        parent: null,
        children: closingIssues,
        discussions,
        pull_requests: [{
                number: pr.number ?? number,
                title: pr.title ?? "",
                state: pr.state ?? "",
                base: pr.baseRefName ?? "",
                head: pr.headRefName ?? "",
            }],
        recent_comments: recentComments,
    };
    // ContextData 全体を items context 用にキャッシュ（cache hit 時に完全なデータを返す）
    writeContextCache("issues", `context-${number}`, contextData);
    logger.success(`PR #${number} のコンテキストを取得しました`);
    console.log(JSON.stringify(contextData, null, 2));
    return 0;
}
/**
 * Issue / PR 本文からリンクされた Discussion を取得する。
 */
async function fetchLinkedDiscussions(body, owner, repo, logger) {
    const discussionNumbers = extractDiscussionNumbers(body, owner, repo);
    const discussions = [];
    for (const discNum of discussionNumbers) {
        const result = await runGraphQL(GRAPHQL_QUERY_DISCUSSION_CONTEXT, { owner, name: repo, number: discNum });
        if (result.success) {
            const disc = result.data?.data?.repository?.discussion;
            if (disc?.number) {
                const discussionData = {
                    number: disc.number,
                    category: disc.category?.name ?? "General",
                    title: disc.title ?? "",
                    url: disc.url ?? `https://github.com/${owner}/${repo}/discussions/${discNum}`,
                };
                discussions.push(discussionData);
            }
        }
        else {
            logger.warn(`Discussion #${discNum} の取得に失敗しました`);
        }
    }
    return discussions;
}
//# sourceMappingURL=index.js.map