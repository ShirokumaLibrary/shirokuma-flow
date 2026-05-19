/**
 * skills command - Commander.js nested subcommand factory
 *
 * Creates the top-level `skills` Command with `routing` subcommand.
 *
 * Usage in index.ts:
 *   import { createSkillsCommand } from "./commands/skills.js";
 *   program.addCommand(createSkillsCommand());
 */
import { Command } from "commander";
export type OrchestratorType = "designing" | "coding" | "reviewing";
export type RouteSource = "default" | "discovered" | "config";
export interface RouteEntry {
    key: string;
    skill: string;
    source: RouteSource;
    description: string;
}
export interface RoutingResult {
    orchestrator: OrchestratorType;
    routes: RouteEntry[];
    excluded: string[];
}
/**
 * Default skill routes (hardcoded fallback).
 * Framework-specific skills are auto-discovered from plugin cache (#1552).
 */
export declare const DEFAULT_ROUTES: Record<OrchestratorType, string[]>;
/**
 * Parse SKILL.md frontmatter to extract name and description
 */
export declare function parseSkillFrontmatter(content: string): {
    name?: string;
    description?: string;
};
/**
 * Generate routing key from skill name by removing orchestrator prefix
 *
 * Example: "designing-graphql" -> "graphql", "coding-fastify" -> "fastify"
 */
export declare function generateKey(skillName: string, orchestrator: OrchestratorType): string;
/**
 * Scan plugin cache for all skills with SKILL.md
 */
export declare function scanPluginCacheSkills(): Map<string, {
    name: string;
    description: string;
}>;
/**
 * Scan project-local .claude/skills/ for skills
 */
export declare function scanLocalSkills(projectPath: string): Map<string, {
    name: string;
    description: string;
}>;
/**
 * Build routing table for an orchestrator
 *
 * Priority: config add > default > discovered
 * Config exclude removes from all layers.
 */
export declare function buildRoutingTable(orchestrator: OrchestratorType, allSkills: Map<string, {
    name: string;
    description: string;
}>, configRouting?: {
    add?: Record<string, string>;
    exclude?: string[];
}): RoutingResult;
export declare function createSkillsCommand(): Command;
//# sourceMappingURL=skills.d.ts.map