const DEFAULT_TIMEOUT_MS = 30_000;
const SHA_PATTERN = /^[a-f0-9]{40}$/;
const TREE_REF_PATTERN = /^[a-zA-Z0-9._/-]+$/;
const GITHUB_API_ACCEPT = 'application/vnd.github+json';
const GITHUB_API_VERSION = '2022-11-28';
/**
 * `https://github.com/{owner}/{repo}[.git]` 形式のリポジトリ URL を owner/repo に分解。
 * 他ホストや不完全な URL は null。
 *
 * Note: root の `src/lib/git.ts` に SSH / short form まで含む上位版の
 * `parseGitHubRepo` がある。パッケージ境界を越えられないため本 primitive は
 * HTTPS 限定の縮小版。将来 `@shirokuma-library/git-url` に抽出する余地あり。
 */
export function parseGithubRepoUrl(url) {
    const match = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
    if (!match?.[1] || !match[2])
        return null;
    return { owner: match[1], repo: match[2] };
}
/**
 * `raw.githubusercontent.com` の URL を構築する。
 */
export function buildGithubRawUrl(owner, repo, branch, filePath) {
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
}
/**
 * Git Tree API で指定ブランチの **全エントリ** を取得する（`recursive=1`）。
 * ENOBUFS になるような巨大リポジトリでは `fetchGithubSubtreeBySha` を使う。
 *
 * ADR-0013 準拠: `gh` CLI には依存せず `fetch()` を直接利用する。認証が必要な
 * 場合（rate limit 回避 / private repo）は `options.token` に GITHUB_TOKEN を渡す。
 */
export async function fetchGithubTreeEntries(owner, repo, branch, options = {}) {
    validateTreeRef(branch);
    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
    const data = await githubGetJson(url, options);
    return data.tree;
}
/**
 * Git Tree API で **SHA 指定のサブツリー** を取得する。
 * ルートから recursive すると ENOBUFS / payload too large になるような
 * 大規模リポジトリで、`resolveGithubTreeSha` で得たサブツリー SHA 経由で取る。
 */
export async function fetchGithubSubtreeBySha(owner, repo, sha, options = {}) {
    validateSha(sha);
    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`;
    const data = await githubGetJson(url, options);
    return data.tree;
}
/**
 * 指定ツリー参照（ブランチ or SHA）の **shallow listing** から `targetPath` エントリの
 * SHA を解決する。サブツリー fetch の前段として使う。
 * 見つからなければ null。
 */
export async function resolveGithubTreeSha(owner, repo, treeRef, targetPath, options = {}) {
    validateTreeRef(treeRef);
    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${treeRef}`;
    const data = await githubGetJson(url, options);
    const entry = data.tree.find((e) => e.path === targetPath);
    return entry?.sha ?? null;
}
function validateTreeRef(treeRef) {
    if (!TREE_REF_PATTERN.test(treeRef) || treeRef.includes('..')) {
        throw new Error(`Invalid tree ref: "${treeRef}"`);
    }
}
function validateSha(sha) {
    if (!SHA_PATTERN.test(sha)) {
        throw new Error(`Invalid SHA: "${sha}"`);
    }
}
async function githubGetJson(url, options) {
    const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const headers = {
            Accept: GITHUB_API_ACCEPT,
            'X-GitHub-Api-Version': GITHUB_API_VERSION,
        };
        if (options.token)
            headers.Authorization = `Bearer ${options.token}`;
        const res = await fetch(url, { headers, signal: controller.signal });
        if (!res.ok) {
            throw new Error(`GitHub API ${res.status} ${res.statusText} — ${url}`);
        }
        return (await res.json());
    }
    finally {
        clearTimeout(timer);
    }
}
//# sourceMappingURL=github.js.map