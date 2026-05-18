/**
 * DB スキーマユーティリティ
 *
 * portal/lib/db-schema-utils.ts の Node.js 移植版。
 * カテゴリ設定・正規化・推論ロジック。
 */

/** カテゴリ設定（ラベルと CSS クラス）*/
export const categoryConfig: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  auth: {
    label: "認証",
    color: "text-blue-500",
    bgColor: "bg-blue-100",
  },
  content: {
    label: "コンテンツ",
    color: "text-green-500",
    bgColor: "bg-green-100",
  },
  organization: {
    label: "組織",
    color: "text-purple-500",
    bgColor: "bg-purple-100",
  },
  project: {
    label: "プロジェクト",
    color: "text-amber-500",
    bgColor: "bg-amber-100",
  },
  session: {
    label: "セッション",
    color: "text-cyan-500",
    bgColor: "bg-cyan-100",
  },
  entity: {
    label: "エンティティ",
    color: "text-rose-500",
    bgColor: "bg-rose-100",
  },
  activity: {
    label: "アクティビティ",
    color: "text-indigo-500",
    bgColor: "bg-indigo-100",
  },
  token: {
    label: "トークン",
    color: "text-orange-500",
    bgColor: "bg-orange-100",
  },
  context: {
    label: "コンテキスト",
    color: "text-teal-500",
    bgColor: "bg-teal-100",
  },
  other: {
    label: "その他",
    color: "text-gray-500",
    bgColor: "bg-gray-100",
  },
};

/**
 * カテゴリ名を正規化する
 */
export function normalizeCategory(category: string | undefined): string {
  if (!category) return "other";
  const lower = category.toLowerCase();

  if (lower === "authentication" || lower === "auth") return "auth";
  if (lower === "organizations" || lower === "organization") return "organization";
  if (lower === "projects" || lower === "project") return "project";
  if (
    lower === "sessions" ||
    lower === "session" ||
    lower === "work sessions"
  )
    return "session";
  if (lower === "entities" || lower === "entity") return "entity";
  if (lower === "activities" || lower === "activity") return "activity";
  if (lower === "tokens" || lower === "token" || lower === "mcp tokens")
    return "token";
  if (lower === "content" || lower === "contents") return "content";
  if (lower === "user context" || lower === "context") return "context";

  return lower in categoryConfig ? lower : "other";
}

/**
 * テーブル名からカテゴリを推論する
 */
export function inferCategory(tableName: string): string {
  const name = tableName.toLowerCase();

  // session の具体的なパターンを auth より先に判定
  if (name.includes("work_session") || name.includes("session_")) {
    return "session";
  }
  if (
    name.includes("user") ||
    name.includes("session") ||
    name.includes("account") ||
    name.includes("verification")
  ) {
    return "auth";
  }
  if (name.includes("organization") || name.includes("member")) {
    return "organization";
  }
  if (name.includes("project")) {
    return "project";
  }
  if (name.includes("entity") || name.includes("entities")) {
    return "entity";
  }
  if (name.includes("activity") || name.includes("activities")) {
    return "activity";
  }
  if (name.includes("token")) {
    return "token";
  }
  if (
    name.includes("post") ||
    name.includes("category") ||
    name.includes("tag") ||
    name.includes("comment")
  ) {
    return "content";
  }
  if (name.includes("context")) {
    return "context";
  }

  return "other";
}

/**
 * カテゴリ設定を取得する（フォールバック付き）
 */
export function getCategoryConfig(
  category: string
): { label: string; color: string; bgColor: string } {
  const normalized = normalizeCategory(category);
  return categoryConfig[normalized] || categoryConfig.other;
}
