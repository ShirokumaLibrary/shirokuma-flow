/**
 * サービスステータスチェック（Atlassian Statuspage API 共通）
 *
 * npm / GitHub のステータスページは同じ Atlassian Statuspage 形式。
 * `status.indicator` が `none` なら正常、それ以外はインシデント発生中。
 */
const SERVICE_CONFIG = {
    npm: {
        api: "https://status.npmjs.org/api/v2/status.json",
        page: "https://status.npmjs.org",
    },
    github: {
        api: "https://www.githubstatus.com/api/v2/status.json",
        page: "https://www.githubstatus.com",
    },
};
/**
 * Atlassian Statuspage API レスポンスからステータスを判定する
 */
export function parseStatuspageResponse(data) {
    const obj = data;
    return {
        indicator: obj?.status?.indicator || "unknown",
        description: obj?.status?.description || "不明",
    };
}
/** サービス名 → 表示ラベル */
const SERVICE_LABELS = {
    npm: "npm registry",
    github: "GitHub API",
};
/**
 * インシデント報告メッセージをフォーマットする
 *
 * 行の配列を返す。呼び出し側が logger.error / console.error で出力する。
 */
export function formatIncidentReport(service, status) {
    if (status.ok)
        return [];
    const label = SERVICE_LABELS[service];
    return [
        `${label} インシデント発生中: ${status.description}`,
        `  詳細: ${status.url}`,
        `  インシデント解消後にリトライしてください。`,
    ];
}
/**
 * サービスステータスを確認する
 */
export async function checkServiceStatus(service, fetchFn = fetch) {
    const config = SERVICE_CONFIG[service];
    try {
        const res = await fetchFn(config.api, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) {
            return { ok: true, indicator: "unknown", description: "ステータス API 応答なし", url: config.page };
        }
        const data = await res.json();
        const { indicator, description } = parseStatuspageResponse(data);
        return {
            ok: indicator === "none",
            indicator,
            description,
            url: config.page,
        };
    }
    catch {
        // ステータス API 自体の障害はリリースをブロックしない
        return { ok: true, indicator: "unknown", description: "ステータス API に接続できません", url: config.page };
    }
}
//# sourceMappingURL=service-status.js.map