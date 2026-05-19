import { basename, join, relative } from 'node:path';
import { globSync } from 'glob';
import { readFile } from './file.js';
import { defaultConventions, defaultExcludes } from './coverage-types.js';
const IT_CALL_RE = /\bit\s*\(/g;
const TEST_CALL_RE = /\btest\s*\(/g;
export function lintCoverage(params) {
    const { projectPath } = params;
    const config = params.config ?? {};
    const conventions = config.conventions ?? defaultConventions;
    const excludes = config.exclude ?? defaultExcludes;
    const sourceFiles = collectSourceFiles(projectPath, conventions, excludes);
    const testFiles = collectTestFiles(projectPath, conventions);
    return checkCoverage(projectPath, sourceFiles, testFiles, conventions);
}
function collectSourceFiles(projectPath, conventions, excludes) {
    const all = new Set();
    for (const conv of conventions) {
        const pattern = join(projectPath, conv.source);
        const files = globSync(pattern, {
            ignore: excludes.map((e) => join(projectPath, e)),
            nodir: true,
        });
        for (const file of files)
            all.add(relative(projectPath, file));
    }
    return Array.from(all).sort();
}
function collectTestFiles(projectPath, conventions) {
    const testFiles = new Map();
    for (const conv of conventions) {
        const pattern = join(projectPath, conv.test);
        const files = globSync(pattern, { nodir: true });
        for (const file of files) {
            const relativePath = relative(projectPath, file);
            const content = readFile(file) ?? '';
            testFiles.set(relativePath, countTests(content));
        }
    }
    return testFiles;
}
function countTests(content) {
    const itMatches = content.match(IT_CALL_RE) ?? [];
    const testMatches = content.match(TEST_CALL_RE) ?? [];
    return itMatches.length + testMatches.length;
}
export function extractSkipTest(content) {
    const skip = content.match(/@skip-test\s+(.+?)(?:\n|\*\/)/);
    if (!skip?.[1])
        return undefined;
    const reason = skip[1].trim();
    const see = content.match(/@see\s+(\S+)/);
    return see?.[1] ? { reason, seeReference: see[1] } : { reason };
}
function stripTestExt(name) {
    return name.replace(/\.test(\.[tj]sx?)$/, '$1');
}
function firstSegment(pattern) {
    return pattern.split('/')[0];
}
function guessSourceFromTest(testPath, conventions) {
    const conv = conventions[0];
    if (!conv)
        return undefined;
    const testPrefix = firstSegment(conv.test);
    const sourcePrefix = firstSegment(conv.source);
    if (!testPrefix || !sourcePrefix)
        return undefined;
    const base = stripTestExt(basename(testPath));
    if (testPath.startsWith(testPrefix + '/')) {
        return join(sourcePrefix, base);
    }
    return undefined;
}
function checkCoverage(projectPath, sourceFiles, testFilesMap, conventions) {
    const results = [];
    const orphans = [];
    const matched = new Set();
    for (const sourcePath of sourceFiles) {
        const content = readFile(join(projectPath, sourcePath)) ?? '';
        const skip = extractSkipTest(content);
        if (skip) {
            results.push({
                source: sourcePath,
                testCount: 0,
                status: 'skipped',
                skipReason: skip.reason,
                ...(skip.seeReference !== undefined && { seeReference: skip.seeReference }),
            });
            continue;
        }
        const sourceBase = basename(sourcePath).replace(/\.tsx?$/, '');
        const wantTs = `${sourceBase}.test.ts`;
        const wantTsx = `${sourceBase}.test.tsx`;
        let foundTest;
        let foundCount = 0;
        // monorepo で同一 basename（index.ts / util.ts 等）が複数 source に存在する
        // 場合、一つの test ファイルを複数 source に credit させないため matched で skip。
        for (const [testPath, count] of testFilesMap) {
            if (matched.has(testPath))
                continue;
            if (basename(testPath) === wantTs || basename(testPath) === wantTsx) {
                foundTest = testPath;
                foundCount = count;
                matched.add(testPath);
                break;
            }
        }
        results.push({
            source: sourcePath,
            ...(foundTest !== undefined && { test: foundTest }),
            testCount: foundCount,
            status: foundTest ? 'covered' : 'missing',
        });
    }
    for (const [testPath] of testFilesMap) {
        if (matched.has(testPath))
            continue;
        const expectedSource = guessSourceFromTest(testPath, conventions);
        if (expectedSource)
            orphans.push({ test: testPath, expectedSource });
    }
    let coveredCount = 0;
    let skippedCount = 0;
    let missingCount = 0;
    for (const r of results) {
        if (r.status === 'covered')
            coveredCount++;
        else if (r.status === 'skipped')
            skippedCount++;
        else
            missingCount++;
    }
    const totalSources = results.length;
    const coveragePercent = totalSources > 0 ? Math.round(((coveredCount + skippedCount) / totalSources) * 100) : 100;
    return {
        results,
        orphans,
        summary: {
            totalSources,
            coveredCount,
            skippedCount,
            missingCount,
            orphanCount: orphans.length,
            coveragePercent,
        },
        passed: missingCount === 0,
    };
}
//# sourceMappingURL=coverage.js.map