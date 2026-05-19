/**
 * plugin-install-local command - ローカルプラグインをグローバルキャッシュにインストール
 *
 * @description plugin/{pluginName}/ ディレクトリをグローバルキャッシュ
 * (~/.claude/plugins/cache/shirokuma-library/{pluginName}/local/) にコピーし、
 * ルールを .shirokuma/rules/shirokuma/ に展開する。
 *
 * 開発中のプラグイン変更を `shirokuma-docs update` を実行せずに
 * 即座に反映させるためのコマンド。
 *
 * @example
 * ```bash
 * # 言語設定に基づき自動選択（最も一般的な使い方）
 * shirokuma-docs plugin-install-local
 *
 * # 特定のプラグインを指定
 * shirokuma-docs plugin-install-local --plugin shirokuma-skills-ja
 *
 * # 全プラグインをインストール
 * shirokuma-docs plugin-install-local --all
 *
 * # ドライラン（変更なし）
 * shirokuma-docs plugin-install-local --dry-run
 * ```
 */
/**
 * plugin-install-local command options
 */
interface PluginInstallLocalOptions {
    /** Project path */
    project: string;
    /** Plugin name to install (auto-detected from language setting if not specified) */
    plugin?: string;
    /** Install all plugins */
    all?: boolean;
    /** Preview mode (no actual changes) */
    dryRun?: boolean;
    /** Verbose logging */
    verbose?: boolean;
}
/**
 * plugin-install-local command handler
 *
 * @param options - Command options
 * @returns Exit code (0 = success, 1 = error)
 */
export declare function pluginInstallLocalCommand(options: PluginInstallLocalOptions): number;
export {};
//# sourceMappingURL=plugin-install-local.d.ts.map