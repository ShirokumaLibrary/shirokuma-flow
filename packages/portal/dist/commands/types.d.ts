/**
 * generate コマンド共有型定義
 */
import type { OutputFormat } from "../utils/formatters.js";
/** generate サブコマンド共通オプション */
export interface GenerateCommonOptions {
    project?: string;
    config?: string;
    output?: string;
    verbose?: boolean;
    format?: OutputFormat;
}
//# sourceMappingURL=types.d.ts.map