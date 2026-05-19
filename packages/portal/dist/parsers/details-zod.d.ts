/**
 * details-zod - Zodスキーマ解析
 *
 * ZodスキーマからパラメータをJSON形式で抽出する。
 */
import type { ZodParameter } from "../commands/details-types.js";
/**
 * Zodスキーマを解析してパラメータ情報を抽出
 *
 * @param schemaName スキーマ名 (例: "CreateEntitySchema")
 * @param fileContent ファイルの内容
 * @returns Zodスキーマ情報
 */
export declare function parseZodSchema(schemaName: string, fileContent: string): {
    name: string;
    parameters: ZodParameter[];
} | null;
/**
 * Zod型をJSON Schema型にマッピング
 */
export declare function mapZodTypeToJsonType(zodType: string): string;
//# sourceMappingURL=details-zod.d.ts.map