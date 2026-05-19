import { type AdrEntry } from './extractors/adr.js';
import { OBSERVATION_VERSION } from './observation.js';
export declare const CODEMAP_DIR = ".shirokuma/codemap";
export declare const MAIN_INDEX_PATH = ".shirokuma/codemap/overview.json";
export declare const ADR_BODY_PATH = ".shirokuma/codemap/bodies/adr.json";
/** Output files that `writeBuildResult` produces, in a stable order. */
export declare const OUTPUT_PATHS: readonly [".shirokuma/codemap/overview.json", ".shirokuma/codemap/bodies/adr.json"];
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
export declare function buildCodemap(options: BuildOptions): BuildResult;
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
export declare function writeBuildResult(projectPath: string, result: BuildResult): void;
//# sourceMappingURL=build.d.ts.map