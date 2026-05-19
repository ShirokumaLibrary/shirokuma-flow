/**
 * Auto Infer Utility
 *
 * Utilities for automatic annotation inference from TypeScript files.
 * Extracts route, components, and database tables from file content.
 *
 * @module utils/auto-infer
 */
/**
 * Inferred annotations from a file
 */
export interface InferredAnnotations {
    /** Inferred URL route (null if not a page file) */
    route: string | null;
    /** List of used components (from imports) */
    usedComponents: string[];
    /** List of used database tables (from Drizzle calls) */
    dbTables: string[];
}
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
export declare function inferAnnotations(filePath: string, content: string): InferredAnnotations;
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
export declare function inferComponentsFromImports(content: string): string[];
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
export declare function inferDbTablesFromDrizzleCalls(content: string): string[];
//# sourceMappingURL=auto-infer.d.ts.map