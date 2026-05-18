/**
 * workflow-claude-md ルール群
 *
 * CLAUDE.md の品質を機械的に検証する 2 つのルール:
 *   - claude-md-budget: CLAUDE.md の行数上限チェック（ADR-v3-021 リスク緩和策）
 *   - claude-md-index-drift: CLAUDE.md と index ファイルの整合性チェック
 *
 * @see ADR-v3-021 (Discussion #2506)
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { extractLinks, classifyLink } from "../../validators/link-checker.js";
import type { WorkflowIssue, WorkflowIssueSeverity } from "../workflow-types.js";

// 警告レベルで導入し、誤検知率を観測してから error 昇格を検討する
export const DEFAULT_BUDGET_LINES = 150;
export const DEFAULT_INDEX_DIR = ".shirokuma/rules/shirokuma-flow";

export function validateClaudeMdBudget(
  content: string,
  filePath: string,
  severity: WorkflowIssueSeverity = "warning",
  maxLines: number = DEFAULT_BUDGET_LINES
): WorkflowIssue[] {
  const lineCount = content.split("\n").length;
  if (lineCount <= maxLines) return [];
  return [
    {
      type: severity,
      message: `CLAUDE.md exceeds line budget: ${lineCount} lines (max: ${maxLines})`,
      rule: "claude-md-budget",
      context: `${filePath} (${lineCount}/${maxLines} lines)`,
    },
  ];
}

export function extractLocalMdLinks(content: string): string[] {
  return extractLinks(content)
    .filter((link) => {
      const type = classifyLink(link.url);
      return (type === "relative" || type === "absolute") && link.url.endsWith(".md");
    })
    .map((link) => link.url);
}

export function validateClaudeMdIndexDrift(
  claudeMdContent: string,
  claudeMdPath: string,
  projectPath: string,
  indexDir: string = DEFAULT_INDEX_DIR
): WorkflowIssue[] {
  const issues: WorkflowIssue[] = [];
  const referencedPaths = extractLocalMdLinks(claudeMdContent);

  for (const refPath of referencedPaths) {
    if (!existsSync(join(projectPath, refPath))) {
      issues.push({
        type: "error",
        message: `CLAUDE.md references non-existent file: ${refPath}`,
        rule: "claude-md-index-drift",
        context: `${claudeMdPath} → ${refPath}`,
      });
    }
  }

  const absoluteIndexDir = join(projectPath, indexDir);
  if (existsSync(absoluteIndexDir)) {
    try {
      const entries = readdirSync(absoluteIndexDir);
      for (const entry of entries) {
        if (!entry.endsWith("-index.md")) continue;
        const relPath = `${indexDir}/${entry}`;
        const isReferenced = referencedPaths.some(
          (p) => p === relPath || p.endsWith(`/${entry}`)
        );
        if (!isReferenced) {
          issues.push({
            type: "warning",
            message: `Index file is not referenced from CLAUDE.md: ${relPath}`,
            rule: "claude-md-index-drift",
            context: relPath,
          });
        }
      }
    } catch (err) {
      // readdir 失敗時は info レベルで報告（warning を出すほどではないが silent skip も避ける）
      issues.push({
        type: "info",
        message: `Could not enumerate index directory: ${(err as Error).message}`,
        rule: "claude-md-index-drift",
        context: indexDir,
      });
    }
  }

  return issues;
}
