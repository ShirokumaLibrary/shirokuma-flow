/**
 * lint all サブコマンド - 全 lint 一括実行
 *
 * `lint`（引数なし）のデフォルト実行先。
 * generate/all.ts とは異なり、lint は品質ゲートの役割を持つため:
 * - --strict 時: 1つでもエラーがあれば exit code 1
 * - --strict なし: サマリーを表示して exit 0
 *
 * JSON モード（-f json）時は、各サブコマンドの出力を一時ファイルに捕捉し
 * 集約 JSON として 1 オブジェクトだけ stdout に出力する。
 * terminal / summary / yaml モードでは従来通り各サブコマンドが直接 stdout に書き出す。
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createLogger } from "../../utils/logger.js";
import { lintTestsCommand } from "./tests.js";
import { lintCoverageCommand } from "./coverage.js";
import { lintDocsCommand } from "./docs.js";
import { lintCodeCommand } from "./code.js";
import { lintAnnotationsCommand } from "./annotations.js";
import { lintStructureCommand } from "./structure.js";
import { lintWorkflowCommand } from "./workflow.js";
import { lintSecurityCommand } from "./security.js";

interface LintAllOptions {
  project: string;
  config: string;
  format?: string;
  output?: string;
  strict?: boolean;
  verbose?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LintFn = (opts: any) => Promise<number> | number;

interface LintStep {
  name: string;
  fn: LintFn;
  formatDefault?: string;
}

/**
 * JSON モード時の集約結果型
 */
interface LintAllJsonResult {
  results: Record<string, unknown>;
  summary: {
    completed: number;
    failed: number;
    total: number;
    failures: string[];
  };
}

/**
 * lint all コマンドハンドラ
 */
export async function cmdLintAll(options: LintAllOptions): Promise<number> {
  const isJsonMode = options.format === "json";
  const logger = createLogger(options.verbose, isJsonMode);
  const projectPath = resolve(options.project);

  const steps: LintStep[] = [
    { name: "tests", fn: lintTestsCommand },
    { name: "coverage", fn: lintCoverageCommand },
    { name: "docs", fn: lintDocsCommand },
    { name: "code", fn: lintCodeCommand },
    { name: "annotations", fn: lintAnnotationsCommand },
    { name: "structure", fn: lintStructureCommand, formatDefault: "yaml" },
    { name: "workflow", fn: lintWorkflowCommand },
    { name: "security", fn: lintSecurityCommand },
  ];

  const total = steps.length;
  let completed = 0;
  let failed = 0;
  const failures: string[] = [];

  if (isJsonMode) {
    // JSON モード: 各サブコマンドの出力を一時ファイルに捕捉して集約
    const tmpDir = mkdtempSync(join(tmpdir(), "shirokuma-lint-all-"));
    const results: Record<string, unknown> = {};

    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        logger.step(i + 1, total, `lint ${step.name}`);
        const tmpFile = join(tmpDir, `${step.name}.json`);

        try {
          const exitCode = await step.fn({
            project: projectPath,
            config: options.config,
            format: "json",
            output: tmpFile,
            strict: options.strict,
            verbose: options.verbose,
          });

          // 一時ファイルから JSON を読み込む
          try {
            const raw = readFileSync(tmpFile, "utf-8");
            results[step.name] = JSON.parse(raw);
          } catch {
            // ファイル未生成またはパース失敗時はエラーとして記録
            results[step.name] = { error: "output_parse_failed" };
          }

          if (exitCode !== 0) {
            failed++;
            failures.push(step.name);
            logger.warn(`lint ${step.name}: exit code ${exitCode}`);
          } else {
            completed++;
            logger.success(`lint ${step.name}`);
          }
        } catch (error) {
          failed++;
          failures.push(step.name);
          results[step.name] = { error: String(error) };
          logger.warn(`lint ${step.name}: ${String(error)}`);
        }
      }

      // 集約 JSON を構築して出力
      const aggregated: LintAllJsonResult = {
        results,
        summary: { completed, failed, total, failures },
      };
      const jsonOutput = JSON.stringify(aggregated, null, 2);

      if (options.output) {
        writeFileSync(options.output, jsonOutput, "utf-8");
        logger.success(`レポートを出力: ${options.output}`);
      } else {
        console.log(jsonOutput);
      }
    } finally {
      // 一時ディレクトリをクリーンアップ
      try {
        rmSync(tmpDir, { recursive: true });
      } catch {
        // クリーンアップ失敗は無視（警告のみ）
        logger.warn(`一時ディレクトリの削除に失敗: ${tmpDir}`);
      }
    }
  } else {
    // terminal / summary / yaml モード: 従来通り各サブコマンドが直接 stdout に書き出す
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      logger.step(i + 1, total, `lint ${step.name}`);

      try {
        const exitCode = await step.fn({
          project: projectPath,
          config: options.config,
          format: step.formatDefault ?? options.format,
          output: options.output,
          strict: options.strict,
          verbose: options.verbose,
        });
        if (exitCode !== 0) {
          failed++;
          failures.push(step.name);
          logger.warn(`lint ${step.name}: exit code ${exitCode}`);
        } else {
          completed++;
          logger.success(`lint ${step.name}`);
        }
      } catch (error) {
        failed++;
        failures.push(step.name);
        logger.warn(`lint ${step.name}: ${String(error)}`);
      }
    }

    // サマリー
    console.log("");
    logger.info(`lint 完了: ${completed}/${total} 成功`);
    if (failed > 0) {
      logger.warn(`${failed}/${total} 失敗: ${failures.join(", ")}`);
      if (options.strict) {
        return 1;
      }
    }
    return 0;
  }

  // JSON モード時の終了コード
  if (failed > 0 && options.strict) {
    return 1;
  }
  return 0;
}
