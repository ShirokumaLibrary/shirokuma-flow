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
import { join } from "node:path";
import { readdirSync, readFileSync } from "node:fs";
import { loadConfig } from "../utils/config.js";
import { compareSemver, getPluginCacheBaseRoot } from "../utils/skills-repo.js";
import { setExitCode } from "../utils/cli-helpers.js";
const VALID_ORCHESTRATORS = new Set(["designing", "coding", "reviewing"]);
// ========================================
// Constants
// ========================================
/**
 * Default skill routes (hardcoded fallback).
 * Framework-specific skills are auto-discovered from plugin cache (#1552).
 */
export const DEFAULT_ROUTES = {
    designing: [],
    coding: [],
    reviewing: [],
};
/**
 * Orchestrator prefix patterns for auto-discovery
 */
const ORCHESTRATOR_PREFIXES = {
    designing: "designing-",
    coding: "coding-",
    reviewing: "reviewing-",
};
/**
 * Skills that are orchestrators themselves, not routable targets
 */
const ORCHESTRATOR_SKILLS = new Set([
    "design-flow",
    "code-issue",
    "review-issue",
]);
// ========================================
// SKILL.md Frontmatter Parser
// ========================================
/**
 * Parse SKILL.md frontmatter to extract name and description
 */
export function parseSkillFrontmatter(content) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match)
        return {};
    const yaml = match[1];
    const name = yaml.match(/^name:\s*(.+)$/m)?.[1]?.trim();
    const description = yaml.match(/^description:\s*(.+)$/m)?.[1]?.trim();
    return { name, description };
}
// ========================================
// Key Generation
// ========================================
/**
 * Generate routing key from skill name by removing orchestrator prefix
 *
 * Example: "designing-graphql" -> "graphql", "coding-fastify" -> "fastify"
 */
export function generateKey(skillName, orchestrator) {
    const prefix = ORCHESTRATOR_PREFIXES[orchestrator];
    if (skillName.startsWith(prefix)) {
        return skillName.slice(prefix.length);
    }
    return skillName;
}
// ========================================
// Skill Source Scanning
// ========================================
/**
 * Safe directory read with file types - returns empty array on error
 */
function safeDirs(dirPath) {
    try {
        return readdirSync(dirPath, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name);
    }
    catch {
        return [];
    }
}
/**
 * Scan a skills directory for SKILL.md frontmatters
 */
function scanSkillsFromDir(skillsDir, result) {
    for (const skillDir of safeDirs(skillsDir)) {
        try {
            const content = readFileSync(join(skillsDir, skillDir, "SKILL.md"), "utf-8");
            const frontmatter = parseSkillFrontmatter(content);
            if (frontmatter.name) {
                result.set(frontmatter.name, {
                    name: frontmatter.name,
                    description: frontmatter.description ?? "",
                });
            }
        }
        catch {
            // Skip missing or unreadable files
        }
    }
}
/**
 * Scan plugin cache for all skills with SKILL.md
 */
export function scanPluginCacheSkills() {
    const result = new Map();
    const cacheBase = getPluginCacheBaseRoot();
    for (const marketplace of safeDirs(cacheBase)) {
        const marketplacePath = join(cacheBase, marketplace);
        for (const pluginName of safeDirs(marketplacePath)) {
            const pluginPath = join(marketplacePath, pluginName);
            // Get latest version (semver sort, descending)
            const versions = safeDirs(pluginPath)
                .sort((a, b) => compareSemver(b, a));
            if (versions.length === 0)
                continue;
            scanSkillsFromDir(join(pluginPath, versions[0], "skills"), result);
        }
    }
    return result;
}
/**
 * Scan project-local .claude/skills/ for skills
 */
export function scanLocalSkills(projectPath) {
    const result = new Map();
    scanSkillsFromDir(join(projectPath, ".claude", "skills"), result);
    return result;
}
// ========================================
// Routing Table Builder
// ========================================
/**
 * Build routing table for an orchestrator
 *
 * Priority: config add > default > discovered
 * Config exclude removes from all layers.
 */
export function buildRoutingTable(orchestrator, allSkills, configRouting) {
    const routes = [];
    const seenSkills = new Set();
    const excluded = [];
    const excludeSet = new Set(configRouting?.exclude ?? []);
    // Layer 1: config add (highest priority)
    if (configRouting?.add) {
        for (const [key, skillName] of Object.entries(configRouting.add)) {
            if (excludeSet.has(skillName)) {
                excluded.push(skillName);
                continue;
            }
            const info = allSkills.get(skillName);
            routes.push({
                key,
                skill: skillName,
                source: "config",
                description: info?.description ?? "",
            });
            seenSkills.add(skillName);
        }
    }
    // Layer 2: default routes
    const defaults = DEFAULT_ROUTES[orchestrator] ?? [];
    for (const skillName of defaults) {
        if (seenSkills.has(skillName))
            continue;
        if (excludeSet.has(skillName)) {
            excluded.push(skillName);
            continue;
        }
        const info = allSkills.get(skillName);
        routes.push({
            key: generateKey(skillName, orchestrator),
            skill: skillName,
            source: "default",
            description: info?.description ?? "",
        });
        seenSkills.add(skillName);
    }
    // Layer 3: auto-discovered (matching prefix, not orchestrators)
    const prefix = ORCHESTRATOR_PREFIXES[orchestrator];
    for (const [skillName, info] of allSkills) {
        if (seenSkills.has(skillName))
            continue;
        if (!skillName.startsWith(prefix))
            continue;
        if (ORCHESTRATOR_SKILLS.has(skillName))
            continue;
        if (excludeSet.has(skillName)) {
            excluded.push(skillName);
            continue;
        }
        routes.push({
            key: generateKey(skillName, orchestrator),
            skill: skillName,
            source: "discovered",
            description: info.description ?? "",
        });
        seenSkills.add(skillName);
    }
    return { orchestrator, routes, excluded };
}
// ========================================
// Command
// ========================================
export function createSkillsCommand() {
    const skills = new Command("skills")
        .description("スキル管理 (routing)");
    skills
        .command("routing [orchestrator]")
        .description("スキルルーティングテーブルを JSON 出力（orchestrator: designing | coding | reviewing）")
        .option("-p, --project <path>", "プロジェクトパス", process.cwd())
        .option("-c, --config <file>", "設定ファイル", "shirokuma-docs.config.yaml")
        .action((orchestrator, options) => {
        const config = loadConfig(options.project, options.config);
        // Scan all skill sources
        const allSkills = new Map();
        // Merge: plugin cache first, then local skills override
        for (const [k, v] of scanPluginCacheSkills()) {
            allSkills.set(k, v);
        }
        for (const [k, v] of scanLocalSkills(options.project)) {
            allSkills.set(k, v);
        }
        if (orchestrator && !VALID_ORCHESTRATORS.has(orchestrator)) {
            console.error(`Invalid orchestrator: ${orchestrator}. Must be: designing | coding | reviewing`);
            setExitCode(1);
            return;
        }
        const orchestrators = orchestrator
            ? [orchestrator]
            : ["designing", "coding", "reviewing"];
        if (orchestrators.length === 1) {
            const orch = orchestrators[0];
            const configRouting = config.skills?.routing?.[orch];
            const result = buildRoutingTable(orch, allSkills, configRouting);
            process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        }
        else {
            const results = orchestrators.map(orch => {
                const configRouting = config.skills?.routing?.[orch];
                return buildRoutingTable(orch, allSkills, configRouting);
            });
            process.stdout.write(JSON.stringify(results, null, 2) + "\n");
        }
    });
    return skills;
}
//# sourceMappingURL=skills.js.map