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
export function inferRouteFromPath(filePath) {
    // Only process page.tsx files
    if (!filePath.endsWith("page.tsx") && !filePath.endsWith("page.ts")) {
        return null;
    }
    // Find the 'app' directory in the path
    const appIndex = filePath.indexOf("/app/");
    if (appIndex === -1) {
        return null;
    }
    // Extract the route part (after 'app/')
    const routePart = filePath.substring(appIndex + 5); // +5 for '/app/'
    // Remove page.tsx filename (handles both /page.tsx and page.tsx at root)
    const withoutFilename = routePart.replace(/\/?page\.(tsx|ts)$/, "");
    // Split into segments
    const segments = withoutFilename.split("/").filter((s) => s.length > 0);
    // Filter out layout groups (segments in parentheses)
    const filteredSegments = segments.filter((segment) => !segment.startsWith("("));
    // Build the route
    if (filteredSegments.length === 0) {
        return "/";
    }
    return "/" + filteredSegments.join("/");
}
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
export function applyRouteParams(route, routeParams) {
    let result = route;
    for (const [param, value] of Object.entries(routeParams)) {
        result = result.replaceAll(param, value);
    }
    return result;
}
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
export function inferScreenNameFromPath(filePath) {
    // Extract route first
    const route = inferRouteFromPath(filePath);
    if (!route || route === "/") {
        return "HomeScreen";
    }
    // Get the last segment
    const segments = route.split("/").filter((s) => s.length > 0);
    const lastSegment = segments[segments.length - 1];
    // Remove brackets from dynamic segments
    const cleanSegment = lastSegment.replace(/^\[|\]$/g, "");
    // Convert to PascalCase
    const pascalCase = cleanSegment
        .split(/[-_]/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("");
    return pascalCase + "Screen";
}
//# sourceMappingURL=route-inference.js.map