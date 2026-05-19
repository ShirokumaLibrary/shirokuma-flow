/**
 * git command - Commander.js nested subcommand factory
 *
 * Creates the top-level `git` Command with subcommands registered.
 *
 * Usage in index.ts:
 *   import { createGitCommand } from "./commands/git/index.js";
 *   program.addCommand(createGitCommand());
 */
// Commander.js action callbacks receive localOpts as any; parent opts cast via as at boundary.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Command } from "commander";
import { createActionLogger, setExitCode } from "../../utils/cli-helpers.js";
// =============================================================================
// Factory Function
// =============================================================================
export function createGitCommand() {
    const git = new Command("git")
        .description("Git 状態管理 (check, commit-push)");
    // Common parent options
    git.option("-v, --verbose", "詳細ログ出力");
    // ---------------------------------------------------------------------------
    // check
    // ---------------------------------------------------------------------------
    git
        .command("check")
        .description("Pre-push git state を1コマンドで取得（branch, status, log, diff を統合）")
        .action(async (localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdGitCheck } = await import("./check.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdGitCheck(options, logger));
    });
    // ---------------------------------------------------------------------------
    // commit-push
    // ---------------------------------------------------------------------------
    git
        .command("commit-push")
        .description("git add + commit + push を1操作で実行（JSON 出力）")
        .requiredOption("-m, --message <message>", "コミットメッセージ（必須）")
        .option("-f, --files <files...>", "ステージングするファイルパス（省略時は全変更）")
        .option("-i, --issue <number>", "Issue 番号（コミットメッセージに (#N) を付与）", parseInt)
        .action(async (localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdGitCommitPush } = await import("./commit-push.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdGitCommitPush(options, logger));
    });
    return git;
}
//# sourceMappingURL=index.js.map