/**
 * projects setup-metrics subcommand
 *
 * Create Text fields for metrics tracking (idempotent).
 */

import { Logger } from "../../utils/logger.js";
import { loadGhConfig, getMetricsConfig } from "../../utils/gh-config.js";
import { getProjectFields } from "../../utils/project-fields.js";
import {
  ProjectsOptions,
  runGraphQL,
  getOwner,
  getProjectId,
} from "./helpers.js";

/** Create a custom field in a project */
const GRAPHQL_MUTATION_CREATE_FIELD = `
mutation($projectId: ID!, $name: String!, $dataType: ProjectV2CustomFieldType!) {
  createProjectV2Field(input: {projectId: $projectId, name: $name, dataType: $dataType}) {
    projectV2Field {
      ... on ProjectV2Field { id name dataType }
    }
  }
}
`;

/**
 * Create Text fields for metrics tracking (idempotent).
 * Reads field names from metrics config, creates missing ones.
 */
export async function cmdSetupMetrics(
  options: ProjectsOptions,
  logger: Logger
): Promise<number> {
  const config = loadGhConfig();
  const metricsConfig = getMetricsConfig(config);

  const owner = options.owner || getOwner();
  if (!owner) {
    logger.error("Could not determine repository owner");
    return 1;
  }

  const projectId = await getProjectId(owner);
  if (!projectId) {
    logger.error(`No project found for owner '${owner}'`);
    return 1;
  }

  // Get existing fields
  const existingFields = await getProjectFields(projectId);

  // statusToDateMapping の値からフィールド名を収集（重複を除去）
  const mappingValues = Object.values(metricsConfig.statusToDateMapping ?? {});
  const fieldNames = [...new Set(
    mappingValues.flatMap(v => Array.isArray(v) ? v : [v]).filter(Boolean),
  )];

  const created: string[] = [];
  const existing: string[] = [];
  const failed: string[] = [];

  for (const fieldName of fieldNames) {
    if (existingFields[fieldName]) {
      const field = existingFields[fieldName];
      if (field.type === "TEXT") {
        existing.push(fieldName);
        logger.debug(`Field already exists: ${fieldName}`);
      } else {
        logger.warn(`Field '${fieldName}' exists but is type ${field.type}, expected TEXT`);
        failed.push(fieldName);
      }
      continue;
    }

    // Create text field
    const result = await runGraphQL(GRAPHQL_MUTATION_CREATE_FIELD, {
      projectId,
      name: fieldName,
      dataType: "TEXT",
    });

    if (result.success) {
      created.push(fieldName);
      logger.success(`Created Text field: ${fieldName}`);
    } else {
      failed.push(fieldName);
      logger.error(`Failed to create Text field: ${fieldName}`);
    }
  }

  // Output
  const output = {
    project_id: projectId,
    fields: { created, existing, failed },
    metrics_config: {
      enabled: metricsConfig.enabled,
      statusToDateMapping: metricsConfig.statusToDateMapping,
    },
    next_steps: [
      ...(metricsConfig.enabled
        ? []
        : ["Set metrics.enabled: true in .shirokuma/config.yaml"]),
      "Timestamps are automatically set when status changes via 'items push'",
      "Run 'items integrity --fix' to backfill timestamps for existing Done issues",
    ],
  };

  console.log(JSON.stringify(output, null, 2));
  return failed.length > 0 ? 1 : 0;
}
