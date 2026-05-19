/**
 * projects create-project subcommand
 *
 * @deprecated コマンドとして無効化済み（2026-03-03, Issue #1202）。
 * GitHub の createProjectV2 API ではワークフロー（Item closed→Done 等）が
 * デフォルト無効で作成され、有効化する API も存在しないため、
 * Web UI 手動作成 + `projects setup` フローへ移行した。
 * API が整備された際（updateProjectV2Workflow 等が公開された場合）に
 * 再有効化する想定でコードを保持する。
 * See: Knowledge Discussion #1199, Issue #1167, Issue #1202
 *
 * 1. gh project create で Project を作成
 * 2. gh project link でリポジトリにリンク
 * 3. Discussions を自動有効化
 * 4. cmdSetup() でフィールド初期設定
 */
import { Logger } from "../../utils/logger.js";
import { type SetupOptions } from "./setup.js";
/** create-project サブコマンドのオプション */
type CreateProjectOptions = SetupOptions;
/**
 * create-project subcommand - Project 作成からフィールド設定まで一括実行
 */
export declare function cmdCreateProject(options: CreateProjectOptions, logger: Logger): Promise<number>;
export {};
//# sourceMappingURL=create-project.d.ts.map