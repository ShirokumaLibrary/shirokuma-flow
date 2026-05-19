/**
 * issue コマンド - Issue 専用サブコマンドファクトリ (#2217 Phase 5-2)
 *
 * items コマンドから Issue 専用サブコマンドを分離し、新カテゴリ `issue` として提供する。
 *
 * サブコマンド（キャッシュ管理）:
 * - `issue pull <number>`: GitHub → キャッシュ（本体 + コメント）
 * - `issue push <number> [commentId]`: キャッシュ → GitHub（本体または特定コメント）
 * - `issue add --file <file>`: Issue を作成してキャッシュに移動
 * - `issue comment <number> --file <file>`: コメントを追加してキャッシュに移動
 * - `issue check [number]`: ローカルとリモートの差分を表示
 * - `issue close <number>`: Issue をクローズ
 * - `issue cancel <number>`: Issue をキャンセル (NOT_PLANNED でクローズ)
 * - `issue reopen <number>`: クローズ済み Issue を再オープン
 * - `issue remove <number>`: プロジェクトから Issue を削除
 * - `issue fields`: プロジェクトフィールド定義を表示
 *
 * サブコマンド（GitHub 参照・管理）:
 * - `issue list`: Issue 一覧を Projects フィールド付きで取得
 * - `issue comments <number>`: Issue の全コメントを一覧表示
 * - `issue assign <number> <user>`: Issue に担当者を追加
 * - `issue unassign <number> <user>`: Issue から担当者を削除
 * - `issue parent <number> <parent-number>`: Issue を親 Issue のサブ Issue に設定
 * - `issue unparent <number>`: Issue の親 Issue 紐付けを解除
 * - `issue sub-list <parent>`: 親 Issue のサブ Issue を一覧表示
 * - `issue import`: 公開リポジトリから Issue をインポート
 * - `issue update <number>`: Issue の本文・メタデータを1コマンドで更新
 * - `issue context <number>`: 関連情報を一括取得してキャッシュに書き込む
 * - `issue branch <number>`: Issue 番号を起点にフィーチャーブランチを作成
 * - `issue link <number>`: Issue と Discussion のリンクを管理
 * - `issue rollback <number>`: Issue / PR の切り戻し操作
 * - `issue search <query>`: Issue / PR / Discussion を横断検索
 * - `issue template`: Issue / PR / ADR / コメントのテンプレートを生成
 */
// Commander.js action callbacks receive localOpts as any; parent opts cast via as at boundary.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { Command } from "commander";
import { createActionLogger, setExitCode, resolveBodyFileOption } from "../../utils/cli-helpers.js";
import { createTemplateCommand } from "./template/index.js";
// =============================================================================
// Factory Function
// =============================================================================
export function createIssueCommand() {
    const issue = new Command("issue")
        .description("Issue 管理 (list, comments, pull, push, add, comment, close, cancel, reopen, check, remove, fields, parent, unparent, sub-list, assign, unassign, import, update, context, branch, link, rollback, search, template)");
    // 共通親オプション
    issue
        .option("--owner <owner>", "リポジトリオーナー (デフォルト: 現在のリポジトリ)")
        .option("--public", "公開リポジトリを対象 (repoPairs 設定から)")
        .option("--repo <alias>", "クロスリポジトリのエイリアス (crossRepos 設定から)")
        .option("-v, --verbose", "詳細ログ出力");
    // ---------------------------------------------------------------------------
    // pull
    // ---------------------------------------------------------------------------
    issue
        .command("pull <number>")
        .description("GitHub から Issue / Discussion を取得してキャッシュに書き込む（本体 + コメント）")
        .option("--dir <dir>", "キャッシュディレクトリ（デフォルト: .shirokuma/github）")
        .action(async (number, localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdPull } = await import("./pull/index.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdPull(number, options, logger));
    });
    // ---------------------------------------------------------------------------
    // push
    // ---------------------------------------------------------------------------
    issue
        .command("push <number> [commentId]")
        .description("ローカルキャッシュの変更を GitHub に送信する（本体または特定コメント）")
        .option("--force", "ステータス遷移バリデーションを無視して強制実行")
        .action(async (number, commentId, localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdPush } = await import("./push/index.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdPush(number, commentId, options, logger));
    });
    // ---------------------------------------------------------------------------
    // add
    // ---------------------------------------------------------------------------
    issue
        .command("add")
        .description("Issue を作成してキャッシュに移動する（frontmatter から title 等を読み取り）")
        .option("--file <file>", "frontmatter 付き Markdown ファイルパス")
        .action(async (localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdAddIssue } = await import("./add/index.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdAddIssue(options, logger));
    });
    // ---------------------------------------------------------------------------
    // comment
    // ---------------------------------------------------------------------------
    issue
        .command("comment <number>")
        .description("Issue または Discussion にコメントを追加する")
        .option("--file <file>", "コメント本文のファイルパス")
        .action(async (number, localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdAddComment } = await import("./comment/index.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdAddComment(number, options, logger));
    });
    // ---------------------------------------------------------------------------
    // check
    // ---------------------------------------------------------------------------
    issue
        .command("check [number]")
        .description("ローカルキャッシュとリモートの差分を表示する（番号省略時は全キャッシュをチェック）")
        .option("--dir <dir>", "キャッシュディレクトリ（デフォルト: .shirokuma/github）")
        .action(async (number, localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdCheck } = await import("./check/index.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdCheck(number, options, logger));
    });
    // ---------------------------------------------------------------------------
    // close
    // ---------------------------------------------------------------------------
    issue
        .command("close <number>")
        .description("Issue をクローズ (オプションでコメント付き)")
        .option("-b, --body-file <file>", "クローズコメント本文ファイルパス、または - で stdin")
        .option("-s, --field-status <status>", "Projects Status フィールドを上書き (デフォルト: Done)")
        .option("--state-reason <reason>", "クローズ理由: COMPLETED, NOT_PLANNED (デフォルト: COMPLETED)", "COMPLETED")
        .option("--force", "子 Issue 未完了ガードをバイパス（親 Issue を子未完で強制 Close）")
        .action(async (number, localOpts, command) => {
        if (!resolveBodyFileOption(localOpts))
            return;
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdItemClose } = await import("./close/index.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdItemClose(number, options, logger));
    });
    // ---------------------------------------------------------------------------
    // cancel (alias: close --state-reason NOT_PLANNED)
    // ---------------------------------------------------------------------------
    issue
        .command("cancel <number>")
        .description("Issue をキャンセル (NOT_PLANNED でクローズ)")
        .option("-b, --body-file <file>", "クローズコメント本文ファイルパス、または - で stdin")
        .action(async (number, localOpts, command) => {
        if (!resolveBodyFileOption(localOpts))
            return;
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts, stateReason: "NOT_PLANNED" };
        const { cmdItemClose } = await import("./close/index.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdItemClose(number, options, logger));
    });
    // ---------------------------------------------------------------------------
    // reopen
    // ---------------------------------------------------------------------------
    issue
        .command("reopen <number>")
        .description("クローズ済み Issue を再オープン")
        .action(async (number, localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdItemReopen } = await import("./reopen/index.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdItemReopen(number, options, logger));
    });
    // ---------------------------------------------------------------------------
    // list
    // ---------------------------------------------------------------------------
    issue
        .command("list")
        .description("Issue 一覧を Projects フィールド付きで取得")
        .option("--all", "全 Issue を含める (open + closed)")
        .option("--state <state>", "Issue 状態: open, closed")
        .option("--status <status...>", "Projects Status でフィルタ")
        .option("-l, --labels <labels...>", "ラベルでフィルタ")
        .option("--limit <number>", "最大取得件数 (デフォルト: 20)", parseInt)
        .option("--format <format>", "出力形式: json, table-json", "table-json")
        .option("--issue-type <type>", "Issue Type でフィルタ")
        .action(async (localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        options.labels ??= options.label;
        const { cmdList } = await import("./list/index.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdList(options, logger));
    });
    // ---------------------------------------------------------------------------
    // comments
    // ---------------------------------------------------------------------------
    issue
        .command("comments <number>")
        .description("Issue の全コメントを一覧表示")
        .option("--format <format>", "出力形式: json, table-json", "json")
        .action(async (number, localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdComments } = await import("./comments/index.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdComments(number, options, logger));
    });
    // ---------------------------------------------------------------------------
    // remove
    // ---------------------------------------------------------------------------
    issue
        .command("remove <number>")
        .description("プロジェクトから Issue を削除")
        .action(async (number, localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdRemove } = await import("./remove/index.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdRemove(number, options, logger));
    });
    // ---------------------------------------------------------------------------
    // fields
    // ---------------------------------------------------------------------------
    issue
        .command("fields")
        .description("プロジェクトフィールド定義を表示")
        .action(async (localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdFields } = await import("./fields/index.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdFields(options, logger));
    });
    // ---------------------------------------------------------------------------
    // assign
    // ---------------------------------------------------------------------------
    issue
        .command("assign <number> <user>")
        .description("Issue に担当者を追加する (@me で認証ユーザー)")
        .action(async (number, user, localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdItemAssign } = await import("./assign/index.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdItemAssign(number, user, options, logger));
    });
    // ---------------------------------------------------------------------------
    // unassign
    // ---------------------------------------------------------------------------
    issue
        .command("unassign <number> <user>")
        .description("Issue から担当者を削除する (@me で認証ユーザー)")
        .action(async (number, user, localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdItemUnassign } = await import("./assign/index.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdItemUnassign(number, user, options, logger));
    });
    // ---------------------------------------------------------------------------
    // parent
    // ---------------------------------------------------------------------------
    issue
        .command("parent <number> <parent-number>")
        .description("Issue を親 Issue のサブ Issue に設定する")
        .option("--replace-parent", "既存の親 Issue を置き換える")
        .action(async (number, parentNumber, localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdItemParent } = await import("./parent/index.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdItemParent(number, parentNumber, options, logger));
    });
    // ---------------------------------------------------------------------------
    // unparent
    // ---------------------------------------------------------------------------
    issue
        .command("unparent <number>")
        .description("Issue の親 Issue 紐付けを解除する")
        .action(async (number, localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdItemUnparent } = await import("./parent/index.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdItemUnparent(number, options, logger));
    });
    // ---------------------------------------------------------------------------
    // sub-list
    // ---------------------------------------------------------------------------
    issue
        .command("sub-list <parent>")
        .description("親 Issue のサブ Issue を一覧表示")
        .action(async (parent, localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdSubList } = await import("./sub-list/index.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdSubList(parent, options, logger));
    });
    // ---------------------------------------------------------------------------
    // import
    // ---------------------------------------------------------------------------
    issue
        .command("import")
        .description("公開リポジトリから Issue をインポート")
        .option("--from-public <number>", "公開リポジトリの Issue 番号")
        .option("-s, --field-status <status>", "Projects Status フィールドを設定")
        .option("--priority <priority>", "Projects Priority フィールドを設定")
        .option("--size <size>", "Projects Size フィールドを設定")
        .option("--sync-public", "クローズ時に公開リポジトリへステータスを同期")
        .action(async (localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdImport } = await import("./import/index.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdImport(options, logger));
    });
    // ---------------------------------------------------------------------------
    // update
    // ---------------------------------------------------------------------------
    issue
        .command("update <number>")
        .description("Issue / Discussion の本文・メタデータを1コマンドで更新する（issue pull → 編集 → issue push の置き換え）")
        .option("-b, --body <file>", "本文をファイル内容で更新")
        .option("-t, --title <title>", "タイトルを更新")
        .option("--status <status>", "ステータスを更新（transition バリデーション通過後）")
        .option("--priority <priority>", "Priority を更新 (Critical/High/Medium/Low)")
        .option("--size <size>", "Size を更新 (XS/S/M/L/XL)")
        .option("--labels <labels>", "ラベルを設定（カンマ区切り、既存を上書き）")
        .option("--add-label <label>", "ラベルを追加（既存に追記）")
        .option("--remove-label <label>", "ラベルを削除")
        .option("--assign <user>", "担当者を追加 (@me で認証ユーザー)")
        .option("--unassign <user>", "担当者を削除")
        .option("--comment <id>", "更新するコメント ID (--body と組み合わせて使用)")
        .action(async (number, localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdItemUpdate } = await import("./update/index.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdItemUpdate(number, options, logger));
    });
    // ---------------------------------------------------------------------------
    // context
    // ---------------------------------------------------------------------------
    issue
        .command("context <number>")
        .description("Issue / PR を起点に関連情報を一括取得してキャッシュに書き込む")
        .option("--no-cache", "キャッシュを使わず強制的に API から取得")
        .action(async (number, localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdItemContext } = await import("./context/index.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdItemContext(number, options, logger));
    });
    // ---------------------------------------------------------------------------
    // branch
    // ---------------------------------------------------------------------------
    issue
        .command("branch <number>")
        .description("Issue 番号を起点にフィーチャーブランチを作成する（ブランチ名・ベースブランチを自動判定）")
        .option("--base <branch>", "ベースブランチ（省略時は自動判定）")
        .option("--prefix <prefix>", "ブランチプレフィックス（省略時は Issue Type から推定）")
        .option("--dry-run", "ブランチ名を表示するが作成しない")
        .action(async (number, localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdItemBranch } = await import("./branch/index.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdItemBranch(number, options, logger));
    });
    // ---------------------------------------------------------------------------
    // link
    // ---------------------------------------------------------------------------
    issue
        .command("link <number>")
        .description("Issue と Discussion のリンクを管理する（追加・一覧・解除）")
        .option("--discussion <number>", "リンク先の Discussion 番号")
        .option("--type <type>", "リンクの種別 (design|adr|research|knowledge|general)")
        .option("--list", "リンク一覧を表示")
        .option("--unlink <number>", "リンクを解除する Discussion 番号")
        .action(async (number, localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdItemLink } = await import("./link/index.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdItemLink(number, options, logger));
    });
    // ---------------------------------------------------------------------------
    // rollback
    // ---------------------------------------------------------------------------
    issue
        .command("rollback <number>")
        .description("Issue / PR の切り戻し操作（cancel: キャンセル, reset: Ready に戻す, revert: マージ取り消し）")
        .requiredOption("--action <action>", "アクション: cancel | reset | revert")
        .option("--dry-run", "実行内容を表示するが実行しない")
        .option("--force", "確認プロンプトをスキップ")
        .action(async (number, localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdItemRollback } = await import("./rollback/index.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdItemRollback(number, options, logger));
    });
    // ---------------------------------------------------------------------------
    // search
    // ---------------------------------------------------------------------------
    issue
        .command("search <query>")
        .description("Issue / PR / Discussion を横断検索 (--type で検索対象を指定)")
        .option("--type <types>", "検索対象: issues, discussions (カンマ区切り。デフォルト: issues)", "issues")
        .option("--category <category>", "Discussions カテゴリフィルタ (--type discussions 時)")
        .option("--state <state>", "状態でフィルタ: open, closed, all")
        .option("--limit <number>", "最大取得件数 (デフォルト: 10)", parseInt)
        .option("--format <format>", "出力形式: json, table-json", "table-json")
        .action(async (query, localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts, query };
        const { cmdSearch } = await import("./search/index.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdSearch(options, logger));
    });
    // ---------------------------------------------------------------------------
    // template サブコマンドグループ
    // ---------------------------------------------------------------------------
    issue.addCommand(createTemplateCommand());
    return issue;
}
//# sourceMappingURL=index.js.map