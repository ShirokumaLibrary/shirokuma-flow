/**
 * items transition サブコマンド (#2024 Phase 1)
 *
 * Issue のステータス遷移を検証付きで実行する。
 * 不正な遷移を防ぎ、ワークフローの整合性を CLI レベルで保証する。
 *
 * - status-workflow.ts の validateStatusTransition と STATUS_TRANSITIONS を使用
 * - Draft → Backlog 遷移時は Issue をプロジェクトに追加
 * - --to Blocked 時は --reason が必須（reason は Issue コメントとして記録）
 * - キャッシュを優先参照し、なければ API フォールバック
 */
import { runGraphQL, parseIssueNumber, isIssueNumber } from "../../../utils/github.js";
import { resolveTargetRepo } from "../../../utils/repo-pairs.js";
import { validateStatusTransition, STATUS_TRANSITIONS, STATUS_VALUES, } from "../../../utils/status-workflow.js";
import { resolveAndUpdateStatus, getIssueDetail, getPrDetail, resolvePrAndUpdateStatus } from "../../../utils/issue-detail.js";
import { readContextCache, writeContextCache, } from "../../../utils/context-cache.js";
import { getProjectId, } from "../../../utils/project-utils.js";
import { getProjectFields, addItemToProject, } from "../../../utils/project-fields.js";
import { getIssueId } from "../helpers.js";
import { GRAPHQL_MUTATION_ADD_COMMENT, } from "../../../utils/graphql-queries.js";
import { checkChildrenAllDone } from "../../../utils/parent-status.js";
// =============================================================================
// ヘルパー
// =============================================================================
/** GraphQL クエリ: Issue の現在のステータスを取得 */
const GRAPHQL_QUERY_ISSUE_STATUS = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      id
      title
      state
      projectItems(first: 5) {
        nodes {
          id
          project { id title }
          status: fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue { name optionId }
          }
        }
      }
    }
  }
}
`;
/**
 * キャッシュまたは API から現在のステータスを取得する。
 * Issue クエリで見つからない場合は PR にフォールバックする。
 *
 * @returns status（現在のステータス）、isPr（PR 番号かどうか）、fromCache（キャッシュから取得したかどうか）
 */
async function getCurrentStatus(owner, repo, number, logger) {
    const cached = readContextCache("issues", String(number));
    if (cached?.status) {
        logger.info(`Issue #${number} のステータスをキャッシュから取得: ${cached.status}`);
        return { status: cached.status, fromCache: true, isPr: false };
    }
    const issueResult = await runGraphQL(GRAPHQL_QUERY_ISSUE_STATUS, { owner, name: repo, number });
    if (issueResult.success) {
        const issueData = issueResult.data?.data?.repository?.issue;
        if (issueData) {
            const projectItems = issueData.projectItems?.nodes ?? [];
            for (const item of projectItems) {
                if (item.status?.name) {
                    return { status: item.status.name, fromCache: false, isPr: false };
                }
            }
            return { status: null, fromCache: false, isPr: false };
        }
    }
    const prDetail = await getPrDetail(owner, repo, number);
    if (prDetail) {
        return { status: prDetail.status ?? null, fromCache: false, isPr: true };
    }
    return { status: null, fromCache: false, isPr: false };
}
// =============================================================================
// コマンドエントリポイント
// =============================================================================
/**
 * items transition サブコマンド
 *
 * Issue のステータス遷移を検証付きで実行する。
 */
export async function cmdItemTransition(numberStr, options, logger) {
    if (!isIssueNumber(numberStr)) {
        logger.error("有効なアイテム番号を指定してください");
        return 1;
    }
    if (!options.to) {
        logger.error("--to オプションでステータスを指定してください");
        return 1;
    }
    // Blocked 遷移時は reason 必須（whitespace のみは無効）
    if (options.to === STATUS_VALUES.BLOCKED && !options.reason?.trim()) {
        logger.error(`--to ${STATUS_VALUES.BLOCKED} 遷移には --reason が必須です（例: --reason "外部 API の障害待ち"）`);
        return 2;
    }
    const repoInfo = resolveTargetRepo(options);
    if (!repoInfo) {
        logger.error("リポジトリを特定できません");
        return 1;
    }
    const { owner, name: repo } = repoInfo;
    const number = parseIssueNumber(numberStr);
    const targetStatus = options.to;
    // 現在のステータスを取得（Issue または PR を自動判別）
    const { status: currentStatus, isPr } = await getCurrentStatus(owner, repo, number, logger);
    // 遷移ルールを検証
    if (!options.force) {
        const validation = validateStatusTransition(currentStatus, targetStatus);
        if (!validation.valid) {
            const allowedTransitions = currentStatus
                ? (STATUS_TRANSITIONS[currentStatus] ?? [])
                : [];
            const result = {
                number,
                from: currentStatus,
                to: targetStatus,
                result: "error",
                message: `${currentStatus ?? "(Draft)"} → ${targetStatus} は許可されていません`,
                allowed_transitions: [...allowedTransitions],
            };
            logger.error(result.message ?? "遷移が許可されていません");
            console.log(JSON.stringify(result, null, 2));
            return 1;
        }
    }
    // 親 Issue の Done 遷移ガード（--to Done かつ Issue のみ、--force で API call ごと省略）
    if (targetStatus === STATUS_VALUES.DONE && !isPr) {
        if (options.force) {
            logger.warn("--force: 子 Issue 未完了ガードをバイパスして強制遷移します");
        }
        else {
            const check = await checkChildrenAllDone(owner, repo, number);
            if (!check.allDone) {
                const nums = check.openChildren.map((c) => `#${c.number}`).join(", ");
                const errorResult = {
                    number,
                    from: currentStatus,
                    to: targetStatus,
                    result: "error",
                    message: `子 Issue ${nums} が未完了です。全子 Issue の完了後に再実行してください（強制する場合は --force）`,
                };
                logger.error(errorResult.message ?? "子 Issue が未完了です");
                console.log(JSON.stringify(errorResult, null, 2));
                return 4;
            }
        }
    }
    // Draft → Backlog 遷移の場合、Issue をプロジェクトに追加（#2202: 旧 Draft → Ready を Backlog に統合）
    if (!currentStatus && targetStatus === STATUS_VALUES.BACKLOG) {
        const addResult = await addIssueToDraftProject(owner, repo, number, logger);
        if (!addResult) {
            logger.warn("Issue のプロジェクトへの追加に失敗しました。ステータス更新は続行します");
        }
    }
    const updateResult = isPr
        ? await resolvePrAndUpdateStatus(owner, repo, number, targetStatus, logger)
        : await resolveAndUpdateStatus(owner, repo, number, targetStatus, logger);
    if (!updateResult.success) {
        const result = {
            number,
            from: currentStatus,
            to: targetStatus,
            result: "error",
            message: `ステータスの更新に失敗しました: ${updateResult.reason ?? "unknown"}`,
        };
        logger.error(result.message ?? "ステータス更新に失敗しました");
        console.log(JSON.stringify(result, null, 2));
        return 1;
    }
    // キャッシュを更新
    const cached = readContextCache("issues", String(number));
    if (cached) {
        writeContextCache("issues", String(number), { ...cached, status: targetStatus });
    }
    // Blocked 遷移時は reason を Issue コメントとして記録
    if (targetStatus === STATUS_VALUES.BLOCKED && options.reason && !isPr) {
        const subjectId = await getIssueId(owner, repo, number);
        if (subjectId) {
            const body = `**Blocked:** ${options.reason}`;
            await runGraphQL(GRAPHQL_MUTATION_ADD_COMMENT, { subjectId, body });
            logger.info(`Issue #${number}: Blocked reason を記録しました`);
        }
        else {
            logger.warn(`Issue #${number}: reason コメントの投稿に失敗しました（ID 解決不可）`);
        }
    }
    const result = {
        number,
        from: currentStatus,
        to: targetStatus,
        result: "ok",
    };
    logger.success(`Issue #${number}: ${currentStatus ?? "(Draft)"} → ${targetStatus}`);
    console.log(JSON.stringify(result, null, 2));
    return 0;
}
/**
 * Issue をプロジェクトに追加する（Draft → Ready 遷移時）。
 */
async function addIssueToDraftProject(owner, repo, issueNumber, logger) {
    try {
        // Issue の GraphQL ID を取得
        const issueDetail = await getIssueDetail(owner, repo, issueNumber);
        if (issueDetail?.projectId) {
            // 既にプロジェクトに追加済み
            return true;
        }
        // プロジェクト ID を取得
        const projectId = await getProjectId(owner, repo);
        if (!projectId) {
            logger.warn("プロジェクト ID が見つかりません");
            return false;
        }
        // Issue の GraphQL ID を取得
        const GRAPHQL_QUERY_ISSUE_ID = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) { id }
  }
}
`;
        const idResult = await runGraphQL(GRAPHQL_QUERY_ISSUE_ID, { owner, name: repo, number: issueNumber });
        if (!idResult.success)
            return false;
        const issueId = idResult.data?.data?.repository?.issue?.id;
        if (!issueId)
            return false;
        // プロジェクトフィールドを取得
        const projectFields = await getProjectFields(projectId);
        if (!projectFields)
            return false;
        // Issue をプロジェクトに追加
        const addResult = await addItemToProject(projectId, issueId, logger);
        return addResult !== null;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=index.js.map