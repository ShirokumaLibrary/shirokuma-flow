/**
 * skill command - Commander.js nested subcommand factory
 *
 * Creates the top-level `skill` Command with all skill management subcommands.
 * Follows the same pattern as lint/index.ts.
 *
 * Usage in index.ts:
 *   import { createSkillCommand } from "./commands/skill/index.js";
 *   program.addCommand(createSkillCommand());
 */
// Commander.js mergeOpts returns a merged options object typed via as-cast at the boundary.
// Dynamic imports mean each sub-option type is not statically known here.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Command } from "commander";
import { setExitCode } from "../../utils/cli-helpers.js";
import { validateProjectPath } from "../../utils/sanitize.js";
// =============================================================================
// Helpers
// =============================================================================
/**
 * 親オプションとローカルオプションをマージして返す。
 *
 * SkillCommonOptions とサブコマンド固有オプションの intersection を返す。
 * Commander.js が実行時に型付きオプションのみ登録するため、このキャストは安全。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mergeOpts(command, localOpts) {
    return { ...(command.parent?.opts() ?? {}), ...localOpts };
}
// =============================================================================
// Factory Function
// =============================================================================
export function createSkillCommand() {
    const skill = new Command("skill")
        .description("スキル管理 (validate, package, eval, optimize, benchmark)");
    // 共通親オプション（全サブコマンドで command.parent?.opts() 経由で利用可能）
    skill
        .option("-p, --project <path>", "プロジェクトパス", process.cwd())
        .option("-v, --verbose", "詳細ログ出力");
    // パストラバーサル対策: 全サブコマンドの実行前にプロジェクトパスを検証
    skill.hook("preAction", (thisCommand) => {
        const opts = thisCommand.opts();
        if (opts.project) {
            opts.project = validateProjectPath(opts.project);
        }
    });
    // ---------------------------------------------------------------------------
    // validate
    // ---------------------------------------------------------------------------
    skill
        .command("validate <skill-path>")
        .description("SKILL.md のフロントマター構造を検証")
        .action(async (skillPath, _localOpts, command) => {
        const options = mergeOpts(command, { skillPath });
        const { cmdSkillValidate } = await import("./validate.js");
        setExitCode(cmdSkillValidate(options));
    });
    // ---------------------------------------------------------------------------
    // package
    // ---------------------------------------------------------------------------
    skill
        .command("package <skill-path>")
        .description("スキルフォルダを .skill ファイル（zip）にパッケージ化")
        .option("-o, --output <dir>", "出力ディレクトリ（デフォルト: カレントディレクトリ）")
        .action(async (skillPath, localOpts, command) => {
        const options = mergeOpts(command, { ...localOpts, skillPath });
        const { cmdSkillPackage } = await import("./package.js");
        setExitCode(cmdSkillPackage(options));
    });
    // ---------------------------------------------------------------------------
    // eval
    // ---------------------------------------------------------------------------
    skill
        .command("eval <skill-path>")
        .description("スキルのトリガー eval を実行（eval セット JSON が必要）")
        .option("--eval-set <file>", "eval セット JSON ファイルパス")
        .option("--description <text>", "テストする説明のオーバーライド")
        .option("--num-workers <n>", "並列ワーカー数", parseInt)
        .option("--timeout <seconds>", "クエリ1件あたりのタイムアウト（秒）", parseInt)
        .option("--runs-per-query <n>", "クエリあたりの実行回数", parseInt)
        .option("--trigger-threshold <rate>", "トリガー率の閾値", parseFloat)
        .option("--model <model>", "使用モデル")
        .option("--output <file>", "結果を JSON ファイルに出力（- で stdout）")
        .action(async (skillPath, localOpts, command) => {
        const options = mergeOpts(command, { ...localOpts, skillPath });
        const { cmdSkillEval } = await import("./eval.js");
        setExitCode(await cmdSkillEval(options));
    });
    // ---------------------------------------------------------------------------
    // optimize
    // ---------------------------------------------------------------------------
    skill
        .command("optimize <skill-path>")
        .description("eval + 改善ループでスキルの説明を最適化")
        .option("--eval-set <file>", "eval セット JSON ファイルパス")
        .option("--description <text>", "開始説明のオーバーライド")
        .option("--num-workers <n>", "並列ワーカー数", parseInt)
        .option("--timeout <seconds>", "クエリ1件あたりのタイムアウト（秒）", parseInt)
        .option("--max-iterations <n>", "最大イテレーション数", parseInt)
        .option("--runs-per-query <n>", "クエリあたりの実行回数", parseInt)
        .option("--trigger-threshold <rate>", "トリガー率の閾値", parseFloat)
        .option("--holdout <fraction>", "テストセット用ホールドアウト割合（0でなし）", parseFloat)
        .option("--model <model>", "改善に使用するモデル")
        .option("--results-dir <dir>", "結果の保存ディレクトリ")
        .action(async (skillPath, localOpts, command) => {
        const options = mergeOpts(command, { ...localOpts, skillPath });
        const { cmdSkillOptimize } = await import("./optimize.js");
        setExitCode(await cmdSkillOptimize(options));
    });
    // ---------------------------------------------------------------------------
    // benchmark
    // ---------------------------------------------------------------------------
    skill
        .command("benchmark <benchmark-dir>")
        .description("benchmark ディレクトリのランを集計して benchmark.json + .md を生成")
        .option("--skill-name <name>", "ベンチマーク対象スキル名")
        .option("--skill-path <path>", "ベンチマーク対象スキルパス")
        .option("-o, --output <file>", "benchmark.json の出力先（デフォルト: <benchmark-dir>/benchmark.json）")
        .action(async (benchmarkDir, localOpts, command) => {
        const options = mergeOpts(command, { ...localOpts, benchmarkDir });
        const { cmdSkillBenchmark } = await import("./benchmark.js");
        setExitCode(cmdSkillBenchmark(options));
    });
    return skill;
}
//# sourceMappingURL=index.js.map