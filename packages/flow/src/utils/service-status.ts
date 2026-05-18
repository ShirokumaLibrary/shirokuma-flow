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

const SERVICE_CONFIG = {
  npm: {
    api: "https://status.npmjs.org/api/v2/status.json",
    page: "https://status.npmjs.org",
  },
  github: {
    api: "https://www.githubstatus.com/api/v2/status.json",
    page: "https://www.githubstatus.com",
  },
} as const;

export type ServiceName = keyof typeof SERVICE_CONFIG;

/**
 * Atlassian Statuspage API レスポンスからステータスを判定する
 */
export function parseStatuspageResponse(data: unknown): {
  indicator: string;
  description: string;
} {
  const obj = data as { status?: { indicator?: string; description?: string } };
  return {
    indicator: obj?.status?.indicator || "unknown",
    description: obj?.status?.description || "不明",
  };
}

/** サービス名 → 表示ラベル */
const SERVICE_LABELS: Record<ServiceName, string> = {
  npm: "npm registry",
  github: "GitHub API",
};

/**
 * インシデント報告メッセージをフォーマットする
 *
 * 行の配列を返す。呼び出し側が logger.error / console.error で出力する。
 */
export function formatIncidentReport(
  service: ServiceName,
  status: ServiceStatus,
): string[] {
  if (status.ok) return [];
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
export async function checkServiceStatus(
  service: ServiceName,
  fetchFn: typeof fetch = fetch,
): Promise<ServiceStatus> {
  const config = SERVICE_CONFIG[service];

  try {
    const res = await fetchFn(config.api, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      return { ok: true, indicator: "unknown", description: "ステータス API 応答なし", url: config.page };
    }
    const data: unknown = await res.json();
    const { indicator, description } = parseStatuspageResponse(data);
    return {
      ok: indicator === "none",
      indicator,
      description,
      url: config.page,
    };
  } catch {
    // ステータス API 自体の障害はリリースをブロックしない
    return { ok: true, indicator: "unknown", description: "ステータス API に接続できません", url: config.page };
  }
}
