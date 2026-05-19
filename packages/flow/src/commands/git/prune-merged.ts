/**
 * git prune-merged - Bulk-delete merged local branches
 *
 * ベースブランチ（デフォルト: develop）に対してマージ済みのローカルブランチ、
 * およびリモートトラッキングが `[gone]`（squash merge 後の典型パターン）の
 * ローカルブランチを安全に削除する。
 *
 * 保護対象（削除しない）: develop / main / master / 現在 checkout 中のブランチ。
 */

import { Logger } from "../../utils/logger.js";
import { execFileAsync } from "../../utils/spawn-async.js";

// =============================================================================
// Types
// =============================================================================

export interface GitPruneMergedOptions {
  base?: string;
  dryRun?: boolean;
  force?: boolean;
  verbose?: boolean;
}

export interface GitPruneMergedOutput {
  base_branch: string;
  scanned: number;
  candidates: Array<{ name: string; reason: "merged" | "gone" }>;
  deleted: string[];
  failed: Array<{ name: string; reason: string }>;
  skipped_protected: string[];
  dry_run: boolean;
}

const PROTECTED_BRANCHES = new Set(["develop", "main", "master"]);

// =============================================================================
// Pure helpers (testable)
// =============================================================================

/**
 * `git branch --merged <base>` の出力からブランチ名を抽出する。
 * 先頭の `* ` / 空白を取り除き、空行と保護対象を除外する。
 */
export function parseMergedBranches(stdout: string, currentBranch: string, baseBranch: string): string[] {
  const result: string[] = [];
  for (const line of stdout.split("\n")) {
    const name = line.replace(/^\*?\s+/, "").trim();
    if (!name) continue;
    if (name === currentBranch) continue;
    if (name === baseBranch) continue;
    if (PROTECTED_BRANCHES.has(name)) continue;
    result.push(name);
  }
  return result;
}

/**
 * `git branch -vv` の出力から `[gone]` マーカーが付くブランチを抽出する。
 * squash merge 後にリモートが削除されたケースを検出する。
 */
export function parseGoneBranches(stdout: string, currentBranch: string, baseBranch: string): string[] {
  const result: string[] = [];
  for (const line of stdout.split("\n")) {
    // 例: "  feat/old   abc1234 [origin/feat/old: gone] commit message"
    //     "* develop    def5678 [origin/develop] commit"
    if (!line.includes(": gone]") && !line.includes(":gone]")) continue;
    const trimmed = line.replace(/^\*?\s+/, "");
    const name = trimmed.split(/\s+/)[0];
    if (!name) continue;
    if (name === currentBranch) continue;
    if (name === baseBranch) continue;
    if (PROTECTED_BRANCHES.has(name)) continue;
    result.push(name);
  }
  return result;
}

// =============================================================================
// Command implementation
// =============================================================================

export async function cmdGitPruneMerged(
  options: GitPruneMergedOptions,
  logger: Logger,
): Promise<number> {
  const baseBranch = options.base ?? "develop";

  // 現在のブランチを取得（保護対象に含めるため）
  const currentResult = await execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (currentResult.exitCode !== 0) {
    logger.error("Failed to determine current branch");
    return 1;
  }
  const currentBranch = currentResult.stdout.trim();

  // リモート同期 (gone マーカー更新のため)
  const fetchResult = await execFileAsync("git", ["fetch", "--prune"]);
  if (fetchResult.exitCode !== 0) {
    logger.warn("git fetch --prune failed (network issue?); continuing with stale data");
  }

  // マージ済みブランチ取得
  const mergedResult = await execFileAsync("git", ["branch", "--merged", baseBranch]);
  if (mergedResult.exitCode !== 0) {
    logger.error(`git branch --merged ${baseBranch} failed: ${mergedResult.stderr.trim()}`);
    return 1;
  }
  const mergedBranches = parseMergedBranches(mergedResult.stdout, currentBranch, baseBranch);

  // [gone] ブランチ取得（squash merge fallback）
  const vvResult = await execFileAsync("git", ["branch", "-vv"]);
  const goneBranches = vvResult.exitCode === 0
    ? parseGoneBranches(vvResult.stdout, currentBranch, baseBranch)
    : [];

  // マージ済み + gone を統合（重複排除、reason 付与）
  const candidateMap = new Map<string, "merged" | "gone">();
  for (const name of mergedBranches) candidateMap.set(name, "merged");
  for (const name of goneBranches) {
    if (!candidateMap.has(name)) candidateMap.set(name, "gone");
  }

  const candidates = Array.from(candidateMap.entries()).map(([name, reason]) => ({ name, reason }));

  const output: GitPruneMergedOutput = {
    base_branch: baseBranch,
    scanned: candidates.length,
    candidates,
    deleted: [],
    failed: [],
    skipped_protected: Array.from(PROTECTED_BRANCHES).concat([currentBranch]),
    dry_run: options.dryRun ?? false,
  };

  if (candidates.length === 0) {
    logger.info(`No merged branches found (base: ${baseBranch})`);
    logger.info(JSON.stringify(output, null, 2));
    return 0;
  }

  if (options.dryRun) {
    logger.info(`Found ${candidates.length} merged branches (dry-run):`);
    for (const c of candidates) {
      logger.info(`  ${c.name} (${c.reason})`);
    }
    logger.info(JSON.stringify(output, null, 2));
    return 0;
  }

  // 削除実行
  const deleteFlag = options.force ? "-D" : "-d";
  for (const c of candidates) {
    const result = await execFileAsync("git", ["branch", deleteFlag, c.name]);
    if (result.exitCode === 0) {
      output.deleted.push(c.name);
      logger.success(`Deleted ${c.name} (${c.reason})`);
    } else {
      const errMsg = result.stderr.trim() || "unknown error";
      output.failed.push({ name: c.name, reason: errMsg });
      logger.warn(`Failed to delete ${c.name}: ${errMsg}`);
    }
  }

  logger.info(JSON.stringify(output, null, 2));
  return output.failed.length > 0 ? 1 : 0;
}
