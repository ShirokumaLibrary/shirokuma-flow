/**
 * items link サブコマンド (#2024 Phase 1-C)
 *
 * Issue と Discussion のリンクを管理する。
 * Issue 本文にリンクセクションを自動追記・更新し、`items context` で検出可能にする。
 *
 * 操作:
 * - (デフォルト): Issue に Discussion をリンク追加
 * - --list: リンク一覧表示
 * - --unlink #{number}: リンクを解除
 */
import { runGraphQL, parseIssueNumber, isIssueNumber } from "../../../utils/github.js";
import { resolveTargetRepo } from "../../../utils/repo-pairs.js";
import { readContextCache, writeContextCache, } from "../../../utils/context-cache.js";
// =============================================================================
// GraphQL クエリ定義
// =============================================================================
const GRAPHQL_QUERY_ISSUE_BODY = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      id
      body
    }
  }
}
`;
const GRAPHQL_QUERY_DISCUSSION_INFO = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    discussion(number: $number) {
      number
      title
      url
      category { name }
    }
  }
}
`;
const GRAPHQL_MUTATION_UPDATE_ISSUE_BODY = `
mutation($id: ID!, $body: String!) {
  updateIssue(input: {id: $id, body: $body}) {
    issue { id body }
  }
}
`;
// =============================================================================
// 定数
// =============================================================================
/** リンクセクションの見出し */
const LINK_SECTION_HEADING = "### リンク";
/** Discussion カテゴリとリンク種別の対応 */
const CATEGORY_TO_TYPE = {
    "Design": "design",
    "ADR": "adr",
    "Research": "research",
    "Knowledge": "knowledge",
};
// =============================================================================
// ヘルパー関数
// =============================================================================
/**
 * Discussion カテゴリからリンク種別を推定する。
 */
function inferLinkType(category) {
    if (!category)
        return "general";
    return CATEGORY_TO_TYPE[category] ?? "general";
}
/**
 * Issue 本文からリンクセクションをパースする。
 */
function parseLinkSection(body) {
    const sectionIndex = body.indexOf(LINK_SECTION_HEADING);
    if (sectionIndex === -1)
        return [];
    const sectionContent = body.slice(sectionIndex);
    const lines = sectionContent.split("\n");
    const entries = [];
    for (const line of lines) {
        // テーブル行をパース: | Design | #D120 |
        const tableMatch = line.match(/^\|\s*(\w+)\s*\|\s*#D(\d+)\s*\|/);
        if (tableMatch) {
            entries.push({
                discussion: parseInt(tableMatch[2], 10),
                type: tableMatch[1].toLowerCase(),
            });
        }
    }
    return entries;
}
/**
 * Issue 本文にリンクセクションを追記または更新する。
 */
function upsertLinkSection(body, entry) {
    const newRow = `| ${capitalizeFirst(entry.type)} | #D${entry.discussion} |`;
    const sectionIndex = body.indexOf(LINK_SECTION_HEADING);
    if (sectionIndex === -1) {
        // セクションが存在しない場合は末尾に追記
        const section = `\n\n${LINK_SECTION_HEADING}\n\n| 種別 | リンク |\n|------|-------|\n${newRow}\n`;
        return body.trimEnd() + section;
    }
    // セクションが存在する場合はテーブルに行を追加
    const before = body.slice(0, sectionIndex);
    const sectionContent = body.slice(sectionIndex);
    // テーブルの最後の行を見つけて追加
    const tableEndMatch = sectionContent.match(/(.*\|.*\n)(?!\|)/s);
    if (tableEndMatch) {
        const insertPos = sectionIndex + tableEndMatch.index + tableEndMatch[0].length - (tableEndMatch[0].endsWith("\n") ? 1 : 0);
        return body.slice(0, insertPos) + "\n" + newRow + body.slice(insertPos);
    }
    return body.trimEnd() + "\n" + newRow + "\n";
}
/**
 * Issue 本文からリンクセクションの指定 Discussion を削除する。
 */
function removeLinkFromSection(body, discussionNumber) {
    const rowPattern = new RegExp(`^\\|[^|]+\\| #D${discussionNumber} \\|.*$\\n?`, "m");
    return body.replace(rowPattern, "");
}
/**
 * 文字列の先頭を大文字にする。
 */
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
// =============================================================================
// コマンドエントリポイント
// =============================================================================
/**
 * items link サブコマンド
 *
 * Issue と Discussion のリンクを管理する。
 */
export async function cmdItemLink(numberStr, options, logger) {
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
    const issueNumber = parseIssueNumber(numberStr);
    // --list: リンク一覧表示
    if (options.list) {
        return await listLinks(owner, repo, issueNumber, logger);
    }
    // --unlink: リンク解除
    if (options.unlink) {
        const discNumber = parseIssueNumber(options.unlink);
        return await unlinkDiscussion(owner, repo, issueNumber, discNumber, logger);
    }
    // デフォルト: リンク追加
    if (!options.discussion) {
        logger.error("--discussion オプションで Discussion 番号を指定してください");
        return 1;
    }
    const discNumber = parseIssueNumber(options.discussion);
    return await addLink(owner, repo, issueNumber, discNumber, options.type, logger);
}
/**
 * Discussion を Issue にリンクする。
 */
async function addLink(owner, repo, issueNumber, discussionNumber, typeOption, logger) {
    // Issue 本文を取得
    const issueResult = await runGraphQL(GRAPHQL_QUERY_ISSUE_BODY, { owner, name: repo, number: issueNumber });
    if (!issueResult.success || !issueResult.data?.data?.repository?.issue) {
        logger.error(`Issue #${issueNumber} が見つかりません`);
        return 1;
    }
    const issueNode = issueResult.data.data.repository.issue;
    const issueId = issueNode.id ?? "";
    const currentBody = issueNode.body ?? "";
    // 重複チェック
    const existingLinks = parseLinkSection(currentBody);
    if (existingLinks.some((l) => l.discussion === discussionNumber)) {
        logger.warn(`Discussion #D${discussionNumber} は既にリンクされています`);
        console.log(JSON.stringify({
            issue: issueNumber,
            discussion: discussionNumber,
            result: "already_linked",
        }, null, 2));
        return 0;
    }
    // Discussion 情報を取得
    const discResult = await runGraphQL(GRAPHQL_QUERY_DISCUSSION_INFO, { owner, name: repo, number: discussionNumber });
    if (!discResult.success || !discResult.data?.data?.repository?.discussion) {
        logger.error(`Discussion #${discussionNumber} が見つかりません`);
        return 1;
    }
    const discNode = discResult.data.data.repository.discussion;
    const linkType = typeOption ?? inferLinkType(discNode.category?.name);
    const url = discNode.url ?? `https://github.com/${owner}/${repo}/discussions/${discussionNumber}`;
    // リンクエントリを作成
    const entry = {
        discussion: discussionNumber,
        type: linkType,
        title: discNode.title,
        category: discNode.category?.name,
        url,
    };
    // 本文を更新
    const newBody = upsertLinkSection(currentBody, entry);
    const updateResult = await runGraphQL(GRAPHQL_MUTATION_UPDATE_ISSUE_BODY, { id: issueId, body: newBody });
    if (!updateResult.success) {
        logger.error(`Issue #${issueNumber} の本文更新に失敗しました`);
        return 1;
    }
    // キャッシュを更新
    const cached = readContextCache("issues", String(issueNumber));
    if (cached) {
        writeContextCache("issues", String(issueNumber), { ...cached, body: newBody });
    }
    logger.success(`Issue #${issueNumber} に Discussion #D${discussionNumber} をリンクしました`);
    console.log(JSON.stringify({
        issue: issueNumber,
        discussion: discussionNumber,
        type: linkType,
        url,
        result: "ok",
    }, null, 2));
    return 0;
}
/**
 * リンク一覧を表示する。
 */
async function listLinks(owner, repo, issueNumber, logger) {
    let body;
    // キャッシュから取得を試みる
    const cached = readContextCache("issues", String(issueNumber));
    if (cached?.body) {
        body = cached.body;
    }
    else {
        // API から取得
        const issueResult = await runGraphQL(GRAPHQL_QUERY_ISSUE_BODY, { owner, name: repo, number: issueNumber });
        if (!issueResult.success || !issueResult.data?.data?.repository?.issue) {
            logger.error(`Issue #${issueNumber} が見つかりません`);
            return 1;
        }
        body = issueResult.data.data.repository.issue.body ?? "";
    }
    const links = parseLinkSection(body);
    // 各 Discussion の詳細を取得
    const detailedLinks = [];
    for (const link of links) {
        const discResult = await runGraphQL(GRAPHQL_QUERY_DISCUSSION_INFO, { owner, name: repo, number: link.discussion });
        if (discResult.success && discResult.data?.data?.repository?.discussion) {
            const disc = discResult.data.data.repository.discussion;
            detailedLinks.push({
                ...link,
                title: disc.title,
                category: disc.category?.name,
                url: disc.url ?? `https://github.com/${owner}/${repo}/discussions/${link.discussion}`,
            });
        }
        else {
            detailedLinks.push(link);
        }
    }
    console.log(JSON.stringify({
        issue: issueNumber,
        links: detailedLinks,
    }, null, 2));
    return 0;
}
/**
 * Discussion のリンクを解除する。
 */
async function unlinkDiscussion(owner, repo, issueNumber, discussionNumber, logger) {
    // Issue 本文を取得
    const issueResult = await runGraphQL(GRAPHQL_QUERY_ISSUE_BODY, { owner, name: repo, number: issueNumber });
    if (!issueResult.success || !issueResult.data?.data?.repository?.issue) {
        logger.error(`Issue #${issueNumber} が見つかりません`);
        return 1;
    }
    const issueNode = issueResult.data.data.repository.issue;
    const issueId = issueNode.id ?? "";
    const currentBody = issueNode.body ?? "";
    // リンクが存在するか確認
    const existingLinks = parseLinkSection(currentBody);
    if (!existingLinks.some((l) => l.discussion === discussionNumber)) {
        logger.warn(`Discussion #D${discussionNumber} はリンクされていません`);
        return 0;
    }
    // リンクを削除した本文を生成
    const newBody = removeLinkFromSection(currentBody, discussionNumber);
    const updateResult = await runGraphQL(GRAPHQL_MUTATION_UPDATE_ISSUE_BODY, { id: issueId, body: newBody });
    if (!updateResult.success) {
        logger.error(`Issue #${issueNumber} の本文更新に失敗しました`);
        return 1;
    }
    // キャッシュを更新
    const cached = readContextCache("issues", String(issueNumber));
    if (cached) {
        writeContextCache("issues", String(issueNumber), { ...cached, body: newBody });
    }
    logger.success(`Issue #${issueNumber} から Discussion #D${discussionNumber} のリンクを解除しました`);
    console.log(JSON.stringify({
        issue: issueNumber,
        discussion: discussionNumber,
        result: "ok",
    }, null, 2));
    return 0;
}
//# sourceMappingURL=index.js.map