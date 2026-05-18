/**
 * items branch サブコマンド (#2024 Phase 1-B)
 *
 * Issue 番号を起点にフィーチャーブランチを作成する。
 * ブランチ名・ベースブランチを自動判定し、スキルの命名ミスや判定漏れを防ぐ。
 *
 * - ブランチ名: {prefix}/{number}-{slug}
 * - ベースブランチ: 親 Issue がある場合は integration ブランチ、なければ develop
 * - Integration ブランチが未存在で親が Epic の場合は自動作成
 */

import { runGraphQL, parseIssueNumber, isIssueNumber } from "../../../utils/github.js";
import { resolveTargetRepo } from "../../../utils/repo-pairs.js";
import { execFileAsync } from "../../../utils/spawn-async.js";
import type { Logger } from "../../../utils/logger.js";
import type { ItemsOptions } from "../../items/types.js";

// =============================================================================
// オプション型
// =============================================================================

/** items branch サブコマンドのオプション */
export interface BranchOptions extends ItemsOptions {
  /** ベースブランチ（省略時は自動判定） */
  base?: string;
  /** ブランチプレフィックス（省略時は Issue Type から推定） */
  prefix?: string;
  /** ブランチ名を表示するが作成しない */
  dryRun?: boolean;
}

// =============================================================================
// 返却データ型
// =============================================================================

export interface BranchResult {
  branch: string;
  base: string;
  issue: number;
  created: boolean;
  integration_branch?: {
    branch: string;
    created: boolean;
  };
}

// =============================================================================
// GraphQL クエリ定義
// =============================================================================

const GRAPHQL_QUERY_ISSUE_FOR_BRANCH = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      number
      title
      state
      issueType { name }
      labels(first: 20) { nodes { name } }
      body
      parent {
        number
        title
        body
        issueType { name }
      }
    }
  }
}
`;

// =============================================================================
// 型定義
// =============================================================================

interface IssueForBranchResult {
  data?: {
    repository?: {
      issue?: {
        number?: number;
        title?: string;
        state?: string;
        issueType?: { name?: string };
        labels?: { nodes?: Array<{ name?: string }> };
        body?: string;
        parent?: {
          number?: number;
          title?: string;
          body?: string;
          issueType?: { name?: string };
        } | null;
      };
    };
  };
}

// =============================================================================
// ヘルパー関数
// =============================================================================

/**
 * Issue Type からブランチプレフィックスを推定する。
 */
function inferPrefixFromIssueType(issueType: string | undefined): string {
  if (!issueType) return "feat";
  const lower = issueType.toLowerCase();
  if (lower === "bug") return "fix";
  if (lower === "task" || lower === "chore") return "chore";
  if (lower === "epic") return "epic";
  if (lower === "feature") return "feat";
  return "feat";
}

/**
 * Issue タイトルから URL スラグを生成する。
 * - 英数字+ハイフンに正規化
 * - 30文字以内に切り詰め
 */
function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 30)
    .replace(/-$/, "");
}

/**
 * Issue 本文から Integration ブランチ名を抽出する。
 * `### Integration ブランチ` セクションのブランチ名を取得する。
 */
function extractIntegrationBranch(body: string): string | null {
  const pattern = /###\s*Integration\s*[Bb]ranch[\s\S]*?`([\w/-]+)`/;
  const match = body.match(pattern);
  if (match?.[1]) return match[1];

  // 日本語セクション名も対応
  const patternJa = /###\s*Integrationブランチ[\s\S]*?`([\w/-]+)`/;
  const matchJa = body.match(patternJa);
  if (matchJa?.[1]) return matchJa[1];

  return null;
}

/**
 * リモートブランチに指定ブランチが存在するか確認する。
 */
async function remotebranchExists(branch: string): Promise<boolean> {
  const { exitCode, stdout } = await execFileAsync("git", [
    "ls-remote",
    "--exit-code",
    "origin",
    `refs/heads/${branch}`,
  ]);
  return exitCode === 0 && stdout.trim() !== "";
}

/**
 * 現在の作業ツリーがクリーンか確認する。
 */
async function isWorkingTreeClean(): Promise<boolean> {
  const { stdout } = await execFileAsync("git", ["status", "--porcelain"]);
  return stdout.trim() === "";
}

/**
 * 親 Issue の Integration ブランチを検出する。
 * 1. 親 Issue 本文の Integration Branch セクション
 * 2. リモートで "{prefix}/{親番号}-{slug}" パターンで検索
 */
export async function findIntegrationBranch(
  parentNumber: number,
  parentBody: string | undefined
): Promise<string | null> {
  // 1. 親 Issue 本文から抽出
  if (parentBody) {
    const branchFromBody = extractIntegrationBranch(parentBody);
    if (branchFromBody) {
      const exists = await remotebranchExists(branchFromBody);
      if (exists) return branchFromBody;
    }
  }

  // 2. リモートを直接問い合わせ（fetch を要さずに最新状態を参照）
  const { stdout } = await execFileAsync("git", [
    "ls-remote",
    "origin",
    `refs/heads/*/${parentNumber}-*`,
  ]);

  const branches = stdout
    .trim()
    .split("\n")
    .map((line) => line.split(/\s+/)[1]?.replace(/^refs\/heads\//, "") ?? "")
    .filter(Boolean);

  if (branches.length > 0) return branches[0];

  return null;
}

/**
 * Epic 用 Integration ブランチを自動作成し、親 Issue 本文に記載する。
 */
async function createIntegrationBranch(
  owner: string,
  repo: string,
  parentNumber: number,
  parentTitle: string,
  parentIssueId: string,
  logger: Logger
): Promise<string | null> {
  const slug = titleToSlug(parentTitle);
  const branchName = `epic/${parentNumber}-${slug}`;

  logger.info(`Integration ブランチ ${branchName} を作成します`);

  // develop をベースに Integration ブランチを作成
  const fetchResult = await execFileAsync("git", ["fetch", "origin"]);
  if (fetchResult.exitCode !== 0) {
    logger.warn("git fetch に失敗しました");
  }

  const checkoutResult = await execFileAsync("git", ["checkout", "origin/develop"]);
  if (checkoutResult.exitCode !== 0) {
    logger.warn("develop チェックアウトに失敗しました");
  }

  const createResult = await execFileAsync("git", ["checkout", "-b", branchName]);
  if (createResult.exitCode !== 0) {
    logger.error(`Integration ブランチ ${branchName} の作成に失敗しました`);
    return null;
  }

  const pushResult = await execFileAsync("git", ["push", "-u", "origin", branchName]);
  if (pushResult.exitCode !== 0) {
    logger.error(`Integration ブランチのプッシュに失敗しました`);
    return null;
  }

  // 親 Issue 本文に Integration ブランチを記載
  const GRAPHQL_QUERY_PARENT_BODY = `
query($id: ID!) {
  node(id: $id) {
    ... on Issue { body }
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

  interface NodeResult {
    data?: { node?: { body?: string } };
  }

  const bodyResult = await runGraphQL<NodeResult>(GRAPHQL_QUERY_PARENT_BODY, { id: parentIssueId });
  if (bodyResult.success) {
    const currentBody = bodyResult.data?.data?.node?.body ?? "";
    const integrationSection = `\n\n### Integration Branch\n\n\`${branchName}\`\n`;
    const newBody = currentBody + integrationSection;

    interface UpdateResult {
      data?: { updateIssue?: { issue?: { id?: string } } };
    }

    await runGraphQL<UpdateResult>(GRAPHQL_MUTATION_UPDATE_ISSUE_BODY, {
      id: parentIssueId,
      body: newBody,
    });
  }

  logger.success(`Integration ブランチ ${branchName} を作成しました`);
  return branchName;
}

// =============================================================================
// コマンドエントリポイント
// =============================================================================

/**
 * items branch サブコマンド
 *
 * Issue 番号を起点にフィーチャーブランチを作成する。
 */
export async function cmdItemBranch(
  numberStr: string,
  options: BranchOptions,
  logger: Logger
): Promise<number> {
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

  // 作業ツリーのクリーン確認
  if (!options.dryRun) {
    const isClean = await isWorkingTreeClean();
    if (!isClean) {
      logger.error("作業ツリーにコミットされていない変更があります。コミットまたはスタッシュしてください");
      return 1;
    }
  }

  // Issue 情報を取得
  const issueResult = await runGraphQL<IssueForBranchResult>(
    GRAPHQL_QUERY_ISSUE_FOR_BRANCH,
    { owner, name: repo, number }
  );

  if (!issueResult.success || !issueResult.data?.data?.repository?.issue) {
    logger.error(`Issue #${number} が見つかりません`);
    return 1;
  }

  const issue = issueResult.data.data.repository.issue;

  // ブランチプレフィックスを決定
  const prefix = options.prefix ?? inferPrefixFromIssueType(issue.issueType?.name);

  // スラグを生成
  const slug = titleToSlug(issue.title ?? String(number));

  // ブランチ名を生成
  const branchName = `${prefix}/${number}-${slug}`;

  // ベースブランチを判定
  let baseBranch = options.base ?? "develop";
  let integrationBranchInfo: BranchResult["integration_branch"] | undefined;

  // ベースブランチ判定マトリクス（create-from-issue.ts と整合）:
  // Case 1: integration 検出済み + --base 未指定 → integration を自動採用
  // Case 2: integration 検出済み + --base 明示    → 明示を優先（警告あり）
  // Case 3: integration 未検出 + --base 未指定 + 親が Epic → integration を自動作成
  // Case 4: integration 未検出 + --base 未指定 + 親が Epic でない → develop にフォールバック（警告あり）
  // Case 5: integration 未検出 + --base 明示 → 明示を使用（auto-create / fallback は発動しない）
  if (issue.parent?.number) {
    const integrationBranch = await findIntegrationBranch(
      issue.parent.number,
      issue.parent.body
    );

    if (integrationBranch) {
      if (options.base) {
        logger.warn(
          `Integration ブランチ \`${integrationBranch}\` が存在しますが --base の指定を優先します（${options.base}）`
        );
      } else {
        baseBranch = integrationBranch;
        integrationBranchInfo = { branch: integrationBranch, created: false };
      }
    } else if (!options.base) {
      if (issue.parent.issueType?.name?.toLowerCase() === "epic") {
        // 親が Epic の場合は Integration ブランチを自動作成
        if (!options.dryRun) {
          // 親 Issue の GraphQL ID を取得
          const GRAPHQL_QUERY_PARENT_ID = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) { id }
  }
}
`;
          interface ParentIdResult {
            data?: { repository?: { issue?: { id?: string } } };
          }

          const parentIdResult = await runGraphQL<ParentIdResult>(
            GRAPHQL_QUERY_PARENT_ID,
            { owner, name: repo, number: issue.parent.number }
          );

          const parentIssueId = parentIdResult.success
            ? (parentIdResult.data?.data?.repository?.issue?.id ?? "")
            : "";

          const newIntegrationBranch = await createIntegrationBranch(
            owner,
            repo,
            issue.parent.number,
            issue.parent.title ?? "",
            parentIssueId,
            logger
          );

          if (newIntegrationBranch) {
            baseBranch = newIntegrationBranch;
            integrationBranchInfo = { branch: newIntegrationBranch, created: true };
          } else {
            logger.warn("Integration ブランチの作成に失敗しました。develop をベースブランチとして使用します");
          }
        } else {
          // dry-run モード
          const slug = titleToSlug(issue.parent.title ?? String(issue.parent.number));
          const estimatedBranch = `epic/${issue.parent.number}-${slug}`;
          baseBranch = estimatedBranch;
          integrationBranchInfo = { branch: estimatedBranch, created: true };
        }
      } else {
        logger.warn("親 Issue の Integration ブランチが見つかりません。develop をベースブランチとして使用します");
      }
    }
  }

  const result: BranchResult = {
    branch: branchName,
    base: baseBranch,
    issue: number,
    created: !options.dryRun,
    integration_branch: integrationBranchInfo,
  };

  if (options.dryRun) {
    logger.info(`[dry-run] ブランチ名: ${branchName}`);
    logger.info(`[dry-run] ベースブランチ: ${baseBranch}`);
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }

  // 同名ブランチの存在確認
  const { stdout: localBranchOut } = await execFileAsync("git", ["branch", "--list", branchName]);
  if (localBranchOut.trim()) {
    logger.error(`ブランチ ${branchName} は既に存在します`);
    return 1;
  }

  const remoteExists = await remotebranchExists(branchName);
  if (remoteExists) {
    logger.error(`リモートブランチ origin/${branchName} は既に存在します`);
    return 1;
  }

  // ベースブランチに切り替えてプル
  await execFileAsync("git", ["fetch", "origin"]);

  const checkoutBaseResult = await execFileAsync("git", ["checkout", baseBranch]);
  if (checkoutBaseResult.exitCode !== 0) {
    // リモートからチェックアウト
    const checkoutRemote = await execFileAsync("git", ["checkout", "-b", baseBranch, `origin/${baseBranch}`]);
    if (checkoutRemote.exitCode !== 0) {
      logger.error(`ベースブランチ ${baseBranch} のチェックアウトに失敗しました`);
      return 1;
    }
  }

  await execFileAsync("git", ["pull"]);

  // フィーチャーブランチを作成
  const createResult = await execFileAsync("git", ["checkout", "-b", branchName]);
  if (createResult.exitCode !== 0) {
    logger.error(`ブランチ ${branchName} の作成に失敗しました`);
    return 1;
  }

  logger.success(`ブランチ ${branchName} を ${baseBranch} から作成しました`);
  console.log(JSON.stringify(result, null, 2));
  return 0;
}
