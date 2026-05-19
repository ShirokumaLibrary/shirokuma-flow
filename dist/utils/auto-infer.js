/**
 * Auto Infer Utility
 *
 * Utilities for automatic annotation inference from TypeScript files.
 * Extracts route, components, and database tables from file content.
 *
 * @module utils/auto-infer
 */
/**
 * Infer annotations from a file path and content.
 *
 * @param filePath - Relative file path
 * @param content - File content
 * @returns Inferred annotations
 *
 * @example
 * ```typescript
 * const annotations = await inferAnnotations(
 *   "apps/web/app/[locale]/dashboard/page.tsx",
 *   fileContent
 * );
 * // { route: "/dashboard", usedComponents: ["Button"], dbTables: [] }
 * ```
 */
export function inferAnnotations(filePath, content) {
    return {
        route: inferRouteFromFilePath(filePath),
        usedComponents: inferComponentsFromImports(content),
        dbTables: inferDbTablesFromDrizzleCalls(content),
    };
}
/**
 * Infer URL route from a Next.js App Router file path.
 *
 * Removes [locale] segment and layout groups from the route.
 *
 * @param filePath - Relative file path (e.g., "apps/web/app/[locale]/dashboard/page.tsx")
 * @returns Inferred route (e.g., "/dashboard") or null if not a page file
 *
 * @example
 * ```typescript
 * inferRouteFromFilePath("apps/web/app/[locale]/dashboard/page.tsx")
 * // Returns: "/dashboard"
 * ```
 */
function inferRouteFromFilePath(filePath) {
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
    // Remove page.tsx filename
    const withoutFilename = routePart.replace(/\/?page\.(tsx|ts)$/, "");
    // Split into segments
    const segments = withoutFilename.split("/").filter((s) => s.length > 0);
    // Filter out:
    // - [locale] segment
    // - Layout groups (segments in parentheses)
    const filteredSegments = segments.filter((segment) => {
        // Exclude layout groups
        if (segment.startsWith("(")) {
            return false;
        }
        // Exclude [locale]
        if (segment === "[locale]") {
            return false;
        }
        return true;
    });
    // Build the route
    if (filteredSegments.length === 0) {
        return "/";
    }
    return "/" + filteredSegments.join("/");
}
/**
 * Infer component names from import statements.
 *
 * Only extracts imports from components directories.
 *
 * @param content - File content
 * @returns List of component names (PascalCase)
 *
 * @example
 * ```typescript
 * inferComponentsFromImports(`
 *   import { Button } from "@/components/ui";
 *   import ProjectList from "@/components/project-list";
 * `)
 * // Returns: ["Button", "ProjectList"]
 * ```
 */
export function inferComponentsFromImports(content) {
    const components = [];
    // Pattern for named imports from components directory
    // import { A, B } from "@/components/..."
    // import { A, B } from "components/..."
    const namedImportPattern = /import\s*\{([^}]+)\}\s*from\s*["'](?:@\/)?components\/[^"']+["']/g;
    let match;
    while ((match = namedImportPattern.exec(content)) !== null) {
        const imports = match[1];
        // Split by comma and extract names
        const names = imports.split(",").map((s) => s.trim());
        for (const name of names) {
            // Handle "A as B" syntax - take original name (A)
            const actualName = name.split(/\s+as\s+/)[0].trim();
            // Only include PascalCase names (components start with uppercase)
            if (actualName && /^[A-Z]/.test(actualName)) {
                components.push(actualName);
            }
        }
    }
    // Pattern for default imports from components directory
    // import A from "@/components/..."
    const defaultImportPattern = /import\s+([A-Z][a-zA-Z0-9]*)\s+from\s*["'](?:@\/)?components\/[^"']+["']/g;
    while ((match = defaultImportPattern.exec(content)) !== null) {
        const name = match[1];
        if (name && /^[A-Z]/.test(name)) {
            components.push(name);
        }
    }
    // Remove duplicates
    return [...new Set(components)];
}
/**
 * Infer database table names from Drizzle ORM calls.
 *
 * Detects patterns:
 * - db.query.tableName.findMany/findFirst
 * - db.select().from(tableName)
 * - db.insert(tableName)
 * - db.update(tableName)
 * - db.delete(tableName)
 *
 * @param content - File content
 * @returns List of table names
 *
 * @example
 * ```typescript
 * inferDbTablesFromDrizzleCalls(`
 *   const users = await db.query.users.findMany();
 *   await db.insert(projects).values({ name: "Test" });
 * `)
 * // Returns: ["users", "projects"]
 * ```
 */
export function inferDbTablesFromDrizzleCalls(content) {
    const tables = [];
    // Pattern: db.query.tableName.findMany/findFirst/etc
    const queryPattern = /db\.query\.(\w+)\./g;
    let match;
    while ((match = queryPattern.exec(content)) !== null) {
        tables.push(match[1]);
    }
    // Pattern: db.select().from(tableName) or db.select({...}).from(tableName)
    const selectFromPattern = /\.from\s*\(\s*(\w+)\s*\)/g;
    while ((match = selectFromPattern.exec(content)) !== null) {
        tables.push(match[1]);
    }
    // Pattern: db.insert(tableName)
    const insertPattern = /db\.insert\s*\(\s*(\w+)\s*\)/g;
    while ((match = insertPattern.exec(content)) !== null) {
        tables.push(match[1]);
    }
    // Pattern: db.update(tableName)
    const updatePattern = /db\.update\s*\(\s*(\w+)\s*\)/g;
    while ((match = updatePattern.exec(content)) !== null) {
        tables.push(match[1]);
    }
    // Pattern: db.delete(tableName)
    const deletePattern = /db\.delete\s*\(\s*(\w+)\s*\)/g;
    while ((match = deletePattern.exec(content)) !== null) {
        tables.push(match[1]);
    }
    // Remove duplicates
    return [...new Set(tables)];
}
//# sourceMappingURL=auto-infer.js.map