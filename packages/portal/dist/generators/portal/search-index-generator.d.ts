/**
 * 検索インデックスジェネレーター
 *
 * portal/lib/search-index-generator.ts の Node.js 移植版。
 * 全データソースから検索可能なインデックスを生成する。
 */
import type { SearchIndex, FeatureMapData, DbSchemaData, TestCasesData, DetailsData } from "./types.js";
/**
 * 全利用可能データから検索インデックスを生成する
 */
export declare function generateSearchIndex(featureMap: FeatureMapData | null, dbSchema: DbSchemaData | null, testCases: TestCasesData | null, details: DetailsData | null): SearchIndex;
//# sourceMappingURL=search-index-generator.d.ts.map