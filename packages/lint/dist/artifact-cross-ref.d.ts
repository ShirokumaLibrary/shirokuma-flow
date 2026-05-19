import type { DocValidationResult } from './docs-types.js';
export declare const ARTIFACT_CROSS_REF_RULES: {
    readonly crossRef: "artifact-cross-ref";
};
export declare const DEFAULT_FORBIDDEN_PATH_PATTERNS: readonly string[];
export interface ArtifactCrossRefOptions {
    indexTypeRules?: readonly string[];
    forbiddenPathPatterns?: readonly string[];
}
export declare function checkArtifactCrossRef(content: string, relFilePath: string, options?: ArtifactCrossRefOptions): DocValidationResult;
//# sourceMappingURL=artifact-cross-ref.d.ts.map