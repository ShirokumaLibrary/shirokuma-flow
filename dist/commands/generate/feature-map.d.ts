/**
 * feature-map コマンド - 機能階層マップ生成
 *
 * TypeScript ファイルからカスタム JSDoc タグを解析し、
 * 5層の階層的な機能マップを生成する
 *
 * 対象タグ:
 * - @screen ScreenName - 画面/ページ識別子
 * - @component ComponentName - コンポーネント識別子
 * - @serverAction - Server Action マーカー
 * - @module moduleName - lib/ モジュール識別子 (auth, security, content等)
 * - @dbTable tableName - データベーステーブル参照
 * - @feature FeatureName - 機能グループ
 * - @route /path - URL ルート
 * - @usedComponents Comp1, Comp2 - 使用コンポーネント
 * - @usedActions action1, action2 - 使用アクション
 * - @usedInScreen ScreenName - 親画面
 * - @usedInComponent CompName - 親コンポーネント
 * - @dbTables table1, table2 - 使用データベーステーブル
 */
import type { FeatureMapOptions } from "./feature-map-types.js";
/**
 * feature-map コマンドハンドラ
 */
export declare function featureMapCommand(options: FeatureMapOptions): number;
//# sourceMappingURL=feature-map.d.ts.map