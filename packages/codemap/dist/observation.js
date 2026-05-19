import { createHash } from 'node:crypto';
import { ulid } from 'ulid';
export const OBSERVATION_VERSION = '0.1';
/**
 * Placeholder for the `diffs[i].to` shape at plan stage, when the concrete
 * bytes are not yet known. Must stay stable: drift breaks plan_hash continuity
 * between plan-only and execute runs. Exported so tests can reference the same
 * literal the CLI emits.
 */
export const DIFF_TO_PLACEHOLDER = 'computed-at-write-time';
/**
 * Canonicalize input into a deterministic string for hashing.
 * - Objects: keys sorted (recursive).
 * - Arrays: elements canonicalized then sorted lexicographically, matching the
 *   repo-level SSoT `docs/specs/observation-schema.md §2.1` set-semantics
 *   (array order must NOT affect plan_hash — otherwise cross-tool verification
 *   with other repo CLIs silently mismatches).
 * - Throws on NaN / Infinity (`JSON.stringify` would emit `null` silently).
 */
function canonicalize(value) {
    if (typeof value === 'number' && !Number.isFinite(value)) {
        throw new Error(`canonicalize: non-finite number (${String(value)}) is not hashable`);
    }
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value)) {
        const items = value.map(canonicalize);
        items.sort();
        return `[${items.join(',')}]`;
    }
    const obj = value;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(',')}}`;
}
/**
 * SHA-256 over canonical JSON of `{intents, diffs, destructive_ops}` per SSoT
 * `docs/specs/observation-schema.md §2.1` (which `@shirokuma-library/flow`'s
 * `computePlanHash` also mirrors). Omitting `destructive_ops` would silently
 * diverge — codemap's build is idempotent (`destructive_ops: []`) today, but
 * keeping the field in scope preserves cross-tool verification compatibility
 * if a future subcommand adds a destructive op.
 */
export function computePlanHash(input) {
    const body = canonicalize({
        intents: input.intents,
        diffs: input.diffs,
        destructive_ops: input.destructive_ops,
    });
    const digest = createHash('sha256').update(body).digest('hex');
    return `sha256:${digest}`;
}
export function buildPlanEnvelope(input) {
    return {
        version: OBSERVATION_VERSION,
        stage: 'plan',
        tx_id: ulid(),
        plan_hash: computePlanHash(input),
        intents: input.intents,
        diffs: input.diffs,
        destructive_ops: input.destructive_ops,
    };
}
export function buildExecuteEnvelope(input) {
    return {
        version: OBSERVATION_VERSION,
        stage: 'execute',
        tx_id: input.tx_id,
        plan_hash: input.plan_hash,
        intents: input.intents,
        diffs: input.diffs,
        destructive_ops: input.destructive_ops,
    };
}
//# sourceMappingURL=observation.js.map