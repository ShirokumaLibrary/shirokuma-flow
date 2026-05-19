/**
 * items add discussion - Discussion 作成ロジック (#1808)
 *
 * @related pull/discussion.ts - Discussion 取得・キャッシュ書き込み
 * @related push/discussion.ts - Discussion 本体の push ロジック
 */
import { runGraphQL, validateTitle, validateBody, } from "../../../utils/github.js";
import { resolveTargetRepo } from "../../../utils/repo-pairs.js";
import { GRAPHQL_MUTATION_CREATE_DISCUSSION, getRepoId, } from "../../../utils/graphql-queries.js";
import { getCategories, findCategory, } from "../../discussions/helpers.js";
import { writeCache, } from "../../../utils/github-cache.js";
import { moveFile } from "../../../utils/file.js";
import { getCachePath } from "../../../utils/github-cache.js";
import { readFileWithFrontmatter } from "./shared.js";
// =============================================================================
// items add discussion
// =============================================================================
/**
 * Discussion を作成する。
 * frontmatter から title/category を読み取る。
 */
export async function cmdAddDiscussion(options, logger) {
    if (!options.file) {
        logger.error("--file オプションは必須です");
        return 1;
    }
    const repoInfo = resolveTargetRepo(options);
    if (!repoInfo) {
        logger.error("Could not determine repository");
        return 1;
    }
    const { owner, name: repo } = repoInfo;
    // ファイルを読み込む
    const fileData = readFileWithFrontmatter(options.file);
    if (!fileData) {
        logger.error(`ファイルが見つかりません: ${options.file}`);
        return 1;
    }
    const { body, meta } = fileData;
    // frontmatter からフィールドを抽出
    const title = typeof meta["title"] === "string" ? meta["title"] : "";
    const categoryName = typeof meta["category"] === "string" ? meta["category"] : "";
    if (!title) {
        logger.error("frontmatter に title フィールドが必要です");
        return 1;
    }
    if (!categoryName) {
        logger.error("frontmatter に category フィールドが必要です");
        const categories = await getCategories(owner, repo);
        if (categories.length > 0) {
            logger.info(`利用可能なカテゴリ: ${categories.map((c) => c.name).join(", ")}`);
        }
        return 1;
    }
    const titleError = validateTitle(title);
    if (titleError) {
        logger.error(titleError);
        return 1;
    }
    const bodyError = validateBody(body);
    if (bodyError) {
        logger.error(bodyError);
        return 1;
    }
    // リポジトリ ID を取得
    const repoId = await getRepoId(owner, repo);
    if (!repoId) {
        logger.error("Could not get repository ID");
        return 1;
    }
    // カテゴリを解決
    const category = await findCategory(owner, repo, categoryName);
    if (!category) {
        logger.error(`カテゴリ '${categoryName}' が見つかりません`);
        const categories = await getCategories(owner, repo);
        if (categories.length > 0) {
            logger.info(`利用可能なカテゴリ: ${categories.map((c) => c.name).join(", ")}`);
        }
        return 1;
    }
    const createResult = await runGraphQL(GRAPHQL_MUTATION_CREATE_DISCUSSION, {
        repositoryId: repoId,
        categoryId: category.id,
        title,
        body,
    });
    if (!createResult.success) {
        logger.error("Discussion の作成に失敗しました");
        return 1;
    }
    const discussion = createResult.data?.data?.createDiscussion?.discussion;
    if (!discussion?.id || !discussion?.number) {
        logger.error("Discussion の作成に失敗しました");
        return 1;
    }
    logger.success(`Discussion #${discussion.number} を作成しました`);
    const discussionNumber = discussion.number;
    // キャッシュに書き込む
    writeCache(discussionNumber, {
        number: discussionNumber,
        type: "discussion",
        title,
        updated_at: new Date().toISOString(),
    }, body, owner, repo);
    // ファイルをキャッシュディレクトリに移動
    const destPath = getCachePath(discussionNumber, "discussion", owner, repo);
    try {
        moveFile(options.file, destPath);
        logger.info(`ファイルをキャッシュに移動しました: ${destPath}`);
    }
    catch {
        logger.warn(`ファイルの移動に失敗しました（キャッシュは書き込み済み）`);
    }
    console.log(JSON.stringify({
        number: discussionNumber,
        url: discussion.url,
        type: "discussion",
        title: discussion.title,
        category: categoryName,
        cache_file: destPath,
    }, null, 2));
    return 0;
}
//# sourceMappingURL=discussion.js.map