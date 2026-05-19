/**
 * サイドバーナビゲーションビルダー
 *
 * PortalData を元にサイドバーのナビゲーションリンクデータを生成する。
 */
import type { PortalData } from "./types.js";
/** サイドバーセクション */
export interface SidebarSection {
    /** セクション見出し */
    title: string;
    /** ナビゲーションリンク一覧 */
    links: SidebarLink[];
}
/** サイドバーリンク */
export interface SidebarLink {
    /** 表示ラベル */
    label: string;
    /** リンク先 URL */
    href: string;
    /** アイコン名（テンプレートで使用する文字列キー） */
    icon?: string;
    /** バッジ数値 */
    count?: number;
    /** 子リンク */
    children?: SidebarLink[];
}
/**
 * PortalData からサイドバーデータを構築する
 */
export declare function buildSidebarData(data: PortalData): SidebarSection[];
//# sourceMappingURL=sidebar-builder.d.ts.map