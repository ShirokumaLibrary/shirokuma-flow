/**
 * items assign/unassign - Issue 担当者管理ロジック (#1810)
 */

import { parseIssueNumber } from "../../../utils/github.js";
import { resolveTargetRepo } from "../../../utils/repo-pairs.js";
import { getOctokit } from "../../../utils/octokit-client.js";
import type { Logger } from "../../../utils/logger.js";
import type { ItemsOptions } from "../../items/types.js";

// =============================================================================
// ヘルパー
// =============================================================================

/** @me を認証ユーザーのログインに解決する */
async function resolveLogin(loginOrMe: string): Promise<string> {
  if (loginOrMe !== "@me") return loginOrMe;
  const octokit = getOctokit();
  const { data } = await octokit.rest.users.getAuthenticated();
  return data.login;
}

// =============================================================================
// Commands
// =============================================================================

/**
 * items assign - Issue に担当者を追加する。
 * @me を指定した場合は認証ユーザーに解決する。
 */
export async function cmdItemAssign(
  issueNumberStr: string,
  userInput: string,
  options: ItemsOptions,
  logger: Logger
): Promise<number> {
  const repoInfo = resolveTargetRepo(options);
  if (!repoInfo) {
    logger.error("リポジトリを特定できません");
    return 1;
  }

  const { owner, name: repo } = repoInfo;
  const issueNumber = parseIssueNumber(issueNumberStr);

  let login: string;
  try {
    login = await resolveLogin(userInput);
  } catch (e) {
    logger.error(`@me の解決に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }

  try {
    const octokit = getOctokit();
    await octokit.rest.issues.addAssignees({
      owner,
      repo,
      issue_number: issueNumber,
      assignees: [login],
    });
  } catch (e) {
    logger.error(`担当者の追加に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }

  logger.success(`Issue #${issueNumber} に担当者を追加しました: ${login}`);

  console.log(JSON.stringify({
    number: issueNumber,
    action: "assigned",
    user: login,
  }, null, 2));
  return 0;
}

/**
 * items unassign - Issue から担当者を削除する。
 * @me を指定した場合は認証ユーザーに解決する。
 */
export async function cmdItemUnassign(
  issueNumberStr: string,
  userInput: string,
  options: ItemsOptions,
  logger: Logger
): Promise<number> {
  const repoInfo = resolveTargetRepo(options);
  if (!repoInfo) {
    logger.error("リポジトリを特定できません");
    return 1;
  }

  const { owner, name: repo } = repoInfo;
  const issueNumber = parseIssueNumber(issueNumberStr);

  let login: string;
  try {
    login = await resolveLogin(userInput);
  } catch (e) {
    logger.error(`@me の解決に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }

  try {
    const octokit = getOctokit();
    await octokit.rest.issues.removeAssignees({
      owner,
      repo,
      issue_number: issueNumber,
      assignees: [login],
    });
  } catch (e) {
    logger.error(`担当者の削除に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }

  logger.success(`Issue #${issueNumber} から担当者を削除しました: ${login}`);

  console.log(JSON.stringify({
    number: issueNumber,
    action: "unassigned",
    user: login,
  }, null, 2));
  return 0;
}
