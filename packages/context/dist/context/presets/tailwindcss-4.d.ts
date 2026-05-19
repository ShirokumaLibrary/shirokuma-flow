/**
 * tailwindcss-4 プリセット。サイト固有の微調整が必要になればここに追記する。
 *
 * tailwindlabs/tailwindcss.com の `src/docs/` 配下 `.md` / `.mdx` を取得し、
 * ダウンロード後に `.mdx` を `transformMdxToMd` で Markdown 化して `.md` に
 * 置き換える（原 `.mdx` は削除）。MDX 変換は `tailwindcss-mdx-transform.ts` に
 * 閉じ込めた JSX→Markdown 静的変換。
 */
import type { FetchStats } from '../stats.js';
import type { PresetExecuteParams } from './types.js';
export declare function execute(params: PresetExecuteParams): Promise<FetchStats>;
//# sourceMappingURL=tailwindcss-4.d.ts.map