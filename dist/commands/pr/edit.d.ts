/**
 * PR edit サブコマンド - PR のメタデータを更新する (#2119)
 *
 * --base でベースブランチ、--title でタイトル、--body-file で本文を変更できる。
 * 少なくとも1つのオプションが必要。
 */
import { Logger } from "../../utils/logger.js";
import type { IssuesPrOptions } from "./types.js";
export declare function cmdPrEdit(prNumberStr: string, options: IssuesPrOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=edit.d.ts.map