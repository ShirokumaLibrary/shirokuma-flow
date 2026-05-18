/**
 * plugin コマンド - プラグイン管理サブコマンドファクトリ (#2647)
 *
 * サブコマンド:
 * - `plugin install [--prerelease]`: stable / prerelease チャネル切替
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { Command } from "commander";
import { setExitCode } from "../../utils/cli-helpers.js";

export function createPluginCommand(): Command {
  const plugin = new Command("plugin").description("プラグイン管理 (install)");

  plugin
    .command("install")
    .description(
      "プラグインの配信チャネルを切り替える (stable / prerelease)。内部で claude plugin marketplace remove → add を実行"
    )
    .option("--prerelease", "prerelease チャネル (ShirokumaDevelopment/shirokuma-plugins) を install")
    .option("--dry-run", "実行内容をプレビューのみ表示")
    .action(async (localOpts) => {
      const { pluginInstallCommand } = await import("./install.js");
      setExitCode(pluginInstallCommand(localOpts));
    });

  return plugin;
}
