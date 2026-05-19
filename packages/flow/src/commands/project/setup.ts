/**
 * projects setup subcommand
 *
 * Status/Priority/Size field initial setup.
 */

import { Logger } from "../../utils/logger.js";
import { t } from "../../utils/i18n.js";
import {
  getProjectFields,
  resolveFieldName,
} from "../../utils/project-fields.js";
import {
  ProjectsOptions,
  runGraphQL,
  getOwner,
  getProjectId,
} from "./helpers.js";

/**
 * フィールド色定義（全言語共通）
 *
 * Status は STATUS_VALUES（status-workflow.ts）と一致する 6 値:
 * Backlog / ToDo / In progress / Blocked / Review / Done
 * 旧オプション（Approved / Completed / Pending / Ready / In Progress / On Hold / Cancelled）は
 * #2202 / #2203 / #2204 / #2439 で廃止済み。既存プロジェクトに残っている旧オプションは
 * detectOptionDiff の警告のみで保持される（破壊しない）。
 * @since ADR-v3-022 6 値モデルへ移行（Backlog 復活）
 * @since #2439 5 値モデルへ移行（Backlog → ToDo、Approved / Completed を削除）
 */
const FIELD_COLORS: Record<string, Record<string, string>> = {
  status: {
    Backlog: "GRAY",
    ToDo: "BLUE",
    "In progress": "YELLOW",
    Blocked: "RED",
    Review: "PURPLE",
    Done: "GREEN",
  },
  priority: {
    Critical: "RED", High: "ORANGE", Medium: "YELLOW", Low: "GRAY",
  },
  size: {
    XS: "GRAY", S: "GREEN", M: "YELLOW", L: "ORANGE", XL: "RED",
  },
};

/** ロケール辞書 */
const SETUP_LOCALES: Record<string, Record<string, Record<string, string>>> = {
  ja: {
    status: {
      Backlog: "未調査・未トリアージ（新規 Issue デフォルト、ADR-v3-022）",
      ToDo: "着手準備完了（計画 Done で syncParentStatus が自動遷移）",
      "In progress": "実装作業中",
      Blocked: "中断中（理由を Issue コメントに記録）",
      Review: "レビュー待ち（PR: コードレビュー、計画 Issue 子: 計画レビュー）",
      Done: "完了（キャンセルも state_reason: not_planned で Done に統一）",
    },
    priority: { Critical: "緊急・最優先", High: "高優先度", Medium: "通常", Low: "低優先度" },
    size: { XS: "数分で完了", S: "1セッションで完了", M: "複数セッション", L: "1日以上", XL: "分割が必要" },
    fieldType: { text: "テキスト" },
  },
  en: {
    status: {
      Backlog: "Uninvestigated / untriaged (default for new Issues, ADR-v3-022)",
      ToDo: "Ready to start (syncParentStatus auto-transitions when plan Done)",
      "In progress": "Active implementation work",
      Blocked: "Blocked (reason recorded in issue comment)",
      Review: "Awaiting review (PR: code review, plan issue child: plan review)",
      Done: "Completed (cancellations unified as Done with state_reason: not_planned)",
    },
    priority: { Critical: "Urgent", High: "High priority", Medium: "Normal", Low: "Low priority" },
    size: { XS: "Minutes", S: "Single session", M: "Multiple sessions", L: "Full day+", XL: "Split needed" },
    fieldType: { text: "text" },
  },
};

/**
 * GraphQL の singleSelectOptions 配列を組み立てる
 */
export function buildSingleSelectOptions(
  colors: Record<string, string>,
  descriptions: Record<string, string>,
): string {
  const items = Object.entries(colors).map(([name, color]) => {
    const desc = descriptions[name] ?? name;
    return `{name: "${name}", color: ${color}, description: "${desc}"}`;
  });
  return `[${items.join(", ")}]`;
}

/** setup サブコマンドのオプション */
export interface SetupOptions extends ProjectsOptions {
  lang?: string;
  fieldId?: string;
  projectId?: string;
  statusOnly?: boolean;
  dryRun?: boolean;
}

/**
 * 定義済みオプションと既存オプションの差分を検出する。
 * ユニットテスト可能な純粋関数。
 */
export function detectOptionDiff(
  existingNames: string[],
  definedNames: string[],
): { missing: string[]; extra: string[] } {
  const existingSet = new Set(existingNames);
  const definedSet = new Set(definedNames);
  const missing = definedNames.filter(name => !existingSet.has(name));
  const extra = existingNames.filter(name => !definedSet.has(name));
  return { missing, extra };
}

/**
 * setup subcommand - Status/Priority/Size フィールドの初期設定
 */
export async function cmdSetup(
  options: SetupOptions,
  logger: Logger,
): Promise<number> {
  const lang = options.lang ?? "en";
  const locale = SETUP_LOCALES[lang];
  if (!locale) {
    logger.error(`Unknown language: ${lang}. Available: ${Object.keys(SETUP_LOCALES).join(", ")}`);
    return 1;
  }

  const dryRun = options.dryRun ?? false;
  if (dryRun) {
    logger.info(t("commands.projects.dryRunPreview"));
  }

  logger.info(`Language: ${lang}`);

  // プロジェクト ID を解決（--project-id 優先、なければ自動検出）
  let projectId = options.projectId ?? null;

  if (!projectId) {
    const owner = options.owner || getOwner();
    if (!owner) {
      logger.error("Could not determine repository owner. Use --owner or --project-id.");
      return 1;
    }
    projectId = await getProjectId(owner);
    if (!projectId) {
      logger.error(`No project found for owner '${owner}'. Use --project-id.`);
      return 1;
    }
  }

  // 全フィールドを1回取得して共有する
  const allFields = projectId ? await getProjectFields(projectId) : {};

  // Status フィールド ID を解決（--field-id 優先、なければ自動検出）
  let fieldId = options.fieldId ?? null;
  if (!fieldId && projectId) {
    const statusField = resolveFieldName("Status", allFields);
    if (statusField) {
      fieldId = allFields[statusField].id;
    }
  }

  // Status フィールド更新（差分検出付き）
  if (fieldId) {
    const statusFieldName = resolveFieldName("Status", allFields);
    const existingOptions = statusFieldName
      ? Object.keys(allFields[statusFieldName].options)
      : [];
    const definedOptions = Object.keys(FIELD_COLORS.status);
    const { missing, extra } = detectOptionDiff(existingOptions, definedOptions);

    if (existingOptions.length > 0 && missing.length === 0 && extra.length === 0) {
      // 差分なし → スキップ
      logger.info("\n[Status] Already up to date, skipped");
    } else if (existingOptions.length > 0 && missing.length < definedOptions.length && !options.force) {
      // 既存オプションあり + 差分あり + --force なし → 警告のみ
      logger.info("\n[Status] Options differ from definition:");
      if (missing.length > 0) {
        logger.warn(`  Missing: ${missing.join(", ")}`);
      }
      if (extra.length > 0) {
        logger.info(`  Extra (not in definition): ${extra.join(", ")}`);
      }
      if (dryRun) {
        logger.info(t("commands.projects.dryRunForceHint"));
      } else {
        logger.warn("  Use --force to replace all options (WARNING: existing items will lose their Status)");
      }
    } else {
      // 初回セットアップ（完全不一致）または --force → 全置換
      if (options.force && existingOptions.length > 0 && missing.length < definedOptions.length) {
        logger.warn("\n[Status] --force: Replacing all options (existing items will lose their Status)");
      } else {
        logger.info("\n[Status] Updating field...");
      }
      if (dryRun) {
        logger.info(t("commands.projects.dryRunStatusUpdateHint"));
        logger.info(`  [DRY RUN] オプション: ${definedOptions.join(", ")}`);
      } else {
        const statusOptions = buildSingleSelectOptions(FIELD_COLORS.status, locale.status);
        const query = `mutation { updateProjectV2Field(input: { fieldId: "${fieldId}", name: "Status", singleSelectOptions: ${statusOptions} }) { projectV2Field { ... on ProjectV2SingleSelectField { name options { name description } } } } }`;
        const result = await runGraphQL(query, {});
        if (result.success) {
          logger.success("  Status updated");
        } else {
          logger.error("  Status update failed");
        }
      }
    }
  }

  // Priority/Size フィールド作成（既存検出付き）
  if (projectId && !options.statusOnly) {
    for (const [fieldName, fieldKey] of [["Priority", "priority"], ["Size", "size"]] as const) {
      const existingField = resolveFieldName(fieldName, allFields);
      if (existingField) {
        logger.info(`\n[${fieldName}] Already exists, skipped`);
        continue;
      }
      if (dryRun) {
        const optionNames = Object.keys(FIELD_COLORS[fieldKey]);
        logger.info(`\n[${fieldName}] [DRY RUN] フィールドを作成します`);
        logger.info(`  [DRY RUN] オプション: ${optionNames.join(", ")}`);
      } else {
        logger.info(`\n[${fieldName}] Creating field...`);
        const fieldOptions = buildSingleSelectOptions(FIELD_COLORS[fieldKey], locale[fieldKey]);
        const createQuery = `mutation { createProjectV2Field(input: { projectId: "${projectId}", dataType: SINGLE_SELECT, name: "${fieldName}", singleSelectOptions: ${fieldOptions} }) { projectV2Field { ... on ProjectV2SingleSelectField { name options { name } } } } }`;
        const result = await runGraphQL(createQuery, {});
        if (result.success) {
          logger.success(`  ${fieldName} created`);
        } else {
          logger.error(`  ${fieldName} creation failed`);
        }
      }
    }

  }

  logger.info("\nTip: Rename the default View \"View 1\" in GitHub UI:");
  logger.info("  TABLE → \"Board\", BOARD → \"Kanban\", ROADMAP → \"Roadmap\"");
  logger.info("\nDone!");
  return 0;
}
