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
export declare function inferAppFromPath(filePath: string): AppName;
//# sourceMappingURL=app-inference.d.ts.map