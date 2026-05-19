export declare const PACKAGE_NAME = "@shirokuma-library/codemap";
export type { AdrEntry } from './extractors/adr.js';
export { extractAdrIndex } from './extractors/adr.js';
export type { BuildResult, BuildOptions, MainIndex, SectionRef } from './build.js';
export { writeBuildResult, CODEMAP_DIR, MAIN_INDEX_PATH, ADR_BODY_PATH, OUTPUT_PATHS, } from './build.js';
export type { PlanObservation, ExecuteObservation } from './observation.js';
export { computePlanHash, buildPlanEnvelope, buildExecuteEnvelope, OBSERVATION_VERSION, DIFF_TO_PLACEHOLDER, } from './observation.js';
export { buildCodemap as extractCodemap } from './build.js';
export type { BuildResult as CodemapModel } from './build.js';
//# sourceMappingURL=index.d.ts.map