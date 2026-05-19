/**
 * PR show subcommand - Show PR details
 *
 * Fetches and displays detailed information for a given PR number.
 */
import { Logger } from "../../utils/logger.js";
import type { IssuesPrOptions } from "./types.js";
/**
 * `withComments: true` のとき（show コマンド経由）PR コメント・レビュースレッドを追加取得して出力に含める。
 * `pr show` 直接呼び出しでは `withComments` が渡されないため既存動作を維持する。
 */
export declare function cmdPrShow(prNumberStr: string, options: IssuesPrOptions & {
    withComments?: boolean;
}, logger: Logger): Promise<number>;
//# sourceMappingURL=show.d.ts.map