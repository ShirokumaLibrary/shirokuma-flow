import { existsSync } from "fs";
import { setExitCode } from "@shirokuma-library/lint/errors";
import { readBodyFile, validateBody } from "./github.js";
import { createLogger, type Logger } from "./logger.js";
import { validateCrossRepoAlias } from "./repo-pairs.js";
import type { CommandType } from "./frontmatter-input.js";

export { setExitCode };

/**
 * Commander 親子 option 解決ヘルパー（Issue #2519 / #2521 / #2523 / #2525）。
 * 実装は `@shirokuma-library/lint/commander-opts` に移動済み。flow 内の呼び出し側
 * （lint/skill/issue/pr/project/discussion 等のサブコマンド）は
 * `mergeCommanderOpts as mergeOpts` でエイリアス import している。
 *
 * NOTE: `cli-helpers` をモックしているテスト（`jest.unstable_mockModule`）では
 * モック object に `mergeCommanderOpts` を含める必要がある。
 */
export { mergeCommanderOpts } from "@shirokuma-library/lint/commander-opts";

/**
 * ファイル読み取りエラーを統一フォーマットでメッセージ化する。
 * resolveFileOption / resolveFromFileOption の共通ヘルパー。
 */
function formatFileReadError(err: unknown, source: string, flagName: string): string {
  const errCode = (err as NodeJS.ErrnoException).code;
  switch (errCode) {
    case "EACCES":
      return `ファイルの読み取り権限がありません: ${source}`;
    case "EISDIR":
      return `ディレクトリが指定されました。${flagName} にはファイルパスを指定してください: ${source}`;
    case "ENAMETOOLONG":
      return `パスが長すぎます。${flagName} にはインラインテキストではなくファイルパスを指定してください`;
    default: {
      const msg = err instanceof Error ? err.message : String(err);
      return `Failed to read file for ${flagName}: ${msg}`;
    }
  }
}

/**
 * ファイルパスが存在するか検証し、存在しなければエラー出力して false を返す。
 * resolveFileOption / resolveFromFileOption の共通ヘルパー。
 */
function checkFileExists(source: string, flagName: string): boolean {
  if (source !== "-" && !existsSync(source)) {
    console.error(
      `Error: ファイルが見つかりません: ${source}\n` +
      `${flagName} にはファイルパスを指定してください`
    );
    setExitCode(1);
    return false;
  }
  return true;
}

/**
 * ファイルパスまたは stdin オプションを解決し、内容に置換する。
 * `-` の場合は stdin から読み取る。
 * 失敗時は process.exitCode を設定して false を返す。
 */
export function resolveFileOption(
  options: Record<string, unknown>,
  key: string,
  flagName: string,
): boolean {
  if (options[key] && typeof options[key] === "string") {
    const source = options[key];

    if (!checkFileExists(source, flagName)) return false;

    try {
      const content = readBodyFile(source);
      const bodyError = validateBody(content);
      if (bodyError) {
        console.error(`Error: ${bodyError}`);
        setExitCode(1);
        return false;
      }
      options[key] = content;
    } catch (err) {
      console.error(`Error: ${formatFileReadError(err, source, flagName)}`);
      setExitCode(1);
      return false;
    }
  }
  return true;
}

/** --body-file の解決（後方互換ラッパー） */
export function resolveBodyFileOption(options: Record<string, unknown>): boolean {
  // --from-file 経由で本文が body に設定済みの場合、
  // bodyFile にコピーしてファイル解決をスキップする (#1354)
  if (options["body"] !== undefined && !options["bodyFile"]) {
    options["bodyFile"] = options["body"];
    return true;
  }
  return resolveFileOption(options, "bodyFile", "--body-file");
}

/**
 * --from-file オプションを解決し、frontmatter からフィールドと本文を抽出して options にマージする。
 * --body-file との排他チェックも行う。
 *
 * frontmatter-input モジュール（yaml パーサーを含む）は --from-file 使用時のみ動的にロードする。
 *
 * @param options - CLI オプション（fromFile プロパティを含む）
 * @param commandType - コマンド種別（安全フィールドの決定に使用）
 * @returns 成功時 true、エラー時 false（process.exitCode を設定）
 */
export async function resolveFromFileOption(
  options: Record<string, unknown>,
  commandType: CommandType,
): Promise<boolean> {
  if (!options.fromFile || typeof options.fromFile !== "string") {
    return true;
  }

  // --from-file と本文渡し（残存 --body-file または positional [body-file]）は排他
  if (options.bodyFile) {
    console.error("Error: --from-file と本文ファイル指定 (positional [body-file] / --body-file) は同時に指定できません。--from-file は本文をフロントマターから抽出します");
    setExitCode(1);
    return false;
  }

  const source = options.fromFile;

  if (!checkFileExists(source, "--from-file")) return false;

  try {
    const content = readBodyFile(source);
    const { parseFrontmatterInput, mergeFrontmatterOptions } = await import("./frontmatter-input.js");
    const parsed = parseFrontmatterInput(content, commandType);
    mergeFrontmatterOptions(parsed, options);

    // fromFile は解決済みなので削除
    delete options.fromFile;
    return true;
  } catch (err) {
    console.error(`Error: ${formatFileReadError(err, source, "--from-file")}`);
    setExitCode(1);
    return false;
  }
}

/**
 * --to-file オプションの処理: データを frontmatter 形式でファイルに書き出す。
 * --to-file が指定されていない場合は null を返し、呼び出し元で通常出力を行う。
 * --to-file - の場合は stdout に出力する（--format frontmatter と等価）。
 *
 * formatters / file モジュールは --to-file 使用時のみ動的にロードする。
 *
 * @param data - 出力するデータオブジェクト
 * @param toFile - ファイルパスまたは "-"（stdout）
 * @returns 書き出しを行った場合は 0、toFile 未指定時は null
 */
export async function writeToFile(
  data: Record<string, unknown>,
  toFile: string | undefined,
): Promise<number | null> {
  if (!toFile) return null;

  const { formatFrontmatter } = await import("./formatters.js");
  const formatted = formatFrontmatter(data);

  if (toFile === "-") {
    console.log(formatted);
    return 0;
  }

  const { writeFile } = await import("./file.js");
  writeFile(toFile, formatted + "\n");
  console.error(`Written to ${toFile}`);
  return 0;
}

/**
 * アクションハンドラ共通の初期化: Logger 作成 + cross-repo alias 検証。
 * alias が不正な場合は Error をスローする。
 */
export function createActionLogger(options: Record<string, unknown>): Logger {
  const logger = createLogger(options.verbose as boolean);
  if (options.repo) {
    const aliasError = validateCrossRepoAlias(options.repo as string);
    if (aliasError) { logger.error(aliasError); throw new Error(aliasError); }
  }
  return logger;
}
