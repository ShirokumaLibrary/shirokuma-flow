/**
 * feature-map 参照解析・マージ
 *
 * ts-morph による自動参照解析結果を FeatureMapItem にマージし、
 * 逆参照（Action→Table, Module→Module）を構築する。
 */
import { type ReferenceAnalysisResult } from "./reference-analyzer.js";
import type { FeatureMapItem } from "../commands/feature-map-types.js";
/**
 * 自動解析で推論した参照情報を allItems にマージする
 *
 * マージ戦略: アノテーション ∪ 自動検出（重複排除）
 *
 * @param allItems - 既存のアイテム配列（mutate）
 * @param referenceResult - ts-morph による参照解析結果
 * @param projectPath - プロジェクトルートパス
 */
export declare function mergeInferredReferences(allItems: FeatureMapItem[], referenceResult: ReferenceAnalysisResult, _projectPath: string): void;
/**
 * 2つの配列をマージ（重複排除）
 */
export declare function mergeArrays(existing: string[], inferred: string[]): string[];
/**
 * Action → Table の逆参照を構築
 * 各 Action の dbTables から Table の usedInActions を設定
 */
export declare function buildTableReverseReferences(allItems: FeatureMapItem[]): void;
/**
 * Module → Module の双方向参照を構築
 * 各モジュールが使用するモジュール (usedModules) と
 * 各モジュールを使用するモジュール (usedInModules) を設定
 */
export declare function buildModuleReferences(allItems: FeatureMapItem[], referenceResult: ReferenceAnalysisResult, _projectPath: string): void;
//# sourceMappingURL=feature-map-references.d.ts.map