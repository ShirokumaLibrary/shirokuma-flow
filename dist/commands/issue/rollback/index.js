/**
 * items rollback サブコマンド (#2024 Phase 1-D)
 *
 * 指定された Issue / PR に対して切り戻し操作をアトミックに実行する。
 *
 * アクション:
 * - cancel: 課題・計画のキャンセル（子 Issue unparent + PR クローズ + ブランチ削除 + ステータス変更）
 * - reset: 計画を作業前（Ready）に戻す（area:plan ラベルチェック）
 * - revert: revert ブランチ作成 + revert PR 作成
 */
import { runGraphQL, parseIssueNumber, isIssueNumber } from "../../../utils/github.js";
import { getOctokit } from "../../../utils/octokit-client.js";
import { resolveTargetRepo } from "../../../utils/repo-pairs.js";
import { resolveAndUpdateStatus } from "../../../utils/issue-detail.js";
import { STATUS_VALUES } from "../../../utils/status-workflow.js";
import { execFileAsync } from "../../../utils/spawn-async.js";
import { closeIssueById } from "../../items/integrity/index.js";
import { getIssueId } from "../../items/helpers.js";
// =============================================================================
// GraphQL クエリ定義
// =============================================================================
const GRAPHQL_QUERY_ISSUE_FOR_ROLLBACK = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      id
      number
      title
      state
      labels(first: 20) { nodes { name } }
      parent { number title }
      subIssues(first: 50) {
        nodes {
          id
          number
          title
          state
          labels(first: 20) { nodes { name } }
          projectItems(first: 5) {
            nodes {
              status: fieldValueByName(name: "Status") {
                ... on ProjectV2ItemFieldSingleSelectValue { name }
              }
            }
          }
        }
      }
      timelineItems(first: 10, itemTypes: [CONNECTED_EVENT]) {
        nodes {
          ... on ConnectedEvent {
            subject {
              ... on PullRequest {
                number
                title
                state
                headRefName
                baseRefName
                mergeCommit { oid }
              }
            }
          }
        }
      }
      projectItems(first: 5) {
        nodes {
          status: fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue { name }
          }
        }
      }
    }
  }
}
`;
const GRAPHQL_MUTATION_UNPARENT_ISSUE = `
mutation($issueId: ID!, $parentId: ID!) {
  removeSubIssue(input: {issueId: $issueId, parentIssueId: $parentId}) {
    issue { id number }
  }
}
`;
const GRAPHQL_MUTATION_CLOSE_PR = `
mutation($pullRequestId: ID!) {
  closePullRequest(input: {pullRequestId: $pullRequestId}) {
    pullRequest { id number state }
  }
}
`;
const GRAPHQL_QUERY_PR_FOR_ROLLBACK = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      id
      number
      title
      state
      headRefName
      baseRefName
      mergeCommit { oid }
      closingIssuesReferences(first: 10) {
        nodes {
          number
          title
          state
        }
      }
    }
  }
}
`;
// =============================================================================
// ヘルパー関数
// =============================================================================
/**
 * リモートブランチを削除する。
 */
async function deleteBranch(branch, logger, dryRun = false) {
    if (dryRun) {
        return { type: "branch_delete", branch, result: "skipped", message: "dry-run" };
    }
    // リモートブランチを削除
    const remoteResult = await execFileAsync("git", ["push", "origin", "--delete", branch]);
    if (remoteResult.exitCode !== 0 && !remoteResult.stderr.includes("remote ref does not exist")) {
        logger.warn(`リモートブランチ ${branch} の削除に失敗しました: ${remoteResult.stderr}`);
    }
    // ローカルブランチを削除（存在する場合）
    const localResult = await execFileAsync("git", ["branch", "-D", branch]);
    if (localResult.exitCode !== 0) {
        // ローカルに存在しない場合はスキップ
    }
    return { type: "branch_delete", branch, result: "ok" };
}
/**
 * PR をクローズする。
 */
async function closePR(owner, repo, prNumber, logger, dryRun = false) {
    if (dryRun) {
        return { type: "pr_close", number: prNumber, result: "skipped", message: "dry-run" };
    }
    // PR の GraphQL ID を取得
    const octokit = getOctokit();
    // REST API で PR の node_id を取得
    try {
        const { data: pr } = await octokit.rest.pulls.get({
            owner,
            repo,
            pull_number: prNumber,
        });
        if (pr.state !== "open") {
            return { type: "pr_close", number: prNumber, result: "skipped", message: "already closed" };
        }
        // PR をクローズ
        await octokit.rest.pulls.update({
            owner,
            repo,
            pull_number: prNumber,
            state: "closed",
        });
        logger.success(`PR #${prNumber} をクローズしました`);
        return { type: "pr_close", number: prNumber, result: "ok" };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`PR #${prNumber} のクローズに失敗しました: ${msg}`);
        return { type: "pr_close", number: prNumber, result: "error", message: msg };
    }
}
// =============================================================================
// cancel アクション
// =============================================================================
/**
 * cancel: 課題・計画をキャンセルする。
 */
async function actionCancel(owner, repo, number, issue, options, logger) {
    const operations = [];
    const errors = [];
    const currentStatus = issue.projectItems?.nodes?.[0]?.status?.name ?? "Unknown";
    // 1. 子 Issue の unparent + キャンセル
    const subIssues = issue.subIssues?.nodes ?? [];
    for (const subIssue of subIssues) {
        if (!subIssue.number || subIssue.state === "CLOSED")
            continue;
        if (options.dryRun) {
            operations.push({ type: "unparent", number: subIssue.number, result: "skipped", message: "dry-run" });
            // #2204: Cancelled を廃止。Done + state_reason: not_planned で識別
            operations.push({ type: "status_change", number: subIssue.number, from: undefined, to: "Done", result: "skipped", message: "dry-run" });
            continue;
        }
        // unparent
        if (issue.id && subIssue.id) {
            const unparentResult = await runGraphQL(GRAPHQL_MUTATION_UNPARENT_ISSUE, { issueId: subIssue.id, parentId: issue.id });
            if (unparentResult.success) {
                operations.push({ type: "unparent", number: subIssue.number, result: "ok" });
            }
            else {
                const msg = `子 Issue #${subIssue.number} の unparent に失敗しました`;
                errors.push(msg);
                operations.push({ type: "unparent", number: subIssue.number, result: "error", message: msg });
            }
        }
        // 子 Issue を Done に更新（#2204: Cancelled 廃止。Done + state_reason: not_planned で識別）
        const subStatus = subIssue.projectItems?.nodes?.[0]?.status?.name;
        const statusResult = await resolveAndUpdateStatus(owner, repo, subIssue.number, STATUS_VALUES.DONE, logger);
        if (statusResult.success) {
            operations.push({ type: "status_change", number: subIssue.number, from: subStatus, to: STATUS_VALUES.DONE, result: "ok" });
        }
        else {
            errors.push(`子 Issue #${subIssue.number} のステータス更新に失敗しました`);
            operations.push({ type: "status_change", number: subIssue.number, from: subStatus, to: STATUS_VALUES.DONE, result: "error" });
        }
    }
    // 2. 関連 PR をクローズ
    const connectedPRs = (issue.timelineItems?.nodes ?? [])
        .map((n) => n.subject)
        .filter((pr) => pr?.number !== undefined);
    for (const pr of connectedPRs) {
        if (!pr.number)
            continue;
        const op = await closePR(owner, repo, pr.number, logger, options.dryRun);
        operations.push(op);
        // PR のブランチを削除
        if (pr.headRefName && !options.dryRun) {
            const branchOp = await deleteBranch(pr.headRefName, logger, options.dryRun);
            operations.push(branchOp);
        }
        else if (pr.headRefName) {
            operations.push({ type: "branch_delete", branch: pr.headRefName, result: "skipped", message: "dry-run" });
        }
    }
    // 3. 対象 Issue のステータスを Done に変更（#2204: Cancelled 廃止。Done + state_reason: not_planned で識別）
    if (options.dryRun) {
        operations.push({ type: "status_change", number, from: currentStatus, to: STATUS_VALUES.DONE, result: "skipped", message: "dry-run" });
    }
    else {
        const statusResult = await resolveAndUpdateStatus(owner, repo, number, STATUS_VALUES.DONE, logger);
        if (statusResult.success) {
            // Issue をクローズ
            const issueId = await getIssueId(owner, repo, number);
            if (issueId) {
                await closeIssueById(issueId);
            }
            operations.push({ type: "status_change", number, from: currentStatus, to: STATUS_VALUES.DONE, result: "ok" });
        }
        else {
            const msg = `Issue #${number} のステータス更新に失敗しました`;
            errors.push(msg);
            operations.push({ type: "status_change", number, from: currentStatus, to: STATUS_VALUES.DONE, result: "error", message: msg });
        }
    }
    return {
        action: "cancel",
        target: { number, status: options.dryRun ? currentStatus : STATUS_VALUES.DONE },
        operations,
        errors,
    };
}
// =============================================================================
// reset アクション
// =============================================================================
/**
 * reset: 計画 Issue を Ready に戻す。
 * 対象は計画 Issue（area:plan ラベル）のみ。
 */
async function actionReset(owner, repo, number, issue, options, logger) {
    const operations = [];
    const errors = [];
    // area:plan ラベルチェック
    const labels = (issue.labels?.nodes ?? []).map((l) => l.name ?? "");
    if (!labels.includes("area:plan")) {
        const msg = "reset は計画 Issue（area:plan ラベル）のみを対象とします。課題 Issue には items transition を使用してください";
        logger.error(msg);
        return {
            action: "reset",
            target: { number, status: "error" },
            operations: [],
            errors: [msg],
        };
    }
    const currentStatus = issue.projectItems?.nodes?.[0]?.status?.name ?? "Unknown";
    // 1. 関連 PR をクローズ
    const connectedPRs = (issue.timelineItems?.nodes ?? [])
        .map((n) => n.subject)
        .filter((pr) => pr?.number !== undefined && pr.state === "OPEN");
    for (const pr of connectedPRs) {
        if (!pr.number)
            continue;
        const op = await closePR(owner, repo, pr.number, logger, options.dryRun);
        operations.push(op);
        // PR のブランチを削除
        if (pr.headRefName) {
            const branchOp = await deleteBranch(pr.headRefName, logger, options.dryRun);
            operations.push(branchOp);
        }
    }
    // 2. 計画 Issue を Backlog に戻す（#2202: Ready は Backlog に統合）
    if (options.dryRun) {
        operations.push({ type: "status_change", number, from: currentStatus, to: STATUS_VALUES.BACKLOG, result: "skipped", message: "dry-run" });
    }
    else {
        const statusResult = await resolveAndUpdateStatus(owner, repo, number, STATUS_VALUES.BACKLOG, logger);
        if (statusResult.success) {
            operations.push({ type: "status_change", number, from: currentStatus, to: STATUS_VALUES.BACKLOG, result: "ok" });
        }
        else {
            const msg = `Issue #${number} のステータス更新に失敗しました`;
            errors.push(msg);
            operations.push({ type: "status_change", number, from: currentStatus, to: STATUS_VALUES.BACKLOG, result: "error", message: msg });
        }
    }
    return {
        action: "reset",
        target: { number, status: options.dryRun ? currentStatus : STATUS_VALUES.BACKLOG },
        operations,
        errors,
    };
}
// =============================================================================
// revert アクション
// =============================================================================
/**
 * revert: マージ済みの PR を revert する。
 */
async function actionRevert(owner, repo, number, issue, options, logger) {
    const operations = [];
    const errors = [];
    // マージ済み PR を特定
    const mergedPRs = (issue.timelineItems?.nodes ?? [])
        .map((n) => n.subject)
        .filter((pr) => pr?.number !== undefined && pr.state === "MERGED");
    if (mergedPRs.length === 0) {
        const msg = "マージ済みの PR が見つかりません";
        logger.error(msg);
        return {
            action: "revert",
            target: { number, status: "error" },
            operations: [],
            errors: [msg],
        };
    }
    // 最後にマージされた PR を revert
    const targetPR = mergedPRs[mergedPRs.length - 1];
    if (!targetPR.number || !targetPR.mergeCommit?.oid) {
        const msg = "マージコミットが見つかりません";
        logger.error(msg);
        return {
            action: "revert",
            target: { number, status: "error" },
            operations: [],
            errors: [msg],
        };
    }
    const mergeCommit = targetPR.mergeCommit.oid;
    const revertBranchName = `revert/pr-${targetPR.number}`;
    if (options.dryRun) {
        operations.push({ type: "revert_branch_create", branch: revertBranchName, result: "skipped", message: "dry-run" });
        operations.push({ type: "revert_commit", result: "skipped", message: "dry-run" });
        operations.push({ type: "revert_pr_create", result: "skipped", message: "dry-run" });
        return {
            action: "revert",
            target: { number, status: "dry-run" },
            operations,
            errors,
        };
    }
    // revert ブランチを作成
    await execFileAsync("git", ["fetch", "origin"]);
    const checkoutResult = await execFileAsync("git", [
        "checkout",
        "-b",
        revertBranchName,
        `origin/${targetPR.baseRefName ?? "develop"}`,
    ]);
    if (checkoutResult.exitCode !== 0) {
        const msg = `revert ブランチ ${revertBranchName} の作成に失敗しました`;
        errors.push(msg);
        return {
            action: "revert",
            target: { number, status: "error" },
            operations,
            errors,
        };
    }
    operations.push({ type: "revert_branch_create", branch: revertBranchName, result: "ok" });
    // git revert を実行
    const revertResult = await execFileAsync("git", ["revert", "-m", "1", "--no-commit", mergeCommit]);
    if (revertResult.exitCode !== 0) {
        const msg = `git revert に失敗しました: ${revertResult.stderr}`;
        errors.push(msg);
        operations.push({ type: "revert_commit", result: "error", message: msg });
        return {
            action: "revert",
            target: { number, status: "error" },
            operations,
            errors,
        };
    }
    // コミット
    await execFileAsync("git", ["commit", "-m", `Revert "PR #${targetPR.number}: ${targetPR.title ?? ""}"`]);
    // プッシュ
    const pushResult = await execFileAsync("git", ["push", "-u", "origin", revertBranchName]);
    if (pushResult.exitCode !== 0) {
        const msg = `revert ブランチのプッシュに失敗しました`;
        errors.push(msg);
        operations.push({ type: "revert_commit", result: "error", message: msg });
        return {
            action: "revert",
            target: { number, status: "error" },
            operations,
            errors,
        };
    }
    operations.push({ type: "revert_commit", result: "ok" });
    // revert PR を作成
    try {
        const octokit = getOctokit();
        const { data: newPR } = await octokit.rest.pulls.create({
            owner,
            repo,
            title: `Revert: PR #${targetPR.number}`,
            body: `PR #${targetPR.number} の変更を取り消します。\n\nCloses #${number}`,
            head: revertBranchName,
            base: targetPR.baseRefName ?? "develop",
        });
        operations.push({ type: "revert_pr_create", number: newPR.number, result: "ok" });
        // 計画 Issue → Backlog
        const currentStatus = issue.projectItems?.nodes?.[0]?.status?.name ?? "Unknown";
        const planStatusResult = await resolveAndUpdateStatus(owner, repo, number, STATUS_VALUES.BACKLOG, logger);
        if (planStatusResult.success) {
            operations.push({ type: "status_change", number, from: currentStatus, to: STATUS_VALUES.BACKLOG, result: "ok" });
        }
        return {
            action: "revert",
            target: { number, status: STATUS_VALUES.BACKLOG },
            operations,
            errors,
        };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`revert PR の作成に失敗しました: ${msg}`);
        operations.push({ type: "revert_pr_create", result: "error", message: msg });
        return {
            action: "revert",
            target: { number, status: "error" },
            operations,
            errors,
        };
    }
}
// =============================================================================
// コマンドエントリポイント
// =============================================================================
/**
 * items rollback サブコマンド
 *
 * Issue に対して切り戻し操作を実行する。
 */
export async function cmdItemRollback(numberStr, options, logger) {
    if (!isIssueNumber(numberStr)) {
        logger.error("有効なアイテム番号を指定してください");
        return 1;
    }
    const validActions = ["cancel", "reset", "revert"];
    if (!validActions.includes(options.action)) {
        logger.error(`アクションは ${validActions.join(", ")} のいずれかを指定してください`);
        return 1;
    }
    const repoInfo = resolveTargetRepo(options);
    if (!repoInfo) {
        logger.error("リポジトリを特定できません");
        return 1;
    }
    const { owner, name: repo } = repoInfo;
    const number = parseIssueNumber(numberStr);
    // Issue 情報を取得
    const issueResult = await runGraphQL(GRAPHQL_QUERY_ISSUE_FOR_ROLLBACK, { owner, name: repo, number });
    if (!issueResult.success || !issueResult.data?.data?.repository?.issue) {
        logger.error(`Issue #${number} が見つかりません`);
        return 1;
    }
    const issue = issueResult.data.data.repository.issue;
    let result;
    switch (options.action) {
        case "cancel":
            result = await actionCancel(owner, repo, number, issue, options, logger);
            break;
        case "reset":
            result = await actionReset(owner, repo, number, issue, options, logger);
            break;
        case "revert":
            result = await actionRevert(owner, repo, number, issue, options, logger);
            break;
        default:
            logger.error(`不明なアクション: ${options.action}`);
            return 1;
    }
    const hasErrors = result.errors.length > 0;
    if (hasErrors) {
        logger.warn(`一部の操作に失敗しました: ${result.errors.join(", ")}`);
    }
    else {
        logger.success(`rollback ${options.action} が完了しました`);
    }
    console.log(JSON.stringify(result, null, 2));
    return hasErrors ? 1 : 0;
}
//# sourceMappingURL=index.js.map