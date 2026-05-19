/**
 * items import サブコマンド (#1814)
 *
 * issues import から移行。公開リポジトリから Issue をインポートする。
 *
 * ワークフロー:
 * 1. 現在のリポジトリペアを解決（private ← public）
 * 2. 公開リポジトリから Issue を取得
 * 3. プライベートリポジトリに Issue を作成（クロス参照付き）
 * 4. 公開 Issue にトラッキングコメントを追加
 */
import type { Logger } from "../../../utils/logger.js";
import type { ImportOptions } from "../types.js";
/**
 * items import サブコマンド - 公開リポジトリから Issue をインポートする。
 */
export declare function cmdImport(options: ImportOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=index.d.ts.map