/**
 * 詳細ページジェネレーター
 */
import type { PortalData } from "../types.js";
/** 詳細ページのアイテムタイプ */
export type DetailType = "screen" | "component" | "action" | "module" | "table";
/**
 * 詳細一覧ページ（type/module）の HTML を生成する
 */
export declare function generateDetailsModulePage(data: PortalData, type: DetailType, moduleName: string): string;
/**
 * 詳細アイテムページの HTML を生成する
 */
export declare function generateDetailsItemPage(data: PortalData, type: DetailType, moduleName: string, itemName: string): string;
export declare function getItemsByType(group: {
    screens: Array<{
        name: string;
        description?: string;
        path?: string;
    }>;
    components: Array<{
        name: string;
        description?: string;
        path?: string;
    }>;
    actions: Array<{
        name: string;
        description?: string;
        path?: string;
    }>;
    tables: Array<{
        name: string;
        description?: string;
    }>;
    modules: Array<{
        name: string;
        description?: string;
        path?: string;
    }>;
}, type: DetailType): Array<{
    name: string;
    description?: string;
    path?: string;
}>;
//# sourceMappingURL=details.d.ts.map