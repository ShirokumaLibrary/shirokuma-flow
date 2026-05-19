/**
 * generate all サブコマンド - 全ドキュメント一括生成
 *
 * 旧 generate.ts の generateCommand() を移植。
 * `generate`（引数なし）のデフォルト実行先。
 */
import { resolve } from "node:path";
import { loadConfig, getOutputPath } from "../../utils/config.js";
import { ensureDir } from "../../utils/file.js";
import { createLogger } from "../../utils/logger.js";
import { t } from "../../utils/i18n.js";
import { typedocCommand } from "./typedoc.js";
import { schemaCommand } from "./schema.js";
import { depsCommand } from "./deps.js";
import { testCasesCommand } from "./test-cases.js";
import { portalCommand } from "./portal.js";
import { searchIndexCommand } from "./search-index.js";
import { packagesCommand } from "./packages.js";
import { githubDataCommand } from "./github-data.js";
/**
 * generate all コマンドハンドラ
 */
export async function cmdGenerateAll(options) {
    const logger = createLogger(options.verbose);
    const projectPath = resolve(options.project);
    logger.info(t("commands.generate.generating", { projectPath }));
    // 設定読み込み
    const config = loadConfig(projectPath, options.config);
    logger.debug(t("commands.generate.projectName", { name: config.project.name }));
    // 出力ディレクトリ作成
    const outputDir = options.output || getOutputPath(config, projectPath, "base");
    const portalDir = getOutputPath(config, projectPath, "portal");
    const generatedDir = getOutputPath(config, projectPath, "generated");
    ensureDir(outputDir);
    ensureDir(portalDir);
    ensureDir(generatedDir);
    logger.info(t("commands.generate.outputDir", { outputDir }));
    const steps = [
        { name: t("commands.generate.stepTypedoc"), fn: typedocCommand },
        { name: t("commands.generate.stepSchema"), fn: schemaCommand },
        { name: t("commands.generate.stepDeps"), fn: depsCommand },
        { name: t("commands.generate.stepTestCases"), fn: testCasesCommand },
        { name: t("commands.generate.stepPackages"), fn: packagesCommand },
        { name: t("commands.generate.stepSearchIndex"), fn: searchIndexCommand },
    ];
    // Add GitHub data step if --with-github is specified
    if (options.withGithub) {
        steps.push({
            name: t("commands.generate.stepGithubData"),
            fn: async (opts) => {
                try {
                    await githubDataCommand({
                        project: opts.project,
                        output: outputDir,
                        verbose: opts.verbose,
                    });
                    return 0;
                }
                catch {
                    return 1;
                }
            },
        });
    }
    // Portal is always last
    steps.push({ name: t("commands.generate.stepPortal"), fn: portalCommand });
    const total = steps.length;
    let completed = 0;
    let failed = 0;
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        logger.step(i + 1, total, t("commands.generate.stepGenerating", { stepName: step.name }));
        try {
            const result = await step.fn({
                project: projectPath,
                config: options.config,
                output: options.output,
                verbose: options.verbose,
            });
            if (typeof result === "number" && result !== 0) {
                failed++;
                logger.warn(t("commands.generate.stepSkipped", { stepName: step.name, error: `exit code ${result}` }));
            }
            else {
                completed++;
                logger.success(t("commands.generate.stepDone", { stepName: step.name }));
            }
        }
        catch (error) {
            failed++;
            logger.warn(t("commands.generate.stepSkipped", { stepName: step.name, error: String(error) }));
        }
    }
    // サマリー
    console.log("");
    logger.info(t("commands.generate.allDone"));
    logger.info(t("commands.generate.successCount", { completed, total }));
    if (failed > 0) {
        logger.warn(t("commands.generate.skipCount", { failed, total }));
    }
    logger.info(t("commands.generate.portal", { outputDir }));
    logger.info(t("commands.generate.portalPath", { portalDir }));
    return failed > 0 ? 1 : 0;
}
//# sourceMappingURL=all.js.map