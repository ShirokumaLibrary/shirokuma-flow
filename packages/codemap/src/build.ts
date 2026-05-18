import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { extractAdrIndex, type AdrEntry } from './extractors/adr.js';
import { OBSERVATION_VERSION } from './observation.js';

export const CODEMAP_DIR = '.shirokuma/codemap';
export const MAIN_INDEX_PATH = `${CODEMAP_DIR}/overview.json`;
export const ADR_BODY_PATH = `${CODEMAP_DIR}/bodies/adr.json`;

/** Output files that `writeBuildResult` produces, in a stable order. */
export const OUTPUT_PATHS = [MAIN_INDEX_PATH, ADR_BODY_PATH] as const;

export interface BuildOptions {
  projectPath: string;
  /** Override adr directory (relative to projectPath), default: docs/adr */
  adrDir?: string;
}

export interface SectionRef {
  count: number;
  body_ref: string;
}

export interface MainIndex {
  version: typeof OBSERVATION_VERSION;
  generated_at: string;
  repo_root: string;
  sections: {
    adr: SectionRef;
  };
}

export interface BuildResult {
  main_index: MainIndex;
  bodies: {
    adr: AdrEntry[];
  };
}

export function buildCodemap(options: BuildOptions): BuildResult {
  const projectPath = resolve(options.projectPath);
  const adrDir = options.adrDir ?? 'docs/adr';
  const adrEntries = extractAdrIndex(join(projectPath, adrDir));

  const mainIndex: MainIndex = {
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
export function writeBuildResult(projectPath: string, result: BuildResult): void {
  const root = resolve(projectPath);
  const mainPath = join(root, MAIN_INDEX_PATH);
  const bodyPath = join(root, ADR_BODY_PATH);
  mkdirSync(dirname(mainPath), { recursive: true });
  mkdirSync(dirname(bodyPath), { recursive: true });
  writeFileSync(mainPath, JSON.stringify(result.main_index) + '\n', 'utf8');
  writeFileSync(bodyPath, JSON.stringify(result.bodies.adr) + '\n', 'utf8');
}
