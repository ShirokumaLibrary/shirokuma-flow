/**
 * Code Rules Registry
 *
 * Exports all code validation rules for lint-code command.
 *
 * @module lint/rules/code-rules
 */

// Export individual rules
export { serverActionStructureRule } from "./server-action-structure.js";
export { annotationRequiredRule } from "./annotation-required.js";

// Export types
export type { ServerActionStructureRule } from "./server-action-structure.js";
export type { AnnotationRequiredRule } from "./annotation-required.js";
