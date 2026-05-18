/**
 * App name inference from file paths
 *
 * Automatically detects app name from directory structure:
 * - apps/{name}/ → {Name} (PascalCase, e.g., "Admin", "Web", "Mcp")
 * - packages/ → "Shared"
 * - other → "Unknown"
 */

/**
 * Well-known app names (for type hints, not exhaustive)
 */
export type WellKnownAppName = "Admin" | "Public" | "Web" | "Mcp" | "Shared" | "Unknown";

/**
 * App name can be any string (dynamically detected from apps/ directory)
 */
export type AppName = string;

/**
 * Convert to PascalCase (first letter uppercase)
 */
function toPascalCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Infer app name from file path
 *
 * @param filePath - Relative or absolute file path
 * @returns Inferred app name (PascalCase for apps/, "Shared" for packages/)
 *
 * @example
 * ```ts
 * inferAppFromPath("apps/admin/lib/actions/posts.ts") // => "Admin"
 * inferAppFromPath("apps/mcp/src/tools/entities.ts") // => "Mcp"
 * inferAppFromPath("packages/database/src/schema.ts") // => "Shared"
 * ```
 */
export function inferAppFromPath(filePath: string): AppName {
  const normalizedPath = filePath.replace(/\\/g, "/").toLowerCase();

  // Match apps/{name}/ pattern
  const appsMatch = normalizedPath.match(/(?:^|\/|\\)apps\/([^/\\]+)\//);
  if (appsMatch && appsMatch[1]) {
    return toPascalCase(appsMatch[1]);
  }

  // Check for packages/ (shared code)
  if (normalizedPath.includes("/packages/") || normalizedPath.startsWith("packages/")) {
    return "Shared";
  }

  return "Unknown";
}
