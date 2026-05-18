/**
 * repo コマンド共有型定義
 */

/** repo サブコマンド共通オプション */
// extends Record<string, unknown> は createActionLogger(options: Record<string, unknown>) との互換性に必要
export interface RepoCommonOptions extends Record<string, unknown> {
  verbose?: boolean;
}
