/**
 * typescript-5 プリセット。サイト固有の微調整が必要になればここに追記する。
 *
 * microsoft/TypeScript-Website モノレポ（default branch `v2`）の 3 パッケージ
 * (documentation / tsconfig-reference / glossary) から英語 Markdown を統合取得し、
 * 出力先をパッケージごとに分離する（`fetchGithubTree` の flatten 挙動と合わないため
 * 直接 github primitives を使う）。
 */
import type { FetchStats } from '../stats.js';
import type { PresetExecuteParams } from './types.js';
export declare function execute(params: PresetExecuteParams): Promise<FetchStats>;
//# sourceMappingURL=typescript-5.d.ts.map