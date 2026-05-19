import { resolve } from 'node:path';
import { homedir, tmpdir } from 'node:os';
export function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
export function safeRegExp(pattern, flags) {
    try {
        return new RegExp(pattern, flags);
    }
    catch {
        return null;
    }
}
const BLOCKED_SYSTEM_PREFIXES = [
    '/etc',
    '/var',
    '/sys',
    '/proc',
    '/dev',
    '/boot',
    '/sbin',
    '/usr/sbin',
];
function isUnder(path, base) {
    return path === base || path.startsWith(base + '/');
}
/**
 * lint が書き込み前に呼ぶ gate。ホーム配下 / `os.tmpdir()` 配下以外と `/etc` 等の
 * システムパスを弾き、解決済み絶対パスを返す。macOS tmpdir は `/var/folders/...`
 * なので、システム prefix チェックより先に tmp / home 判定を通す。
 */
export function validateProjectPath(inputPath) {
    if (!inputPath) {
        throw new Error('Project path must not be empty');
    }
    const resolved = resolve(inputPath);
    if (resolved === '/') {
        throw new Error(`Project path "${inputPath}" resolves to root directory "/". ` +
            `This is not allowed for security reasons.`);
    }
    const home = homedir();
    const tmp = tmpdir();
    const isUnderHome = isUnder(resolved, home);
    const isUnderTmp = isUnder(resolved, '/tmp') || isUnder(resolved, tmp);
    if (isUnderHome || isUnderTmp) {
        return resolved;
    }
    for (const prefix of BLOCKED_SYSTEM_PREFIXES) {
        if (isUnder(resolved, prefix)) {
            throw new Error(`Project path "${inputPath}" resolves to system directory "${resolved}". ` +
                `Access to ${prefix} is not allowed for security reasons.`);
        }
    }
    throw new Error(`Project path "${inputPath}" resolves to "${resolved}" which is outside ` +
        `the allowed directories (home directory or tmp). ` +
        `This is not allowed for security reasons.`);
}
//# sourceMappingURL=sanitize.js.map