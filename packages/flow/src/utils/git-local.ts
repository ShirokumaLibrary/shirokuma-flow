/**
 * ローカル .git ファイル直接読み取りユーティリティ
 *
 * spawnSync("git", ...) を排除し、.git ディレクトリ内のファイルを
 * 直接読み取ることで同期的に git 情報を取得する。
 * git worktree 環境にも対応。
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";

/**
 * .git ディレクトリのパスを解決する（worktree 対応）。
 *
 * - `.git` がディレクトリ → そのまま返す
 * - `.git` がファイル（worktree）→ `gitdir: <path>` を辿って実ディレクトリを返す
 * - `.git` が見つからない → 親ディレクトリを遡って探索
 *
 * @returns { gitDir, commonDir } または null
 *   - gitDir: worktree 固有の .git ディレクトリ（HEAD などがある場所）
 *   - commonDir: 共有の .git ディレクトリ（config, refs などがある場所）
 */
function resolveGitDir(cwd?: string): { gitDir: string; commonDir: string } | null {
  let dir = resolve(cwd || process.cwd());
  const root = "/";

  while (dir !== root) {
    const gitPath = join(dir, ".git");

    if (!existsSync(gitPath)) {
      dir = dirname(dir);
      continue;
    }

    try {
      const stat = statSync(gitPath);

      if (stat.isDirectory()) {
        // 通常のリポジトリ: .git はディレクトリ
        return { gitDir: gitPath, commonDir: gitPath };
      }

      if (stat.isFile()) {
        // worktree: .git はファイル（"gitdir: /path/to/.git/worktrees/<name>"）
        const content = readFileSync(gitPath, "utf-8").trim();
        const match = content.match(/^gitdir:\s*(.+)$/);
        if (!match) return null;

        const worktreeGitDir = resolve(dir, match[1]);
        if (!existsSync(worktreeGitDir)) return null;

        // commondir ファイルから共有 .git ディレクトリを取得
        const commonDirFile = join(worktreeGitDir, "commondir");
        if (existsSync(commonDirFile)) {
          const commonDirRel = readFileSync(commonDirFile, "utf-8").trim();
          const commonDir = resolve(worktreeGitDir, commonDirRel);
          return { gitDir: worktreeGitDir, commonDir };
        }

        // commondir がない場合は worktreeGitDir の親の親を推定
        // 例: /repo/.git/worktrees/foo → /repo/.git
        return { gitDir: worktreeGitDir, commonDir: resolve(worktreeGitDir, "..", "..") };
      }
    } catch {
      // stat / readFile に失敗した場合
    }

    dir = dirname(dir);
  }

  return null;
}

/**
 * .git/HEAD からブランチ名を取得する。
 *
 * - `ref: refs/heads/{branch}` → ブランチ名を返す
 * - detached HEAD（コミットハッシュ）→ null
 * - worktree の場合は worktree 固有の HEAD を読む
 */
export function getCurrentBranch(cwd?: string): string | null {
  const dirs = resolveGitDir(cwd);
  if (!dirs) return null;

  try {
    // worktree では gitDir に固有の HEAD がある
    const headPath = join(dirs.gitDir, "HEAD");
    if (!existsSync(headPath)) return null;

    const content = readFileSync(headPath, "utf-8").trim();
    const match = content.match(/^ref: refs\/heads\/(.+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * .git/config から指定リモートの URL を取得する。
 *
 * [remote "origin"] セクションの url 行をパースする。
 */
export function getGitRemoteUrl(remoteName: string = "origin", cwd?: string): string | null {
  const dirs = resolveGitDir(cwd);
  if (!dirs) return null;

  try {
    const configPath = join(dirs.commonDir, "config");
    if (!existsSync(configPath)) return null;

    const content = readFileSync(configPath, "utf-8");
    return parseRemoteUrl(content, remoteName);
  } catch {
    return null;
  }
}

/**
 * .git ディレクトリの存在でリポジトリ内か判定する。
 * worktree の .git ファイルも検出する。
 */
export function isInsideGitRepo(cwd?: string): boolean {
  return resolveGitDir(cwd) !== null;
}

/**
 * .git/config から全リモート情報を取得する。
 * diagnoseRepoFailure() 用。
 */
export function getGitRemotes(cwd?: string): Array<{ name: string; url: string }> {
  const dirs = resolveGitDir(cwd);
  if (!dirs) return [];

  try {
    const configPath = join(dirs.commonDir, "config");
    if (!existsSync(configPath)) return [];

    const content = readFileSync(configPath, "utf-8");
    return parseAllRemotes(content);
  } catch {
    return [];
  }
}

// --- 内部ヘルパー ---

/**
 * git config の内容から指定リモートの URL を抽出する。
 */
function parseRemoteUrl(configContent: string, remoteName: string): string | null {
  // [remote "origin"] セクションを見つけて url = ... を取得
  const sectionRegex = new RegExp(
    `\\[remote\\s+"${escapeRegex(remoteName)}"\\]([\\s\\S]*?)(?=\\[|$)`
  );
  const sectionMatch = configContent.match(sectionRegex);
  if (!sectionMatch) return null;

  const urlMatch = sectionMatch[1].match(/^\s*url\s*=\s*(.+)$/m);
  return urlMatch ? urlMatch[1].trim() : null;
}

/**
 * git config の内容から全リモートの名前と URL を抽出する。
 */
function parseAllRemotes(configContent: string): Array<{ name: string; url: string }> {
  const remotes: Array<{ name: string; url: string }> = [];
  const sectionRegex = /\[remote\s+"([^"]+)"\]([\s\S]*?)(?=\[|$)/g;

  let match;
  while ((match = sectionRegex.exec(configContent)) !== null) {
    const name = match[1];
    const urlMatch = match[2].match(/^\s*url\s*=\s*(.+)$/m);
    if (urlMatch) {
      remotes.push({ name, url: urlMatch[1].trim() });
    }
  }

  return remotes;
}

/**
 * 正規表現の特殊文字をエスケープする。
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// =============================================================================
// inferIssueFromBranch - ブランチ名から Issue 番号を推論
// =============================================================================

/**
 * ブランチ名から Issue 番号を推論する。
 *
 * - マッチ対象: `^(feat|fix|chore|refactor|docs|perf|test)\/(\d+)(?:-.*)?$`
 * - `epic/` プレフィックスは除外（Integration ブランチ `epic/{N}-slug` の誤マッチ防止）
 * - ホワイトリスト外のプレフィックス（`feature/` 等）も null を返す
 *
 * 受理パターン例:
 * - `feat/2121-foo` → 2121
 * - `fix/123` → 123
 * - `chore/456-abc` → 456
 * - `feat/2121-foo/bar` → 2121（数字の後がハイフンで始まるスラグは `.` にマッチして `/` も含まれうる）
 *
 * 棄却パターン例:
 * - `feat/123/sub` → null（数字の直後が `-` 以外の場合は棄却）
 * - `epic/2121-integration` → null（ホワイトリスト外プレフィックス）
 * - `develop` / `main` → null（プレフィックスなし）
 *
 * @param branchName - ブランチ名
 * @returns Issue 番号、または推論不可な場合は null
 */
export function inferIssueFromBranch(branchName: string): number | null {
  const match = branchName.match(/^(feat|fix|chore|refactor|docs|perf|test)\/(\d+)(?:-.*)?$/);
  if (!match) return null;
  return parseInt(match[2], 10);
}
