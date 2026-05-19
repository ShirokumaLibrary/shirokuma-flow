/**
 * items parent/unparent - Sub-Issue 親子関係管理ロジック (#1810)
 *
 * issues sub-add/sub-remove ロジックを items サブコマンドとして提供する。
 */
import type { Logger } from "../../../utils/logger.js";
import type { ItemsOptions } from "../../items/types.js";
/** items parent サブコマンドのオプション */
export interface ParentOptions extends ItemsOptions {
    /** 既存の親 Issue を置き換える */
    replaceParent?: boolean;
}
/**
 * items parent <number> <parent-number> - Issue を親 Issue のサブ Issue に設定する。
 */
export declare function cmdItemParent(issueNumberStr: string, parentNumberStr: string, options: ParentOptions, logger: Logger): Promise<number>;
/**
 * items unparent <number> - Issue の親 Issue の紐付けを解除する。
 */
export declare function cmdItemUnparent(issueNumberStr: string, options: ItemsOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=index.d.ts.map