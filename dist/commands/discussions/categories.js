import { resolveTargetRepo } from "../../utils/repo-pairs.js";
import { getCategories } from "./helpers.js";
export async function cmdCategories(options, logger) {
    const repoInfo = resolveTargetRepo(options);
    if (!repoInfo) {
        logger.error("Could not determine repository");
        return 1;
    }
    const { owner, name: repo } = repoInfo;
    const categories = await getCategories(owner, repo);
    if (categories.length === 0) {
        logger.warn("No discussion categories found. Discussions may not be enabled for this repository.");
        return 0;
    }
    const output = {
        repository: `${owner}/${repo}`,
        categories: categories.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            emoji: c.emoji,
            is_answerable: c.isAnswerable,
        })),
        total_count: categories.length,
    };
    console.log(JSON.stringify(output, null, 2));
    return 0;
}
//# sourceMappingURL=categories.js.map