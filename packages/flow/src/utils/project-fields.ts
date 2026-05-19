/**
 * Project field operations - shared module
 *
 * Extracted from issues.ts and projects.ts to eliminate duplication.
 * Provides field resolution, update operations, and timestamp management.
 *
 * Consumers: issues.ts, projects.ts, session.ts, issues-pr.ts
 */

import { type Logger, createLogger } from "./logger.js";
import { runGraphQL, type GraphQLError } from "./github.js";

// =============================================================================
// Types
// =============================================================================

/** Project field type discriminator */
export type ProjectFieldType = "SINGLE_SELECT" | "TEXT" | "NUMBER" | "DATE" | "UNKNOWN";

/**
 * Status キーを含まないフィールド辞書。
 *
 * `setItemFields` の外部向け引数型。`"Status"` キーをコンパイル時に拒否し、
 * Status 更新が `updateProjectStatus` / `resolveAndUpdateStatus` 以外の経路を
 * 通らないことを型レベルで保証する（ADR-v3-014, Issue #2207）。
 *
 * @example
 * // OK: Status 以外のフィールド
 * const fields: NonStatusFields = { Priority: "High", Size: "M" };
 *
 * // NG: コンパイルエラー
 * const bad: NonStatusFields = { Status: "In Progress" }; // Type Error
 */
export type NonStatusFields = { [K: string]: string } & { Status?: never };

/** Project field definition with type info */
export interface ProjectField {
  id: string;
  /** Field name — set by projects.ts, optional for backward compat */
  name?: string;
  type: ProjectFieldType;
  /** Option name → option ID mapping (empty for non-select fields) */
  options: Record<string, string>;
}

/**
 * Resolve a field name against project fields.
 * Returns the field name if found, or null.
 */
export function resolveFieldName(
  fieldName: string,
  projectFields: Record<string, ProjectField>
): string | null {
  return projectFields[fieldName] ? fieldName : null;
}

// =============================================================================
// GraphQL Queries & Mutations
// =============================================================================

const GRAPHQL_QUERY_FIELDS = `
query($projectId: ID!) {
  node(id: $projectId) {
    ... on ProjectV2 {
      title
      fields(first: 30) {
        nodes {
          ... on ProjectV2SingleSelectField {
            id name dataType
            options { id name }
          }
          ... on ProjectV2Field {
            id name dataType
          }
        }
      }
    }
  }
}
`;

const GRAPHQL_MUTATION_UPDATE_FIELD = `
mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
  updateProjectV2ItemFieldValue(input: {
    projectId: $projectId
    itemId: $itemId
    fieldId: $fieldId
    value: { singleSelectOptionId: $optionId }
  }) { projectV2Item { id } }
}
`;

const GRAPHQL_MUTATION_UPDATE_TEXT_FIELD = `
mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $text: String!) {
  updateProjectV2ItemFieldValue(input: {
    projectId: $projectId
    itemId: $itemId
    fieldId: $fieldId
    value: { text: $text }
  }) { projectV2Item { id } }
}
`;

const GRAPHQL_MUTATION_UPDATE_NUMBER_FIELD = `
mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $number: Float!) {
  updateProjectV2ItemFieldValue(input: {
    projectId: $projectId
    itemId: $itemId
    fieldId: $fieldId
    value: { number: $number }
  }) { projectV2Item { id } }
}
`;

const GRAPHQL_MUTATION_UPDATE_DATE_FIELD = `
mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $date: Date!) {
  updateProjectV2ItemFieldValue(input: {
    projectId: $projectId
    itemId: $itemId
    fieldId: $fieldId
    value: { date: $date }
  }) { projectV2Item { id } }
}
`;

export const GRAPHQL_MUTATION_ADD_TO_PROJECT = `
mutation($projectId: ID!, $contentId: ID!) {
  addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
    item { id }
  }
}
`;

// =============================================================================
// Field Fetching
// =============================================================================

/**
 * Get project field definitions (SingleSelect + Text fields).
 */
export async function getProjectFields(projectId: string): Promise<Record<string, ProjectField>> {
  interface FieldNode {
    id?: string;
    name?: string;
    dataType?: string;
    options?: Array<{ id: string; name: string }>;
  }

  interface QueryResult {
    data?: {
      node?: {
        fields?: { nodes?: FieldNode[] };
      };
    };
  }

  const result = await runGraphQL<QueryResult>(GRAPHQL_QUERY_FIELDS, { projectId });
  if (!result.success) {
    const logger = createLogger();
    logger.error(`Failed to fetch project fields: ${result.error}`);
    return {};
  }

  const fields: Record<string, ProjectField> = {};
  const nodes = result.data?.data?.node?.fields?.nodes ?? [];

  for (const node of nodes) {
    if (!node?.name || !node?.id) continue;

    if (node.options) {
      // SingleSelect field
      const options: Record<string, string> = {};
      for (const opt of node.options) {
        options[opt.name] = opt.id;
      }
      fields[node.name] = { id: node.id, name: node.name, type: "SINGLE_SELECT", options };
    } else if (node.dataType === "TEXT") {
      fields[node.name] = { id: node.id, name: node.name, type: "TEXT", options: {} };
    } else if (node.dataType === "NUMBER") {
      fields[node.name] = { id: node.id, name: node.name, type: "NUMBER", options: {} };
    } else if (node.dataType === "DATE") {
      fields[node.name] = { id: node.id, name: node.name, type: "DATE", options: {} };
    }
  }

  return fields;
}

// =============================================================================
// Field Update Operations
// =============================================================================

/**
 * Format GraphQL errors for logging.
 */
function formatGraphQLErrors(errors: GraphQLError[]): string {
  return errors.map((e) => e.message).join("; ");
}

/**
 * Update project item SingleSelect field.
 * Logs GraphQL errors as warnings if present.
 */
export async function updateSelectField(
  projectId: string,
  itemId: string,
  fieldId: string,
  optionId: string,
  logger?: Logger
): Promise<boolean> {
  const result = await runGraphQL(GRAPHQL_MUTATION_UPDATE_FIELD, {
    projectId,
    itemId,
    fieldId,
    optionId,
  });
  if (result.success && result.graphqlErrors) {
    logger?.warn(`GraphQL partial error (select field): ${formatGraphQLErrors(result.graphqlErrors)}`);
  }
  return result.success;
}

/**
 * Update project item Text field.
 * Logs GraphQL errors as warnings if present.
 */
export async function updateTextField(
  projectId: string,
  itemId: string,
  fieldId: string,
  text: string,
  logger?: Logger
): Promise<boolean> {
  const result = await runGraphQL(GRAPHQL_MUTATION_UPDATE_TEXT_FIELD, {
    projectId,
    itemId,
    fieldId,
    text,
  });
  if (result.success && result.graphqlErrors) {
    logger?.warn(`GraphQL partial error (text field): ${formatGraphQLErrors(result.graphqlErrors)}`);
  }
  return result.success;
}

/**
 * Update project item Number field.
 * Logs GraphQL errors as warnings if present.
 */
export async function updateNumberField(
  projectId: string,
  itemId: string,
  fieldId: string,
  value: number,
  logger?: Logger
): Promise<boolean> {
  const result = await runGraphQL(GRAPHQL_MUTATION_UPDATE_NUMBER_FIELD, {
    projectId,
    itemId,
    fieldId,
    number: value,
  });
  if (result.success && result.graphqlErrors) {
    logger?.warn(`GraphQL partial error (number field): ${formatGraphQLErrors(result.graphqlErrors)}`);
  }
  return result.success;
}

/**
 * Update project item Date field.
 * Logs GraphQL errors as warnings if present.
 */
export async function updateDateField(
  projectId: string,
  itemId: string,
  fieldId: string,
  date: string,
  logger?: Logger
): Promise<boolean> {
  const result = await runGraphQL(GRAPHQL_MUTATION_UPDATE_DATE_FIELD, {
    projectId,
    itemId,
    fieldId,
    date,
  });
  if (result.success && result.graphqlErrors) {
    logger?.warn(`GraphQL partial error (date field): ${formatGraphQLErrors(result.graphqlErrors)}`);
  }
  return result.success;
}

/**
 * Add an item to a project by content ID (Issue/PR GraphQL ID).
 * Returns the project item ID on success, or null on failure.
 */
export async function addItemToProject(
  projectId: string,
  contentId: string,
  logger?: Logger
): Promise<string | null> {
  interface AddResult {
    data?: {
      addProjectV2ItemById?: {
        item?: { id?: string };
      };
    };
  }

  const result = await runGraphQL<AddResult>(GRAPHQL_MUTATION_ADD_TO_PROJECT, {
    projectId,
    contentId,
  });

  if (!result.success) {
    logger?.warn(`Failed to add item to project: ${result.error}`);
    return null;
  }
  if (result.graphqlErrors) {
    logger?.warn(`GraphQL partial error (add to project): ${formatGraphQLErrors(result.graphqlErrors)}`);
  }

  return result.data?.data?.addProjectV2ItemById?.item?.id ?? null;
}

// =============================================================================
// Batch Field Updates
// =============================================================================

/**
 * Resolve option ID with case-insensitive fallback.
 * Returns the option ID and warns if case mismatch was used.
 */
function resolveOptionId(
  fieldName: string,
  value: string,
  options: Record<string, string>,
  logger?: Logger
): string | null {
  // Exact match first
  const exact = options[value];
  if (exact) return exact;

  // Case-insensitive fallback
  const lowerValue = value.toLowerCase();
  const match = Object.entries(options).find(
    ([key]) => key.toLowerCase() === lowerValue
  );
  if (match) {
    logger?.warn(`Field '${fieldName}': case mismatch '${value}' → '${match[0]}'`);
    return match[1];
  }

  return null;
}

/**
 * Set multiple project fields on an item.
 * Dispatches to the appropriate mutation based on field type
 * (TEXT, NUMBER, DATE, SINGLE_SELECT).
 *
 * Features (#380):
 * - Case-insensitive option ID resolution with warning
 * - Failed field summary logging
 * - GraphQL error propagation
 *
 * Status 遷移バリデーションはこの関数では行わない（#2544: 二重バリデーション廃止）。
 * ロールバックガードは各 CLI 入口（status transition / pushIssueBody）で実施する。
 */
export async function setItemFields(
  projectId: string,
  itemId: string,
  fields: NonStatusFields,
  logger?: Logger,
  cachedFields?: Record<string, ProjectField>
): Promise<number> {
  if (Object.keys(fields).length === 0) return 0;

  const projectFields = cachedFields ?? await getProjectFields(projectId);
  let updatedCount = 0;
  const failedFields: string[] = [];

  for (const [fieldName, value] of Object.entries(fields)) {
    const resolvedName = resolveFieldName(fieldName, projectFields);
    if (!resolvedName) {
      logger?.warn(`Field '${fieldName}' not found in project`);
      failedFields.push(fieldName);
      continue;
    }

    const fieldInfo = projectFields[resolvedName];

    if (fieldInfo.type === "TEXT") {
      // Text field: set value directly
      if (await updateTextField(projectId, itemId, fieldInfo.id, value, logger)) {
        updatedCount++;
      } else {
        failedFields.push(fieldName);
      }
    } else if (fieldInfo.type === "NUMBER") {
      // Number field: validate and set numeric value
      const num = Number(value);
      if (Number.isNaN(num)) {
        logger?.error(`Invalid ${fieldName} value '${value}': not a number`);
        failedFields.push(fieldName);
      } else if (await updateNumberField(projectId, itemId, fieldInfo.id, num, logger)) {
        updatedCount++;
      } else {
        failedFields.push(fieldName);
      }
    } else if (fieldInfo.type === "DATE") {
      // Date field: set ISO date string
      if (await updateDateField(projectId, itemId, fieldInfo.id, value, logger)) {
        updatedCount++;
      } else {
        failedFields.push(fieldName);
      }
    } else if (fieldInfo.type === "SINGLE_SELECT") {
      // SingleSelect field: resolve option ID with case-insensitive fallback
      const optionId = resolveOptionId(fieldName, value, fieldInfo.options, logger);
      if (optionId) {
        if (await updateSelectField(projectId, itemId, fieldInfo.id, optionId, logger)) {
          updatedCount++;
        } else {
          failedFields.push(fieldName);
        }
      } else {
        const available = Object.keys(fieldInfo.options).sort().join(", ");
        logger?.error(`Invalid ${fieldName} value '${value}'`);
        logger?.info(`  Available options: ${available}`);
        failedFields.push(fieldName);
      }
    } else {
      // Unsupported field type
      logger?.warn(`Field '${fieldName}' has unsupported type '${fieldInfo.type}'`);
      failedFields.push(fieldName);
    }
  }

  if (failedFields.length > 0) {
    logger?.warn(`Failed to update field(s): ${failedFields.join(", ")}`);
  }

  return updatedCount;
}

// =============================================================================
// Timestamp Management
// =============================================================================

/**
 * Generate ISO 8601 local timestamp with timezone offset.
 * Example: "2026-02-10T10:27:24+09:00"
 */
export function generateTimestamp(): string {
  const now = new Date();
  const offset = -now.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const absOffset = Math.abs(offset);
  const hours = String(Math.floor(absOffset / 60)).padStart(2, "0");
  const minutes = String(absOffset % 60).padStart(2, "0");

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day}T${h}:${m}:${s}${sign}${hours}:${minutes}`;
}

