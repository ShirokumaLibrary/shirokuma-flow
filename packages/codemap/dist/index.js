export const PACKAGE_NAME = '@shirokuma-library/codemap';
export { extractAdrIndex } from './extractors/adr.js';
export { writeBuildResult, CODEMAP_DIR, MAIN_INDEX_PATH, ADR_BODY_PATH, OUTPUT_PATHS, } from './build.js';
export { computePlanHash, buildPlanEnvelope, buildExecuteEnvelope, OBSERVATION_VERSION, DIFF_TO_PLACEHOLDER, } from './observation.js';
// パッケージ公開 API: extractCodemap / CodemapModel が canonical 名。
// 内部実装の `buildCodemap` (build.ts) は public 表面に出さない。将来差し替え点が
// 必要になった時点で extractCodemap を関数ラッパー化する（YAGNI）。
export { buildCodemap as extractCodemap } from './build.js';
//# sourceMappingURL=index.js.map