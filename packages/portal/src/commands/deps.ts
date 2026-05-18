/**
 * deps コマンド - 依存関係グラフ生成
 *
 * dependency-cruiser を使用してモジュール依存関係グラフを生成する。
 *
 * @example
 * ```bash
 * shirokuma-flow deps --project ./my-project
 * ```
 */

import { resolve } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { loadConfig, getOutputPath, resolvePath } from "../utils/config.js";
import { ensureDir, fileExists, writeFile } from "../utils/file.js";
import { createLogger, type Logger } from "../utils/logger.js";
import { t } from "../utils/i18n.js";
import { execFileAsync } from "../utils/spawn-async.js";
import { isLocalBinAvailable } from "../utils/package-check.js";

// パイプが必要な SVG 生成（depcruise | dot）で使用。execFile ではシェルパイプ不可のため exec を維持
const execShellAsync = promisify(exec);

interface DepsOptions {
  project: string;
  config: string;
  output?: string;
  verbose?: boolean;
}

interface DepsConfig {
  include?: string[];
  exclude?: string[];
  output?: string;
  formats?: ("svg" | "json")[];
}

/**
 * dependency-cruiser がインストールされているか確認
 */
function checkDepcruise(
  projectPath: string,
  logger: Logger
): boolean {
  if (isLocalBinAvailable(projectPath, "depcruise")) {
    return true;
  }
  logger.warn(t("commands.deps.dependencyCruiserNotInstalled"));
  logger.info(t("commands.deps.dependencyCruiserInstallHint"));
  return false;
}

/**
 * graphviz (dot) がインストールされているか確認
 */
async function checkGraphviz(logger: Logger): Promise<boolean> {
  const result = await execFileAsync("dot", ["-V"]);
  if (result.exitCode === 0) {
    return true;
  }
  logger.warn(t("commands.deps.graphvizNotInstalled"));
  logger.info(t("commands.deps.graphvizInstallHint"));
  logger.info("           : brew install graphviz (macOS)");
  return false;
}

/**
 * 除外パターンから正規表現文字列を生成
 */
function buildExcludeRegex(patterns: string[]): string {
  return patterns
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
}

/**
 * JSON 形式で依存関係を出力
 */
async function generateJson(
  projectPath: string,
  existingPaths: string[],
  excludeRegex: string,
  outputPath: string,
  logger: Logger,
  verbose: boolean
): Promise<boolean> {
  try {
    const args = [
      "depcruise",
      ...existingPaths,
      "--output-type", "json",
    ];
    if (excludeRegex) {
      args.push("--exclude", `^(${excludeRegex})`);
    }

    logger.debug(t("commands.deps.executingJson", { args: args.join(" ") }));

    const result = await execFileAsync("npx", args, {
      cwd: projectPath,
      maxBuffer: 50 * 1024 * 1024,
    });

    if (result.exitCode !== 0) {
      logger.error(t("commands.deps.jsonGenerateFailed", { error: result.stderr }));
      return false;
    }

    if (result.stderr && verbose) {
      logger.debug(`stderr: ${result.stderr}`);
    }

    // JSON を整形して保存
    const jsonData: unknown = JSON.parse(result.stdout);
    writeFile(outputPath, JSON.stringify(jsonData, null, 2));

    logger.success(t("commands.deps.jsonDataOutput", { path: outputPath }));
    return true;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    logger.error(t("commands.deps.jsonGenerateFailed", { error: errorMessage }));
    return false;
  }
}

/**
 * SVG 形式で依存関係グラフを出力
 */
async function generateSvg(
  projectPath: string,
  existingPaths: string[],
  excludeRegex: string,
  outputPath: string,
  logger: Logger,
  _verbose: boolean
): Promise<boolean> {
  // graphviz が必要
  const hasGraphviz = await checkGraphviz(logger);
  if (!hasGraphviz) {
    logger.warn(t("commands.deps.svgSkipped"));
    return false;
  }

  try {
    // depcruise で DOT 形式を生成し、dot コマンドで SVG に変換
    const svgCmd = [
      "npx depcruise",
      ...existingPaths.map((p) => `"${p}"`),
      "--output-type dot",
      excludeRegex ? `--exclude "^(${excludeRegex})"` : "",
      `| dot -T svg -o "${outputPath}"`,
    ]
      .filter(Boolean)
      .join(" ");

    logger.debug(t("commands.deps.executingSvg", { command: svgCmd }));

    await execShellAsync(svgCmd, {
      cwd: projectPath,
      shell: "/bin/bash",
      maxBuffer: 50 * 1024 * 1024,
    });

    logger.success(t("commands.deps.svgGraphOutput", { path: outputPath }));
    return true;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    logger.error(t("commands.deps.svgGenerateFailed", { error: errorMessage }));
    return false;
  }
}

/**
 * deps コマンドハンドラ
 *
 * @param options - コマンドオプション
 */
export async function depsCommand(options: DepsOptions): Promise<number> {
  const logger = createLogger(options.verbose);
  const projectPath = resolve(options.project);

  logger.info(t("commands.deps.generating"));

  // 設定読み込み
  const config = loadConfig(projectPath, options.config);
  const depsConfig: DepsConfig = config.deps || {};

  // dependency-cruiser がインストールされているか確認
  const hasDepcruise = checkDepcruise(projectPath, logger);
  if (!hasDepcruise) {
    return 1;
  }

  // 出力ディレクトリを決定
  const outputDir =
    options.output ||
    (depsConfig.output
      ? resolvePath(projectPath, depsConfig.output)
      : getOutputPath(config, projectPath, "generated"));

  ensureDir(outputDir);
  logger.debug(t("commands.deps.outputDir", { path: outputDir }));

  // 対象パスを取得
  const includePaths = depsConfig.include || ["src", "lib", "app"];
  const existingPaths = includePaths
    .map((p) => resolvePath(projectPath, p))
    .filter((p) => {
      const exists = fileExists(p);
      if (!exists) {
        logger.debug(t("commands.deps.pathNotFound", { path: p }));
      }
      return exists;
    });

  if (existingPaths.length === 0) {
    logger.warn(t("commands.deps.targetPathNotFound"));
    logger.info(t("commands.deps.searchPath", { paths: includePaths.join(", ") }));
    return 0;
  }

  logger.debug(t("commands.deps.targetPaths", { paths: existingPaths.join(", ") }));

  // 除外パターン
  const excludePatterns = depsConfig.exclude || [
    "node_modules",
    ".next",
    "dist",
  ];
  const excludeRegex = buildExcludeRegex(excludePatterns);

  // 出力フォーマット (デフォルト: svg, json)
  const formats = depsConfig.formats || ["svg", "json"];

  // 各フォーマットで生成
  const results: { format: string; success: boolean }[] = [];

  for (const format of formats) {
    switch (format) {
      case "json": {
        const jsonPath = resolve(outputDir, "dependencies.json");
        const success = await generateJson(
          projectPath,
          existingPaths,
          excludeRegex,
          jsonPath,
          logger,
          options.verbose || false
        );
        results.push({ format: "json", success });
        break;
      }

      case "svg": {
        const svgPath = resolve(outputDir, "dependencies.svg");
        const success = await generateSvg(
          projectPath,
          existingPaths,
          excludeRegex,
          svgPath,
          logger,
          options.verbose || false
        );
        results.push({ format: "svg", success });
        break;
      }

      default:
        logger.warn(t("commands.deps.unsupportedFormat", { format }));
    }
  }

  // 結果サマリー
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  if (successCount > 0) {
    logger.success(
      `依存関係グラフ生成完了 (成功: ${successCount}, 失敗: ${failCount})`
    );
  } else {
    logger.error(t("commands.deps.generateFailed"));
    return 1;
  }
  return 0;
}
