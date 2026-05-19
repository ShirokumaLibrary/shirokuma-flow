/**
 * repo labels subcommand - List or create labels
 */
import { runGraphQL, getRepoInfo, } from "../../utils/github.js";
import { GRAPHQL_MUTATION_CREATE_LABEL, getRepoId, } from "../../utils/graphql-queries.js";
// =============================================================================
// GraphQL Query
// =============================================================================
const GRAPHQL_QUERY_LABELS = `
query($owner: String!, $name: String!, $first: Int!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    labels(first: $first, after: $cursor, orderBy: {field: NAME, direction: ASC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        name
        color
        description
      }
    }
  }
}
`;
// =============================================================================
// Handler
// =============================================================================
export async function cmdLabels(options, logger) {
    const repoInfo = getRepoInfo();
    if (!repoInfo) {
        logger.error("Could not determine repository");
        return 1;
    }
    const { owner, name: repo } = repoInfo;
    // Create label if --create is specified
    if (options.create) {
        const repoId = await getRepoId(owner, repo);
        if (!repoId) {
            logger.error("Could not get repository ID");
            return 1;
        }
        // Validate color (should be 6-char hex without #)
        let color = options.color ?? "ededed";
        if (color.startsWith("#")) {
            color = color.slice(1);
        }
        if (!/^[0-9a-fA-F]{6}$/.test(color)) {
            logger.error("Invalid color. Use 6-character hex (e.g., 'ff0000' or '#ff0000')");
            return 1;
        }
        const result = await runGraphQL(GRAPHQL_MUTATION_CREATE_LABEL, {
            repositoryId: repoId,
            name: options.create,
            color: color,
            description: options.description ?? "",
        });
        if (!result.success) {
            logger.error("Failed to create label");
            return 1;
        }
        const label = result.data?.data?.createLabel?.label;
        if (!label?.id) {
            logger.error("Failed to create label");
            return 1;
        }
        logger.success(`Created label '${label.name}'`);
        const output = {
            id: label.id,
            name: label.name,
            color: label.color,
            description: label.description,
        };
        console.log(JSON.stringify(output, null, 2));
        return 0;
    }
    const labels = [];
    let cursor = null;
    while (true) {
        const result = await runGraphQL(GRAPHQL_QUERY_LABELS, {
            owner,
            name: repo,
            first: 50,
            cursor: cursor,
        });
        if (!result.success || !result.data?.data?.repository?.labels)
            break;
        const labelsData = result.data.data.repository.labels;
        const nodes = labelsData.nodes ?? [];
        for (const node of nodes) {
            if (!node?.id || !node?.name)
                continue;
            labels.push({
                id: node.id,
                name: node.name,
                color: node.color ?? "",
                description: node.description ?? "",
            });
        }
        const pageInfo = labelsData.pageInfo ?? {};
        if (!pageInfo.hasNextPage)
            break;
        cursor = pageInfo.endCursor ?? null;
    }
    const output = {
        repository: `${owner}/${repo}`,
        labels: labels.map((l) => ({
            id: l.id,
            name: l.name,
            color: `#${l.color}`,
            description: l.description,
        })),
        total_count: labels.length,
    };
    console.log(JSON.stringify(output, null, 2));
    return 0;
}
//# sourceMappingURL=labels.js.map