/**
 * サービスステータスチェック（Atlassian Statuspage API 共通）
 *
 * npm / GitHub のステータスページは同じ Atlassian Statuspage 形式。
 * `status.indicator` が `none` なら正常、それ以外はインシデント発生中。
 */
export interface ServiceStatus {
    ok: boolean;
    indicator: string;
    description: string;
    url: string;
}
declare const SERVICE_CONFIG: {
    readonly npm: {
        readonly api: "https://status.npmjs.org/api/v2/status.json";
        readonly page: "https://status.npmjs.org";
    };
    readonly github: {
        readonly api: "https://www.githubstatus.com/api/v2/status.json";
        readonly page: "https://www.githubstatus.com";
    };
};
export type ServiceName = keyof typeof SERVICE_CONFIG;
/**
 * Atlassian Statuspage API レスポンスからステータスを判定する
 */
export declare function parseStatuspageResponse(data: unknown): {
    indicator: string;
    description: string;
};
/**
 * インシデント報告メッセージをフォーマットする
 *
 * 行の配列を返す。呼び出し側が logger.error / console.error で出力する。
 */
export declare function formatIncidentReport(service: ServiceName, status: ServiceStatus): string[];
/**
 * サービスステータスを確認する
 */
export declare function checkServiceStatus(service: ServiceName, fetchFn?: typeof fetch): Promise<ServiceStatus>;
export {};
//# sourceMappingURL=service-status.d.ts.map