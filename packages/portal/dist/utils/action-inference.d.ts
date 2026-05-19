/**
 * Action type inference from file paths
 *
 * Infers whether a Server Action is CRUD or Domain based on its directory location:
 * - lib/actions/crud/*.ts → CRUD (single table, standard CRUD operations)
 * - lib/actions/domain/*.ts → Domain (multi-table, business workflows)
 */
export type ActionType = "CRUD" | "Domain";
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
export declare function inferActionTypeFromPath(filePath: string): ActionType | undefined;
//# sourceMappingURL=action-inference.d.ts.map