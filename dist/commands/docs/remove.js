/**
 * docs remove subcommand - ドキュメントディレクトリの削除
 */
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "../../utils/config.js";
import { resolveOutputDir } from "./list.js";
import { removeManifestEntry } from "./manifest.js";
// =============================================================================
// Handler
// =============================================================================
export async function cmdRemove(options, logger) {
    const projectPath = options.project ?? process.cwd();
    const config = loadConfig(projectPath, "shirokuma-docs.config.yaml");
    // 削除対象ディレクトリを解決
    const outDir = resolveOutputDir(projectPath, options.name, undefined, config.docs?.outputDir);
    if (!existsSync(outDir)) {
        logger.error(`ドキュメント "${options.name}" が見つかりません: ${resolve(outDir)}\n` +
            "先に `docs fetch <name>` で取得してください。");
        return 1;
    }
    // --yes なしの場合は警告のみ（非インタラクティブ環境対応）
    if (!options.yes) {
        logger.info(`ドキュメント "${options.name}" のローカルファイルを削除します: ${outDir}`);
        logger.info("削除を確認するには --yes オプションを付けて再実行してください。");
        return 0;
    }
    // ディレクトリを削除
    rmSync(outDir, { recursive: true, force: true });
    // manifest からもエントリを削除
    removeManifestEntry(projectPath, options.name, config.docs?.outputDir);
    logger.info(`ドキュメント "${options.name}" を削除しました。`);
    return 0;
}
//# sourceMappingURL=remove.js.map