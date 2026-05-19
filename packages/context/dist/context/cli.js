import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { detectFromPackageJson } from './detect.js';
import { executePreset } from './execute-preset.js';
import { DEFAULT_CONTEXTS_ROOT, resolveOutputDir, discoverFilesystemSources, readLastFetched } from './fs-helpers.js';
import { listSources } from './list.js';
import { createConsoleLogger, NOOP_LOGGER } from './logger.js';
import { writeManifest } from './manifest.js';
import { PRESETS, resolvePresetMeta, listPresetNames } from './presets.js';
import { removeSource } from './remove.js';
import { search } from './search.js';
import { createEmptyStats } from './stats.js';
import { loadContextsConfig } from './config.js';
import { emitJson } from '@shirokuma-library/lint/help-json';
function writeJson(value, pretty) {
    const body = pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
    process.stdout.write(body + '\n');
}
/** ADR-0012 準拠: エラーも JSON で表現し、stderr ではなく stdout に出力する。 */
function writeError(message, extra, pretty) {
    emitJson({ error: message, ...extra }, { exitCode: 1, pretty });
}
function readProjectPackageJson(projectPath, pretty) {
    const pkgJsonPath = join(projectPath, 'package.json');
    let raw;
    try {
        raw = readFileSync(pkgJsonPath, 'utf-8');
    }
    catch (err) {
        const code = err.code;
        if (code === 'ENOENT') {
            writeError('package.json が見つかりません', { path: pkgJsonPath, hint: 'Node.js プロジェクトのルートで実行してください' }, pretty);
        }
        else {
            writeError('package.json の読み込みに失敗しました', { error: String(err) }, pretty);
        }
        // writeError は emitJson 経由で process.exit するので以下には到達しないが
        // TypeScript の型チェックのために process.exit を残す
        process.exit(1);
    }
    try {
        return JSON.parse(raw);
    }
    catch (err) {
        writeError('package.json のパースに失敗しました', { error: String(err) }, pretty);
        process.exit(1);
    }
}
async function regenerateManifest(projectPath, docsRoot) {
    try {
        const sources = discoverFilesystemSources(projectPath, docsRoot);
        await writeManifest({
            projectPath,
            sources,
            docsRoot,
            resolvePackageName: (n) => resolvePresetMeta(n)?.packageNames?.[0] ?? null,
        });
    }
    catch {
        // manifest は派生物なので失敗しても fetch 自体の結果は壊さない
    }
}
/**
 * context サブコマンド群を親コマンドに登録する。
 * 統合 CLI（shirokuma-ai-docs）から呼び出される。
 */
export function registerContextCommands(parent) {
    parent
        .description('外部ドキュメント（llms.txt / GitHub）を取得してローカルに Markdown として保持する CLI。')
        .option('--project <path>', 'プロジェクトルート（既定: cwd）')
        .option('--docs-root <path>', `ドキュメント保存ルート（既定: ${DEFAULT_CONTEXTS_ROOT}）`)
        .option('--pretty', 'JSON をインデント整形、logger 出力を有効化')
        .option('--verbose', 'debug ログを出力（--pretty と併用）');
    function contextFromParent() {
        const opts = parent.opts();
        const pretty = opts.pretty ?? false;
        return {
            projectPath: opts.project ? resolve(opts.project) : process.cwd(),
            docsRoot: opts.docsRoot,
            pretty,
            logger: pretty ? createConsoleLogger(opts.verbose ?? false) : NOOP_LOGGER,
        };
    }
    parent
        .command('list')
        .description('fetch 済みドキュメントソースの状態を列挙する')
        .action(() => {
        const ctx = contextFromParent();
        writeJson(listSources({ projectPath: ctx.projectPath, docsRoot: ctx.docsRoot }), ctx.pretty);
    });
    parent
        .command('remove <name>')
        .description('指定ソースのローカルディレクトリと MANIFEST エントリを削除する')
        .option('--yes', '削除を実行する（未指定時は dry-run）')
        .action((name, cmdOpts) => {
        const ctx = contextFromParent();
        const outputDir = resolveOutputDir({
            projectPath: ctx.projectPath,
            sourceName: name,
            docsRoot: ctx.docsRoot,
        });
        if (!cmdOpts.yes) {
            writeJson({ ok: false, message: '--yes を付けて再実行してください', outputDir }, ctx.pretty);
            return;
        }
        const result = removeSource({
            projectPath: ctx.projectPath,
            sourceName: name,
            docsRoot: ctx.docsRoot,
        });
        writeJson(result, ctx.pretty);
        if (!result.removed)
            process.exit(1);
    });
    parent
        .command('search <query>')
        .description('ローカル fetch 済みドキュメントから keyword / regex でマッチを返す')
        .option('--source <name>', '特定ソースに絞る')
        .option('--regex', 'query を正規表現として扱う')
        .option('--context <n>', '前後 n 行を含める', (v) => Number.parseInt(v, 10))
        .option('--limit <n>', '合計マッチ件数の上限', (v) => Number.parseInt(v, 10))
        .option('--section', 'マッチ行を含む見出しセクションの全文を付ける')
        .action((query, cmdOpts) => {
        const ctx = contextFromParent();
        const result = search({
            projectPath: ctx.projectPath,
            docsRoot: ctx.docsRoot,
            query,
            source: cmdOpts.source,
            regex: cmdOpts.regex ?? false,
            context: cmdOpts.context,
            limit: cmdOpts.limit,
            section: cmdOpts.section ?? false,
        });
        if (result.sourceNotFound) {
            writeError(`source "${cmdOpts.source}" が見つかりません`, {}, ctx.pretty);
        }
        writeJson(result.matches, ctx.pretty);
    });
    parent
        .command('manifest')
        .description('MANIFEST.md を再生成する（fetch 済みソースから）')
        .action(async () => {
        const ctx = contextFromParent();
        const statuses = listSources({ projectPath: ctx.projectPath, docsRoot: ctx.docsRoot });
        await writeManifest({
            projectPath: ctx.projectPath,
            sources: statuses.map((s) => ({ name: s.name })),
            docsRoot: ctx.docsRoot,
            resolvePackageName: (name) => resolvePresetMeta(name)?.packageNames?.[0] ?? null,
        });
        writeJson({ ok: true, sources: statuses.length }, ctx.pretty);
    });
    parent
        .command('fetch [name]')
        .description('指定プリセットでドキュメントを取得する。name 省略時は fetch 済みソースを全件再取得。')
        .option('--force', 'キャッシュを無視して再取得')
        .option('--dry-run', '取得予定 URL を出力して終了')
        .option('--no-images', '画像ダウンロードをスキップ')
        .option('--auto-detect', 'package.json の依存を解析し、プリセットにマッチする未 fetch ソースをまとめて取得')
        .action(async (name, cmdOpts) => {
        const ctx = contextFromParent();
        const config = loadContextsConfig(ctx.projectPath);
        const docsRoot = ctx.docsRoot ?? config.contexts?.outputDir;
        if (cmdOpts.autoDetect && name) {
            writeError('--auto-detect と name 引数は同時に指定できません', { hint: 'name 指定: fetch <name>  /  自動検出: fetch --auto-detect' }, ctx.pretty);
        }
        if (cmdOpts.autoDetect) {
            const pkg = readProjectPackageJson(ctx.projectPath, ctx.pretty);
            const detected = detectFromPackageJson(pkg);
            const targets = cmdOpts.force
                ? detected
                : detected.filter((d) => {
                    const outDir = resolveOutputDir({
                        projectPath: ctx.projectPath,
                        sourceName: d.preset,
                        docsRoot,
                    });
                    return readLastFetched(outDir) === null;
                });
            if (targets.length === 0) {
                const msg = detected.length === 0
                    ? 'ビルトインプリセットにマッチする依存関係が見つかりませんでした'
                    : `${detected.length} 件検出済み（全て fetch 済み）。--force で再取得できます`;
                writeJson({ ok: true, message: msg, detected: detected.length, fetched: 0 }, ctx.pretty);
                return;
            }
            ctx.logger.info(`[auto-detect] ${targets.length} 件のソースを処理します`);
            const results = [];
            let anyFailed = false;
            for (const d of targets) {
                if (cmdOpts.dryRun) {
                    ctx.logger.info(`[auto-detect][dry-run] "${d.preset}" を fetch 予定`);
                    continue;
                }
                const outDir = resolveOutputDir({
                    projectPath: ctx.projectPath,
                    sourceName: d.preset,
                    docsRoot,
                });
                const stats = await executePreset(d.preset, {
                    src: { name: d.preset },
                    outDir,
                    options: {
                        force: cmdOpts.force ?? false,
                        dryRun: false,
                        images: cmdOpts.images ?? true,
                    },
                    stats: createEmptyStats(),
                    logger: ctx.logger,
                });
                if (stats.failed > 0)
                    anyFailed = true;
                results.push({ name: d.preset, outDir, stats });
            }
            if (!cmdOpts.dryRun) {
                await regenerateManifest(ctx.projectPath, docsRoot);
            }
            writeJson({ ok: !anyFailed, results }, ctx.pretty);
            if (anyFailed)
                process.exit(1);
            return;
        }
        if (name) {
            if (!(name in PRESETS)) {
                writeError(`unknown preset "${name}"`, { available: listPresetNames() }, ctx.pretty);
            }
            const outDir = resolveOutputDir({
                projectPath: ctx.projectPath,
                sourceName: name,
                docsRoot,
            });
            const finalStats = await executePreset(name, {
                src: { name },
                outDir,
                options: {
                    force: cmdOpts.force ?? false,
                    dryRun: cmdOpts.dryRun ?? false,
                    images: cmdOpts.images ?? true,
                },
                stats: createEmptyStats(),
                logger: ctx.logger,
            });
            writeJson({ name, outDir, stats: finalStats }, ctx.pretty);
            return;
        }
        const allSources = discoverFilesystemSources(ctx.projectPath, docsRoot);
        if (allSources.length === 0) {
            writeError('取得済みのドキュメントがありません', { hint: '取得するには: shirokuma-context fetch <name>' }, ctx.pretty);
        }
        const results = [];
        let anyFailed = false;
        for (const src of allSources) {
            const outDir = resolveOutputDir({
                projectPath: ctx.projectPath,
                sourceName: src.name,
                docsRoot,
            });
            const stats = await executePreset(src.name, {
                src,
                outDir,
                options: {
                    force: cmdOpts.force ?? false,
                    dryRun: cmdOpts.dryRun ?? false,
                    images: cmdOpts.images ?? true,
                },
                stats: createEmptyStats(),
                logger: ctx.logger,
            });
            if (stats.failed > 0)
                anyFailed = true;
            if (!cmdOpts.dryRun)
                results.push({ name: src.name, outDir, stats });
        }
        if (!cmdOpts.dryRun) {
            await regenerateManifest(ctx.projectPath, docsRoot);
        }
        writeJson({ ok: !anyFailed, results }, ctx.pretty);
        if (anyFailed)
            process.exit(1);
    });
    parent
        .command('detect')
        .description('package.json の依存関係からドキュメントソースを自動検出（プリセット逆引き）')
        .option('--format <format>', '出力形式: table-json, json（既定: table-json）', 'table-json')
        .action((cmdOpts) => {
        const ctx = contextFromParent();
        const config = loadContextsConfig(ctx.projectPath);
        const docsRoot = ctx.docsRoot ?? config.contexts?.outputDir;
        const pkg = readProjectPackageJson(ctx.projectPath, ctx.pretty);
        const detected = detectFromPackageJson(pkg).map((d) => {
            const outDir = resolveOutputDir({
                projectPath: ctx.projectPath,
                sourceName: d.preset,
                docsRoot,
            });
            const fetched = readLastFetched(outDir);
            return {
                source: d.preset,
                packages: d.matchedPackages,
                status: fetched !== null ? 'ready' : 'not-fetched',
            };
        });
        if (detected.length === 0) {
            writeJson({
                message: 'ビルトインプリセットにマッチする依存関係が見つかりませんでした。fetch --help でプリセット一覧を確認してください。',
                detected: [],
            }, ctx.pretty);
            return;
        }
        if (cmdOpts.format === 'json') {
            writeJson(detected, ctx.pretty);
            return;
        }
        const tableData = detected.map((r) => ({
            Source: r.source,
            Packages: r.packages.join(', '),
            Status: r.status,
        }));
        writeJson(tableData, ctx.pretty);
    });
}
//# sourceMappingURL=cli.js.map