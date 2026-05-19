/**
 * Route Inference Utility
 *
 * Utilities for inferring URL routes from Next.js App Router file paths
 * and applying route parameter substitution.
 *
 * @module utils/route-inference
 */
/**
 * Infer URL route from Next.js App Router file path.
 *
 * Extracts the route from a page.tsx file path by:
 * 1. Finding the 'app' directory
 * 2. Removing layout groups (parenthesized segments)
 * 3. Removing the page.tsx filename
 *
 * @param filePath - Relative file path (e.g., "apps/web/app/[locale]/(dashboard)/page.tsx")
 * @returns Inferred route (e.g., "/[locale]") or null if not a page file
 *
 * @example
 * ```typescript
 * inferRouteFromPath("apps/web/app/[locale]/(dashboard)/[orgSlug]/page.tsx")
 * // Returns: "/[locale]/[orgSlug]"
 * ```
 */
export declare function inferRouteFromPath(filePath: string): string | null;
/**
 * Apply route parameter substitution.
 *
 * Replaces dynamic route segments like [locale] with actual values
 * from the routeParams configuration.
 *
 * @param route - Route with dynamic segments (e.g., "/[locale]/[orgSlug]")
 * @param routeParams - Parameter mapping (e.g., { "[locale]": "ja", "[orgSlug]": "demo-org" })
 * @returns Route with substituted values (e.g., "/ja/demo-org")
 *
 * @example
 * ```typescript
 * applyRouteParams("/[locale]/[orgSlug]", { "[locale]": "ja", "[orgSlug]": "test" })
 * // Returns: "/ja/test"
 * ```
 */
export declare function applyRouteParams(route: string, routeParams: Record<string, string>): string;
/**
 * Infer screen name from file path.
 *
 * Generates a screen name from the file path by:
 * 1. Extracting the last meaningful segment before page.tsx
 * 2. Converting to PascalCase
 * 3. Appending "Screen" suffix
 *
 * @param filePath - File path to generate screen name from
 * @returns Inferred screen name (e.g., "DashboardScreen")
 *
 * @example
 * ```typescript
 * inferScreenNameFromPath("apps/web/app/[locale]/dashboard/page.tsx")
 * // Returns: "DashboardScreen"
 * ```
 */
export declare function inferScreenNameFromPath(filePath: string): string;
//# sourceMappingURL=route-inference.d.ts.map