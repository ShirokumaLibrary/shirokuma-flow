/**
 * search command - Issues + Discussions 横断検索
 *
 * GraphQL エイリアスで search(type: ISSUE) と search(type: DISCUSSION) を
 * 1 リクエストに束ね、LLM のコンテキスト効率を最大化する。
 *
 * @see Issue #553
 */
import { OutputFormat } from "../utils/formatters.js";
/** コマンドオプション */
interface SearchOptions {
    type?: string;
    category?: string;
    state?: string;
    limit?: number;
    format?: OutputFormat;
    public?: boolean;
    repo?: string;
    verbose?: boolean;
    query?: string;
}
export declare function searchCommand(query: string | undefined, options: SearchOptions): Promise<number>;
export {};
//# sourceMappingURL=search.d.ts.map