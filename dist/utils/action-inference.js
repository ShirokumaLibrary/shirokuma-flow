/**
 * Action type inference from file paths
 *
 * Infers whether a Server Action is CRUD or Domain based on its directory location:
 * - lib/actions/crud/*.ts → CRUD (single table, standard CRUD operations)
 * - lib/actions/domain/*.ts → Domain (multi-table, business workflows)
 */
/**
 * Infer action type from file path
 *
 * @param filePath - Relative or absolute file path
 * @returns Inferred action type, or undefined if not in recognized directory
 *
 * @example
 * ```ts
 * inferActionTypeFromPath("lib/actions/crud/projects.ts") // => "CRUD"
 * inferActionTypeFromPath("lib/actions/domain/dashboard.ts") // => "Domain"
 * inferActionTypeFromPath("lib/actions/auth.ts") // => undefined (legacy)
 * ```
 */
export function inferActionTypeFromPath(filePath) {
    const normalizedPath = filePath.replace(/\\/g, "/").toLowerCase();
    // Check for crud/ directory
    if (normalizedPath.includes("/lib/actions/crud/") ||
        normalizedPath.includes("/actions/crud/")) {
        return "CRUD";
    }
    // Check for domain/ directory
    if (normalizedPath.includes("/lib/actions/domain/") ||
        normalizedPath.includes("/actions/domain/")) {
        return "Domain";
    }
    // Actions not in crud/ or domain/ are legacy (no type inferred)
    return undefined;
}
//# sourceMappingURL=action-inference.js.map