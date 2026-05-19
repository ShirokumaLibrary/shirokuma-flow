/**
 * status コマンド - Issue ステータス管理サブコマンドファクトリ
 *
 * サブコマンド:
 * - `status transition <number> --to <status>`: ステータス遷移を検証付きで実行
 * - `status approve <number>`: Review → Done 承認遷移
 * - `status update-batch`: Issue ステータスを一括更新
 * - `status get <number>`: 現在ステータスと遷移先候補を取得
 * - `status allowed <N> | --status <S>`: 遷移可能なステータス一覧を返す
 * - `status history <number>`: Status 変更履歴をタイムスタンプ付きで取得（Projects V2 対応）
 */
// Commander.js action callbacks receive opts as any; types are cast at boundary.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Command } from "commander";
import { createActionLogger, setExitCode, resolveFileOption, } from "../../utils/cli-helpers.js";
// =============================================================================
// Factory Function
// =============================================================================
export function createStatusCommand() {
    const status = new Command("status")
        .description("Issue ステータス管理 (transition, approve, update-batch, get, allowed, history)");
    // 共通親オプション
    status
        .option("--owner <owner>", "リポジトリオーナー (デフォルト: 現在のリポジトリ)")
        .option("--public", "公開リポジトリを対象 (repoPairs 設定から)")
        .option("--repo <alias>", "クロスリポジトリのエイリアス (crossRepos 設定から)")
        .option("-v, --verbose", "詳細ログ出力");
    // ---------------------------------------------------------------------------
    // transition
    // ---------------------------------------------------------------------------
    status
        .command("transition <number>")
        .description("Issue のステータス遷移を検証付きで実行する")
        .requiredOption("--to <status>", "遷移先ステータス")
        .option("--via <status>", "中間ステータスを経由して 2 段階遷移する（例: --to Review --via 'In progress' で Backlog → In progress → Review）")
        .option("--force", "遷移ルールを無視して強制遷移")
        .option("--reason <reason>", "--to Blocked 時に必須。Issue コメントとして記録される。")
        .action(async (number, localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdItemTransition } = await import("./transition/index.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdItemTransition(number, options, logger));
    });
    // ---------------------------------------------------------------------------
    // approve
    // ---------------------------------------------------------------------------
    status
        .command("approve <number>")
        .description("Review ステータスの Issue を承認して Done に遷移（Status のみ、Issue 本体はクローズしない）")
        .action(async (number, localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdItemApprove } = await import("./approve/index.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdItemApprove(number, options, logger));
    });
    // ---------------------------------------------------------------------------
    // update-batch
    // ---------------------------------------------------------------------------
    status
        .command("update-batch")
        .description("Issue ステータスを一括更新")
        .option("--done <numbers...>", "Done にする Issue 番号")
        .option("--review <numbers...>", "Review にする Issue 番号")
        .option("--issue-comment <numbers...>", "Issue コメント投稿先の Issue 番号")
        .option("--issue-comment-file <file>", "Issue コメント本文ファイルパス、または - で stdin")
        .option("--force", "子 Issue 未完了ガードをバイパス（親 Issue を子未完で強制 Done）")
        .action(async (localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        // --issue-comment-file はファイル内容に解決する
        if (!resolveFileOption(options, "issueCommentFile", "--issue-comment-file"))
            return;
        const { cmdUpdateStatus } = await import("./update-batch.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdUpdateStatus(options, logger));
    });
    // ---------------------------------------------------------------------------
    // get
    // ---------------------------------------------------------------------------
    status
        .command("get <number>")
        .description("Issue の現在ステータスと遷移可能なステータス一覧を取得する")
        .action(async (number, localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdStatusGet } = await import("./get.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdStatusGet(number, options, logger));
    });
    // ---------------------------------------------------------------------------
    // allowed
    // ---------------------------------------------------------------------------
    status
        .command("allowed [number]")
        .description("遷移可能なステータス一覧を返す（Issue 番号または --status で現在ステータスを指定）")
        .option("--status <status>", "現在のステータスを直接指定（静的照会）")
        .action(async (number, localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdStatusAllowed } = await import("./allowed.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdStatusAllowed(number, options, logger));
    });
    // ---------------------------------------------------------------------------
    // history
    // ---------------------------------------------------------------------------
    status
        .command("history <number>")
        .description("Issue の Status 変更履歴をタイムスタンプ付きで取得する（Projects V2 のみ対応）")
        .option("--limit <number>", "最大取得件数 (デフォルト: 100)", parseInt)
        .option("--project <number>", "特定の Project 番号で履歴をフィルタ", parseInt)
        .option("--format <format>", "出力形式: json, table-json", "table-json")
        .action(async (number, localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdStatusHistory } = await import("./history.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdStatusHistory(number, options, logger));
    });
    return status;
}
//# sourceMappingURL=index.js.map