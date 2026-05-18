/**
 * 外部ドキュメントソースの fetch 戦略メタ情報。
 * shirokuma-flow からの移植（ADR-0019 Phase 1b-1）。
 */
export interface StrategyMeta {
  /** fetch 元 URL（llms.txt または GitHub リポジトリ URL）。 */
  url: string;
  /** `detect` が package.json から逆引きするための npm パッケージ名一覧。 */
  packageNames?: readonly string[];
  /** GitHub プリセットのデフォルトブランチ。 */
  branch?: string;
  /** GitHub プリセットのドキュメントパス。配列指定で複数対応。 */
  repoPath?: string | readonly string[];
  /** fetch 後に各ファイルから除去する行パターン（正規表現文字列）。 */
  stripLinePattern?: string;
}

/**
 * llms.txt の各リンクを個別に取得するプリセット設定。
 */
export interface IndividualStrategyMeta extends StrategyMeta {
  fetchStrategy: 'individual';
  /** `md`: Markdown リンクをそのまま使用 / `clean`: `.md` を付与。 */
  linkFormat?: 'md' | 'clean';
  /** fetch 後に各ファイルの先頭から除去するパターン（正規表現文字列）。 */
  stripHeaderPattern?: string;
}

/**
 * llms-full.txt を分割パターンでファイル分割するプリセット設定。
 */
export interface FullSplitStrategyMeta extends StrategyMeta {
  fetchStrategy: 'full-split';
  /** llms-full.txt の URL。 */
  fullUrl: string;
  /** `md`: Markdown リンクをそのまま使用 / `clean`: `.md` を付与。 */
  linkFormat?: 'md' | 'clean';
  /** 分割パターン（正規表現文字列）。 */
  splitPattern: string;
  /** セクションフォーマッタ名。 */
  sectionFormatter?: 'metadata-to-frontmatter' | 'passthrough';
}

export type AnyPresetMeta = StrategyMeta | IndividualStrategyMeta | FullSplitStrategyMeta;
