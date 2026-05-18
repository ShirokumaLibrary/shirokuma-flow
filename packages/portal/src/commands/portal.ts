/**
 * portal コマンド - ドキュメントポータル HTML 生成
 *
 * Handlebars + クライアント JS ベースの静的 HTML ポータルを生成する。
 */

import { resolve } from "node:path";
import { existsSync, writeFileSync } from "node:fs";
import { createLogger } from "../utils/logger.js";
import { loadConfig, getOutputPath } from "../utils/config.js";
import { t } from "../utils/i18n.js";
import { PortalGenerator } from "../generators/portal/index.js";
import { runApiTools } from "./api-tools.js";

interface PortalOptions {
  project: string;
  config: string;
  output?: string;
  verbose?: boolean;
}

/**
 * portal コマンドハンドラ
 */
export async function portalCommand(options: PortalOptions): Promise<number> {
  const logger = createLogger(options.verbose);
  const projectPath = resolve(options.project);

  logger.info(t("commands.portal.generating"));

  // 設定読み込み
  const config = loadConfig(projectPath, options.config);

  // 出力ディレクトリ
  const outputDir = options.output
    ? resolve(options.output)
    : getOutputPath(config, projectPath, "portal");

  // データ JSON を事前生成（存在しない場合のみ）
  const apiToolsPath = resolve(outputDir, "api-tools.json");
  if (!existsSync(apiToolsPath)) {
    try {
      await runApiTools({ projectPath, configPath: options.config, outputDir });
    } catch (e) {
      logger.debug(`api-tools.json の生成をスキップ: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // カバレッジレポートは外部（flow の lint-coverage コマンド）で生成するため portal では省略
  // coverage.json が既に存在する場合は PortalGenerator が自動利用する

  const generator = new PortalGenerator({
    projectPath,
    projectName: config.project.name,
    outputDir,
    verbose: options.verbose,
  });

  await generator.generate();
  logger.success(`ポータルを生成しました: ${outputDir}`);

  return 0;
}
