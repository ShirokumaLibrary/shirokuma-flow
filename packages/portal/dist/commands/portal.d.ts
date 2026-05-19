/**
 * portal コマンド - ドキュメントポータル HTML 生成
 *
 * Handlebars + クライアント JS ベースの静的 HTML ポータルを生成する。
 */
interface PortalOptions {
    project: string;
    config: string;
    output?: string;
    verbose?: boolean;
}
/**
 * portal コマンドハンドラ
 */
export declare function portalCommand(options: PortalOptions): Promise<number>;
export {};
//# sourceMappingURL=portal.d.ts.map