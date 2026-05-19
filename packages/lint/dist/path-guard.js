import { isAbsolute, relative, resolve } from 'node:path';
/** project root 外への脱出を検出（`../`, 絶対パス, 解決後に外へ出る path を reject）。 */
export function escapesProjectRoot(projectPath, relPath) {
    if (isAbsolute(relPath))
        return true;
    const rel = relative(projectPath, resolve(projectPath, relPath));
    return rel === '' ? false : rel.startsWith('..');
}
//# sourceMappingURL=path-guard.js.map