export declare const OBSERVATION_VERSION = "0.1";
/**
 * Placeholder for the `diffs[i].to` shape at plan stage, when the concrete
 * bytes are not yet known. Must stay stable: drift breaks plan_hash continuity
 * between plan-only and execute runs. Exported so tests can reference the same
 * literal the CLI emits.
 */
export declare const DIFF_TO_PLACEHOLDER = "computed-at-write-time";
export interface Intent {
    id: string;
    summary: string;
    risk: 'low' | 'medium' | 'high';
}
export interface Diff {
    target: string;
    from: unknown;
    to: unknown;
}
export interface PlanHashInput {
    intents: Intent[];
    diffs: Diff[];
    destructive_ops: readonly unknown[];
}
export interface PlanObservation extends PlanHashInput {
    version: typeof OBSERVATION_VERSION;
    stage: 'plan';
    tx_id: string;
    plan_hash: string;
}
export interface ExecuteObservation extends PlanHashInput {
    version: typeof OBSERVATION_VERSION;
    stage: 'execute';
    tx_id: string;
    plan_hash: string;
}
/**
 * SHA-256 over canonical JSON of `{intents, diffs, destructive_ops}` per SSoT
 * `docs/specs/observation-schema.md §2.1` (which `@shirokuma-library/flow`'s
 * `computePlanHash` also mirrors). Omitting `destructive_ops` would silently
 * diverge — codemap's build is idempotent (`destructive_ops: []`) today, but
 * keeping the field in scope preserves cross-tool verification compatibility
 * if a future subcommand adds a destructive op.
 */
export declare function computePlanHash(input: PlanHashInput): string;
export declare function buildPlanEnvelope(input: PlanHashInput): PlanObservation;
export declare function buildExecuteEnvelope(input: PlanHashInput & {
    tx_id: string;
    plan_hash: string;
}): ExecuteObservation;
//# sourceMappingURL=observation.d.ts.map