/**
 * repo pairs release subcommand - Release code from private to public repo
 */
import chalk from "chalk";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { getRepoPair, parseRepoFullName, getMergedExcludePatterns, } from "../../../utils/repo-pairs.js";
import { getOctokit } from "../../../utils/octokit-client.js";
import { collectLocalFiles } from "./helpers.js";
import { checkServiceStatus, formatIncidentReport } from "../../../utils/service-status.js";
// =============================================================================
// Handler
// =============================================================================
export async function cmdRelease(alias, options, logger) {
    if (!alias) {
        logger.error("Alias is required. Usage: repo-pairs release <alias> --tag <version>");
        return 1;
    }
    if (!options.tag) {
        logger.error("Tag is required. Usage: repo-pairs release <alias> --tag v1.0.0");
        return 1;
    }
    const pair = getRepoPair(alias);
    if (!pair) {
        logger.error(`Unknown alias: ${alias}. Run: repo-pairs list`);
        return 1;
    }
    const tag = options.tag.startsWith("v") ? options.tag : `v${options.tag}`;
    const projectPath = process.cwd();
    // sourceDir が指定されている場合、basePath をサブディレクトリに設定
    const basePath = pair.sourceDir ? resolve(projectPath, pair.sourceDir) : projectPath;
    // sourceDir 指定時のバリデーション
    if (pair.sourceDir) {
        if (!basePath.startsWith(projectPath)) {
            logger.error(`sourceDir must be within project root: ${pair.sourceDir}`);
            return 1;
        }
        if (!existsSync(basePath)) {
            logger.error(`Source directory not found: ${pair.sourceDir} (resolved: ${basePath})`);
            return 1;
        }
    }
    const excludePatterns = getMergedExcludePatterns(alias, basePath);
    logger.info(chalk.bold(`Release: ${pair.alias} \u2192 ${tag}`));
    logger.info(`  From: ${pair.private}`);
    logger.info(`  To:   ${pair.public}`);
    if (pair.sourceDir) {
        logger.info(`  Source: ${pair.sourceDir}`);
    }
    logger.info(`  Exclude: ${excludePatterns.join(", ")}`);
    const publicParsedRepo = parseRepoFullName(pair.public);
    if (!publicParsedRepo) {
        logger.error(`Invalid public repo format: ${pair.public}`);
        return 1;
    }
    // 1. ローカルファイルを収集（除外パターン適用）
    logger.verbose(`Collecting files from ${basePath}`);
    const allExcludes = [...excludePatterns, ".git/", "node_modules/"];
    const localFiles = collectLocalFiles(basePath, allExcludes);
    logger.info(`  Files: ${localFiles.length}`);
    if (options.dryRun) {
        logger.info(chalk.yellow("\n[DRY RUN] No changes will be made."));
        logger.info(chalk.gray("\nFiles to be released:"));
        for (const file of localFiles) {
            logger.info(chalk.gray(`  ${file.path}`));
        }
        return 0;
    }
    const octokit = getOctokit();
    const { owner: pubOwner, name: pubRepo } = publicParsedRepo;
    try {
        // 2. octokit Git Data API で tree を作成
        // base_tree なし = 完全置換（rsync --delete と同等）
        const treeItems = [];
        // バイナリファイルの blob 作成を並列化
        const blobPromises = localFiles
            .filter(f => f.isBinary)
            .map(async (file) => {
            const fullPath = join(basePath, file.path);
            const isExecutable = (statSync(fullPath).mode & 0o111) !== 0;
            const content = readFileSync(fullPath).toString("base64");
            const { data: blob } = await octokit.rest.git.createBlob({
                owner: pubOwner,
                repo: pubRepo,
                content,
                encoding: "base64",
            });
            const mode = isExecutable ? "100755" : "100644";
            return {
                path: file.path,
                mode,
                type: "blob",
                sha: blob.sha,
            };
        });
        // テキストファイルは content インライン（API 呼び出し不要）
        for (const file of localFiles) {
            if (!file.isBinary) {
                const fullPath = join(basePath, file.path);
                const isExecutable = (statSync(fullPath).mode & 0o111) !== 0;
                treeItems.push({
                    path: file.path,
                    mode: isExecutable ? "100755" : "100644",
                    type: "blob",
                    content: readFileSync(fullPath, "utf-8"),
                });
            }
        }
        // バイナリ blob を並列で待機
        const blobResults = await Promise.all(blobPromises);
        treeItems.push(...blobResults);
        const { data: tree } = await octokit.rest.git.createTree({
            owner: pubOwner,
            repo: pubRepo,
            tree: treeItems,
        });
        // 3 & 4. HEAD コミット取得と changelog 生成を並列実行
        const [parentSha, changelog] = await Promise.all([
            octokit.rest.git.getRef({
                owner: pubOwner,
                repo: pubRepo,
                ref: `heads/${pair.defaultBranch}`,
            }).then(({ data: ref }) => ref.object.sha)
                .catch(() => undefined), // 空リポジトリの場合は parent なし
            generateChangelog(pubOwner, pubRepo, tag, octokit, pair.defaultBranch),
        ]);
        // 5. コミットを作成
        const commitMsg = `release: ${tag}\n\n${changelog}`;
        const { data: commit } = await octokit.rest.git.createCommit({
            owner: pubOwner,
            repo: pubRepo,
            message: commitMsg,
            tree: tree.sha,
            parents: parentSha ? [parentSha] : [],
        });
        // 6. ブランチ参照を更新
        try {
            await octokit.rest.git.updateRef({
                owner: pubOwner,
                repo: pubRepo,
                ref: `heads/${pair.defaultBranch}`,
                sha: commit.sha,
            });
        }
        catch {
            // ブランチが存在しない場合は作成
            await octokit.rest.git.createRef({
                owner: pubOwner,
                repo: pubRepo,
                ref: `refs/heads/${pair.defaultBranch}`,
                sha: commit.sha,
            });
        }
        // 7. タグを作成
        const { data: tagObj } = await octokit.rest.git.createTag({
            owner: pubOwner,
            repo: pubRepo,
            tag,
            message: `Release ${tag}`,
            object: commit.sha,
            type: "commit",
        });
        await octokit.rest.git.createRef({
            owner: pubOwner,
            repo: pubRepo,
            ref: `refs/tags/${tag}`,
            sha: tagObj.sha,
        });
        // 8. GitHub Release を作成
        try {
            await octokit.rest.repos.createRelease({
                owner: pubOwner,
                repo: pubRepo,
                tag_name: tag,
                name: `Release ${tag}`,
                body: changelog,
            });
        }
        catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            logger.verbose(`Release creation warning: ${message}`);
        }
        logger.success(`Released ${tag} to ${pair.public}`);
        return 0;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // 5xx / ネットワークエラー時のみ GitHub ステータスをチェック
        // 4xx（権限エラー等）はサービス障害ではないためスキップ
        const httpStatus = error.status;
        if (!httpStatus || httpStatus >= 500) {
            const status = await checkServiceStatus("github");
            for (const line of formatIncidentReport("github", status)) {
                logger.error(line);
            }
        }
        logger.error(`Release failed: ${message}`);
        return 1;
    }
}
// =============================================================================
// Internal Helpers
// =============================================================================
/**
 * Generate changelog using octokit.
 * Fetches tag and commit information from the public repository API.
 */
async function generateChangelog(owner, repo, tag, octokit, defaultBranch = "main") {
    try {
        // 前回のタグを取得
        const { data: tags } = await octokit.rest.repos.listTags({
            owner,
            repo,
            per_page: 2,
        });
        const prevTag = tags.length > 0 ? tags[0].name : null;
        if (!prevTag) {
            return `Release ${tag}`;
        }
        // 前回タグから現在の default branch までのコミットを比較
        const { data: comparison } = await octokit.rest.repos.compareCommits({
            owner,
            repo,
            base: prevTag,
            head: defaultBranch,
            per_page: 250,
        });
        const commitMessages = comparison.commits.map(c => c.commit.message.split("\n")[0]);
        if (commitMessages.length === 0) {
            return `Release ${tag}`;
        }
        // コミットをカテゴリ分類
        const features = [];
        const fixes = [];
        const others = [];
        for (const msg of commitMessages) {
            if (msg.startsWith("feat:") || msg.startsWith("feat(")) {
                features.push(msg.replace(/^feat(\([^)]*\))?:\s*/, ""));
            }
            else if (msg.startsWith("fix:") || msg.startsWith("fix(")) {
                fixes.push(msg.replace(/^fix(\([^)]*\))?:\s*/, ""));
            }
            else if (!msg.startsWith("chore:") && !msg.startsWith("ci:")) {
                others.push(msg);
            }
        }
        const sections = [];
        if (features.length > 0) {
            sections.push("## Features\n" + features.map(f => `- ${f}`).join("\n"));
        }
        if (fixes.length > 0) {
            sections.push("## Bug Fixes\n" + fixes.map(f => `- ${f}`).join("\n"));
        }
        if (others.length > 0) {
            sections.push("## Other Changes\n" + others.map(o => `- ${o}`).join("\n"));
        }
        return sections.join("\n\n") || `Release ${tag}`;
    }
    catch {
        return `Release ${tag}`;
    }
}
//# sourceMappingURL=release.js.map