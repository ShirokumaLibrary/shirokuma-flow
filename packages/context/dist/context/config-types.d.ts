/**
 * 単一のドキュメントソース設定。`.shirokuma/config.yaml` の `contexts.sources[]`
 * 相当 — プリセットの meta と合成して fetch を駆動する。
 *
 * shirokuma-flow からの移植（ADR-0019 Phase 1b-2b）。config ファイルの parse
 * 自体はまだ移していないので、consumer が自前で読み込むか、将来の
 * `@shirokuma-library/docs` 側で loadConfig を提供する想定。
 */
export interface DocsSourceConfig {
    /** ソース識別名（`.shirokuma/contexts/{name}/` のディレクトリ名にも使う）。 */
    name: string;
    /**
     * llms.txt の URL または GitHub リポジトリ URL。
     * プリセット名だけ登録した場合、fetch 時にプリセット meta から自動補完されるため省略可能。
     */
    url?: string;
    /** 出力ディレクトリ（未指定なら `.shirokuma/contexts/{name}/`）。 */
    outputDir?: string;
    /**
     * リンク形式。
     * - `md`: `.md` 拡張子付き URL をそのまま使用
     * - `clean`: 拡張子なし URL に `.md` を付与して取得
     */
    linkFormat?: 'md' | 'clean';
    /** llms-full.txt の URL（`fetchStrategy: 'full-split'` 用）。 */
    fullUrl?: string;
    /**
     * fetch 戦略。
     * - `individual`: llms.txt のリンクから個別に取得（既定）
     * - `full-split`: llms-full.txt を分割して取得
     * - その他: preset 名での動的 dispatch（サイト固有戦略、Phase 1b-2c 以降）
     */
    fetchStrategy?: 'individual' | 'full-split' | (string & {});
    /** full-split 時の分割パターン（正規表現文字列）。 */
    splitPattern?: string;
    /** GitHub リポジトリ内のドキュメントディレクトリパス。複数指定可。 */
    repoPath?: string | readonly string[];
    /** 取得対象ブランチ（サイト固有戦略用、既定 `main`）。 */
    branch?: string;
}
/**
 * context コマンド設定（外部ライブラリ docs の保存先）。
 * `.shirokuma/config.yaml` の `contexts` フィールドに対応する。
 */
export interface ContextsConfig {
    /** デフォルト出力ディレクトリ（既定: `.shirokuma/contexts/`）。 */
    outputDir?: string;
}
/**
 * `fetchIndividual` / `fetchFullSplit` / 各 preset `execute` が受け取る共通オプション。
 * Phase 1b-2b では型のみ公開し、実装は Phase 1b-2c で戻す。
 */
export interface DocsFetchOptions {
    force?: boolean;
    dryRun?: boolean;
    /** false で画像ダウンロード / SVG 処理をスキップ。 */
    images?: boolean;
    verbose?: boolean;
}
//# sourceMappingURL=config-types.d.ts.map