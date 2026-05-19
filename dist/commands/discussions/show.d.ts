import type { Logger } from "../../utils/logger.js";
import { type DiscussionsOptions } from "./helpers.js";
/**
 * `withComments: true` のとき（show コマンド経由）Discussion コメント全件を追加取得して出力に含める。
 * `writeCache: true` のとき（show コマンド経由）取得データをキャッシュに書き込む (#1768)。
 * `discussions show` 直接呼び出しでは `withComments` / `writeCache` が渡されないため既存動作を維持する。
 */
export declare function cmdGet(idOrNumber: string, options: DiscussionsOptions & {
    withComments?: boolean;
    writeCache?: boolean;
}, logger: Logger): Promise<number>;
export { cmdGet as cmdDiscussionShow };
//# sourceMappingURL=show.d.ts.map