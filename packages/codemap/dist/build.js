import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { extractAdrIndex } from './extractors/adr.js';
import { OBSERVATION_VERSION } from './observation.js';
export const CODEMAP_DIR = '.shirokuma/codemap';
export const MAIN_INDEX_PATH = `${CODEMAP_DIR}/overview.json`;
export const ADR_BODY_PATH = `${CODEMAP_DIR}/bodies/adr.json`;
/** Output files that `writeBuildResult` produces, in a stable order. */
export const OUTPUT_PATHS = [MAIN_INDEX_PATH, ADR_BODY_PATH];
export function buildCodemap(options) {
    const projectPath = resolve(options.projectPath);
    const adrDir = options.adrDir ?? 'docs/adr';
    const adrEntries = extractAdrIndex(join(projectPath, adrDir));
    const mainIndex = {
        version: OBSERVATION_VERSION,
        generated_at: new Date().toISOString(),
        repo_root: projectPath,
        sections: {
            adr: {
                count: adrEntries.length,
                body_ref: ADR_BODY_PATH,
            },
        },
    };
    return { main_index: mainIndex, bodies: { adr: adrEntries } };
}
/**
 * Persist a BuildResult to disk. Idempotent overwrite.
 *
 * Hand-rolled `mkdirSync + writeFileSync` mirrors the `ensureDir` + `writeFile`
 * helpers in `packages/lint/src/file.ts` by design: `@shirokuma-library/codemap`
 * keeps zero runtime deps on other workspace packages so downstream consumers
 * (shirokuma-flow, third-party repos) can install it without dragging in
 * `@shirokuma-library/flow` or `@shirokuma-library/lint`. See ADR-0028 §4
 * "Package placement" for the rationale:
 * [docs/adr/0028-ai-system-overview-extraction.md](../../../docs/adr/0028-ai-system-overview-extraction.md).
 */
export function writeBuildResult(projectPath, result) {
    const root = resolve(projectPath);
    const mainPath = join(root, MAIN_INDEX_PATH);
    const bodyPath = join(root, ADR_BODY_PATH);
    mkdirSync(dirname(mainPath), { recursive: true });
    mkdirSync(dirname(bodyPath), { recursive: true });
    writeFileSync(mainPath, JSON.stringify(result.main_index) + '\n', 'utf8');
    writeFileSync(bodyPath, JSON.stringify(result.bodies.adr) + '\n', 'utf8');
}
//# sourceMappingURL=build.js.map