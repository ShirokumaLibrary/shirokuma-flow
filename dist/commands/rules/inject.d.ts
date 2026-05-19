/**
 * rules inject command
 *
 * .shirokuma/rules/ 配下のルールをフロントマターで
 * フィルタリングして stdout に出力する。
 *
 * フォールバック: .shirokuma/rules/ が存在しない場合、
 * バンドルプラグインの rules/ から直接読み込む。
 */
/**
 * rules inject コマンドのオプション
 */
export interface RulesInjectOptions {
    /** 注入対象スコープ (例: main, commit-worker) */
    scope: string;
    /** カテゴリフィルタ */
    category?: string;
    /** 優先度フィルタ */
    priority?: string;
    /** 言語 (en|ja) — フォールバック時のバンドルプラグイン選択に使用 */
    lang?: string;
    /** 出力上限トークン数 */
    maxTokens?: number;
    /** プロジェクトパス */
    project: string;
}
/**
 * rules inject コマンド実装
 */
export declare function rulesInjectCommand(options: RulesInjectOptions): Promise<void>;
//# sourceMappingURL=inject.d.ts.map