/**
 * projects update subcommand
 *
 * Project フィールド（Status/Priority/Size）を更新する。
 * `items projects update` として公開されており、Issue 番号（#N または N）または
 * Project アイテム ID（PVTI_xxx）を受け取る。
 *
 * Issue 番号経由でプロジェクトフィールドを更新できる唯一の手段。
 * `items list` / `items show` では読み取りのみであり更新はできない。
 *
 * @example
 *   shirokuma-docs items projects update 42 --field-status "In Progress" --size M
 *   shirokuma-docs items projects update PVTI_xxx --field-status "Done"
 */
import { Logger } from "../../utils/logger.js";
import { ProjectsOptions } from "./helpers.js";
/**
 * update subcommand
 */
export declare function cmdUpdate(itemIdOrNumber: string, options: ProjectsOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=update.d.ts.map