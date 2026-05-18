/**
 * typedoc コマンド - TypeDoc API ドキュメント生成
 *
 * TypeDoc API を使用して、Server Actions や DB スキーマの
 * API ドキュメントを生成する。
 *
 * - typedoc-plugin-markdown がある場合: Markdown 出力
 * - ない場合: HTML 出力
 */

import { resolve } from "node:path";
import { loadConfig, getOutputPath, resolvePath } from "../utils/config.js";
import { ensureDir, fileExists, dirExists } from "../utils/file.js";
import { createLogger, type Logger } from "../utils/logger.js";
import { t } from "../utils/i18n.js";
import { isPackageInstalled, isLocalBinAvailable } from "../utils/package-check.js";
import { execFileAsync } from "../utils/spawn-async.js";

interface TypedocOptions {
  project: string;
  config: string;
  output?: string;
  verbose?: boolean;
}

/**
 * TypeDoc がインストールされているか確認
 */
function isTypedocInstalled(projectPath: string): boolean {
  return isLocalBinAvailable(projectPath, "typedoc");
}

/**
 * typedoc-plugin-markdown がインストールされているか確認
 */
function checkMarkdownPluginInstalled(
  projectPath: string,
  logger: Logger
): boolean {
  const found = isPackageInstalled(projectPath, "typedoc-plugin-markdown");
  if (found) {
    logger.debug("typedoc-plugin-markdown が見つかりました");
  } else {
    logger.debug("typedoc-plugin-markdown がインストールされていません");
  }
  return found;
}

/**
 * TypeDoc を使用してドキュメントを生成 (npx経由)
 */
async function generateDocs(
  projectPath: string,
  entryPoints: string[],
  outputDir: string,
  tsconfigPath: string,
  plugins: string[],
  exclude: string[],
  logger: Logger
): Promise<boolean> {
  logger.debug(`エントリーポイント: ${entryPoints.join(", ")}`);
  logger.debug(`出力先: ${outputDir}`);
  logger.debug(
    `プラグイン: ${plugins.length > 0 ? plugins.join(", ") : "なし"}`
  );

  // 引数配列を構築
  const args = [
    "typedoc",
    ...entryPoints,
    "--out", outputDir,
    "--tsconfig", tsconfigPath,
    "--excludePrivate",
    "--excludeProtected",
    "--excludeInternal",
    "--hideGenerator",
    "--entryPointStrategy", "expand",
  ];

  // プラグインを追加
  for (const plugin of plugins) {
    args.push("--plugin", plugin);
  }

  // 除外パターンを追加
  for (const pattern of exclude) {
    args.push("--exclude", pattern);
  }

  logger.debug(`実行: npx ${args.join(" ")}`);

  const result = await execFileAsync("npx", args, {
    cwd: projectPath,
  });

  if (result.exitCode === 0) {
    logger.success(`ドキュメント生成完了: ${outputDir}`);
    return true;
  }

  logger.error(`TypeDoc 生成エラー: ${result.stderr}`);
  return false;
}

/**
 * typedoc コマンドハンドラ
 */
export async function typedocCommand(options: TypedocOptions): Promise<number> {
  const logger = createLogger(options.verbose);
  const projectPath = resolve(options.project);

  logger.info(t("commands.typedoc.generating"));

  // TypeDoc インストール確認
  if (!isTypedocInstalled(projectPath)) {
    logger.error(t("commands.typedoc.notInstalled"));
    logger.info(t("commands.typedoc.installHint"));
    return 1;
  }
  logger.debug("TypeDoc: インストール確認済み");

  // 設定読み込み
  const config = loadConfig(projectPath, options.config);
  const typedocConfig = config.typedoc;

  if (!typedocConfig?.entryPoints?.length) {
    logger.warn(t("commands.typedoc.noEntryPoint"));
    logger.info(t("commands.typedoc.configExample"));
    logger.info("  typedoc:");
    logger.info(
      '    entryPoints: ["./apps/web/lib/actions", "./packages/database/src/schema"]'
    );
    return 0;
  }

  // エントリーポイントを解決・検証
  const entryPoints: string[] = [];
  for (const ep of typedocConfig.entryPoints) {
    const resolvedPath = resolvePath(projectPath, ep);

    if (fileExists(resolvedPath) || dirExists(resolvedPath)) {
      entryPoints.push(resolvedPath);
      logger.debug(`エントリーポイント追加: ${resolvedPath}`);
    } else {
      logger.warn(`エントリーポイントが見つかりません: ${resolvedPath}`);
    }
  }

  if (entryPoints.length === 0) {
    logger.error(t("commands.typedoc.noValidEntryPoints"));
    return 1;
  }

  // 出力ディレクトリを決定
  // 優先順位: CLI引数 > typedoc.out > output.generated/api
  let outputDir: string;
  if (options.output) {
    outputDir = resolve(options.output, "api");
  } else if (typedocConfig.out) {
    outputDir = resolvePath(projectPath, typedocConfig.out);
  } else {
    const generatedDir = getOutputPath(config, projectPath, "generated");
    outputDir = resolve(generatedDir, "api");
  }

  ensureDir(outputDir);

  // tsconfig パス
  const tsconfigPath = typedocConfig.tsconfig
    ? resolvePath(projectPath, typedocConfig.tsconfig)
    : resolve(projectPath, "tsconfig.json");

  if (!fileExists(tsconfigPath)) {
    logger.warn(`tsconfig が見つかりません: ${tsconfigPath}`);
    logger.info(t("commands.typedoc.noTsConfig"));
  }

  // 除外パターン
  const exclude = typedocConfig.exclude || [
    "**/node_modules/**",
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.spec.ts",
    "**/*.spec.tsx",
  ];

  // プラグインを決定
  // 設定ファイルで指定されている場合はそれを使用
  // 指定がない場合は typedoc-plugin-markdown の存在を確認
  let plugins: string[] = [];

  if (typedocConfig.plugin && typedocConfig.plugin.length > 0) {
    plugins = typedocConfig.plugin;
    logger.debug("設定ファイルからプラグインを使用");
  } else {
    // typedoc-plugin-markdown が利用可能か確認
    const hasMarkdownPlugin = checkMarkdownPluginInstalled(projectPath, logger);
    if (hasMarkdownPlugin) {
      plugins = ["typedoc-plugin-markdown"];
      logger.info(t("commands.typedoc.outputMarkdown"));
    } else {
      logger.info(t("commands.typedoc.outputHtml"));
    }
  }

  // ドキュメント生成
  const success = await generateDocs(
    projectPath,
    entryPoints,
    outputDir,
    tsconfigPath,
    plugins,
    exclude,
    logger
  );

  if (!success) {
    return 1;
  }

  logger.success(t("commands.typedoc.done"));
  return 0;
}
