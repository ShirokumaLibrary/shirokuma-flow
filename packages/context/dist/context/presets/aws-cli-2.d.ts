/**
 * aws-cli-2 プリセット。サイト固有の微調整が必要になればここに追記する。
 *
 * docs.aws.amazon.com/cli/latest/userguide/llms.txt のセクション構造を自力パースし、
 * 各 HTML ページを fetch → `turndown` で Markdown 変換してセクション別サブディレクトリに
 * 保存する。AWS docs は llms.txt がリンク先を `.html` で提供するため、他 preset の
 * linkFormat/fetchIndividual の枠組みに乗らない。
 */
import TurndownService from 'turndown';
import type { FetchStats } from '../stats.js';
import type { PresetExecuteParams } from './types.js';
interface SectionEntry {
    dir: string;
    pages: Array<{
        title: string;
        url: string;
    }>;
}
export declare function execute(params: PresetExecuteParams): Promise<FetchStats>;
/**
 * llms.txt の AWS CLI 方言をパースする。
 *   `## [section](url)` または `## section` でセクション開始
 *   `- [title](*.html)` でページエントリ
 */
export declare function parseLlmsTxtSections(content: string): SectionEntry[];
/**
 * AWS docs HTML から main コンテンツ領域を抽出し、ボイラープレートを剥がして Markdown 化する。
 */
export declare function htmlToMarkdown(html: string, td: TurndownService): string;
export {};
//# sourceMappingURL=aws-cli-2.d.ts.map