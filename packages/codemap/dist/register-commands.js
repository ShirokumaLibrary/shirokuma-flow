import { resolve } from 'node:path';
import { buildCodemap, writeBuildResult, MAIN_INDEX_PATH, OUTPUT_PATHS } from './build.js';
import { PACKAGE_NAME } from './index.js';
import { buildExecuteEnvelope, buildPlanEnvelope, computePlanHash, DIFF_TO_PLACEHOLDER, } from './observation.js';
import { emitJson } from '@shirokuma-library/lint/help-json';
function writeJson(value, pretty) {
    const body = pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
    process.stdout.write(body + '\n');
}
function resolveProject(opts) {
    return opts.project ? resolve(opts.project) : process.cwd();
}
/**
 * codemap サブコマンド群を親コマンドに登録する。
 * 統合 CLI（shirokuma-ai-docs）から呼び出される。
 */
export function registerCodemapCommands(parent) {
    parent
        .description("Extract AI-consumable system overview from the repo's existing structured signal.")
        .option('--project <path>', 'Project root (default: cwd)')
        .option('--pretty', 'Pretty-print JSON output');
    parent
        .command('build')
        .description('Build the codemap (main index + JIT bodies). ADR-0025 2-stage (no destructive ops).')
        .option('--plan-only', 'Emit plan observation without writing files (default)')
        .option('--execute', 'Write files after validating --plan-hash')
        .option('--plan-hash <sha>', 'sha256 hash of the plan (required with --execute)')
        .option('--tx-id <ulid>', 'ULID from the plan observation (required with --execute)')
        .option('--adr-dir <path>', 'ADR directory relative to --project (default: docs/adr)')
        .action((cmdOpts) => {
        const opts = parent.opts();
        const pretty = opts.pretty ?? false;
        const projectPath = resolveProject(opts);
        if (cmdOpts.planOnly && cmdOpts.execute) {
            emitJson({
                error: 'plan.conflicting_modes',
                message: 'error: --plan-only and --execute are mutually exclusive',
                help_hint: 'pass --plan-only alone for a plan, or --execute --plan-hash <sha> --tx-id <ulid> to commit',
            }, { exitCode: 1, pretty });
        }
        const result = buildCodemap({ projectPath, adrDir: cmdOpts.adrDir });
        const intents = [
            {
                id: 'codemap_build',
                summary: `extract codemap from ${projectPath} (adr: ${result.main_index.sections.adr.count})`,
                risk: 'low',
            },
        ];
        const diffs = OUTPUT_PATHS.map((p) => ({
            target: p,
            from: null,
            to: { bytes: DIFF_TO_PLACEHOLDER },
        }));
        const planHashInput = { intents, diffs, destructive_ops: [] };
        if (cmdOpts.execute) {
            if (!cmdOpts.planHash) {
                emitJson({
                    error: 'plan.missing_hash',
                    message: 'error: --execute requires --plan-hash <sha>',
                    help_hint: 'run with --plan-only first to obtain a plan_hash, then --execute --plan-hash <sha> --tx-id <ulid>',
                }, { exitCode: 1, pretty });
            }
            if (!cmdOpts.txId) {
                emitJson({
                    error: 'plan.missing_tx_id',
                    message: 'error: --execute requires --tx-id <ulid>',
                    help_hint: 'copy the tx_id from the --plan-only envelope and pass it via --tx-id to preserve tx identity (ADR-0025 §3)',
                }, { exitCode: 1, pretty });
            }
            const actualHash = computePlanHash(planHashInput);
            if (actualHash !== cmdOpts.planHash) {
                emitJson({
                    error: 'plan.hash_mismatch',
                    message: `error: --plan-hash ${cmdOpts.planHash} does not match current plan ${actualHash}`,
                    help_hint: 're-run --plan-only to obtain a fresh plan_hash (inputs may have changed)',
                }, { exitCode: 1, pretty });
            }
            writeBuildResult(projectPath, result);
            writeJson({
                ...buildExecuteEnvelope({ ...planHashInput, tx_id: cmdOpts.txId, plan_hash: actualHash }),
                main_index_path: MAIN_INDEX_PATH,
            }, pretty);
            return;
        }
        const envelope = buildPlanEnvelope(planHashInput);
        writeJson(envelope, pretty);
    });
    parent.action(() => {
        writeJson({ package: PACKAGE_NAME }, parent.opts().pretty ?? false);
    });
}
//# sourceMappingURL=register-commands.js.map