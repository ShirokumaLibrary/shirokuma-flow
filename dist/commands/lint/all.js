/**
 * lint all サブコマンド - 全 lint 一括実行
 *
 * `lint`（引数なし）のデフォルト実行先。
 * generate/all.ts とは異なり、lint は品質ゲートの役割を持つため:
 * - --strict 時: 1つでもエラーがあれば exit code 1
 * - --strict なし: サマリーを表示して exit 0
 */
import { resolve } from "node:path";
import { createLogger } from "../../utils/logger.js";
import { lintTestsCommand } from "./tests.js";
import { lintCoverageCommand } from "./coverage.js";
import { lintDocsCommand } from "./docs.js";
import { lintCodeCommand } from "./code.js";
import { lintAnnotationsCommand } from "./annotations.js";
import { lintStructureCommand } from "./structure.js";
import { lintWorkflowCommand } from "./workflow.js";
import { lintSecurityCommand } from "./security.js";
/**
 * lint all コマンドハンドラ
 */
export async function cmdLintAll(options) {
    const logger = createLogger(options.verbose);
    const projectPath = resolve(options.project);
    const steps = [
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
    const failures = [];
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
            }
            else {
                completed++;
                logger.success(`lint ${step.name}`);
            }
        }
        catch (error) {
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
//# sourceMappingURL=all.js.map