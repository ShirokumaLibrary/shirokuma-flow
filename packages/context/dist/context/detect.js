import { PRESETS } from './presets.js';
/**
 * `package.json` の内容を受け取り、各依存がいずれかのプリセットの `packageNames`
 * に一致するかを評価する。一致したプリセットを重複なしで返す。
 *
 * 引数は「読み込んだ package.json オブジェクト」。ファイル I/O を呼び出し側に
 * 委ねることで Node 依存を下げ、Bun / Deno / ブラウザ環境からも利用できる。
 */
export function detectFromPackageJson(pkg) {
    const installed = collectDependencyNames(pkg);
    if (installed.size === 0)
        return [];
    const results = [];
    for (const [preset, meta] of Object.entries(PRESETS)) {
        const declared = meta.packageNames;
        if (!declared?.length)
            continue;
        const matched = declared.filter((name) => installed.has(name));
        if (matched.length > 0) {
            results.push({ preset, matchedPackages: matched });
        }
    }
    return results;
}
function collectDependencyNames(pkg) {
    const names = new Set();
    for (const field of [
        pkg.dependencies,
        pkg.devDependencies,
        pkg.peerDependencies,
        pkg.optionalDependencies,
    ]) {
        if (field && typeof field === 'object' && !Array.isArray(field)) {
            for (const name of Object.keys(field))
                names.add(name);
        }
    }
    return names;
}
//# sourceMappingURL=detect.js.map