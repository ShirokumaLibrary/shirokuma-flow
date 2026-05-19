import { posix } from 'node:path';
import { classifyLink, extractLinks } from './link-checker.js';
export const ARTIFACT_CROSS_REF_RULES = {
    crossRef: 'artifact-cross-ref',
};
export const DEFAULT_FORBIDDEN_PATH_PATTERNS = [
    '.shirokuma/contexts/',
    '.shirokuma/rules/',
    '.claude/rules/',
    '.claude/skills/',
    '.claude/agents/',
];
// Resolve relative to the source file using posix operations only — avoids
// node:path.resolve's CWD dependency, which would cause false positives when
// the project is cloned under a directory whose name overlaps a forbidden
// pattern (e.g. `~/.shirokuma/contexts/myproject`). Must stay CWD-independent
// for downstream distribution (ADR-0018).
function resolveTargetPath(url, sourceRelPath) {
    const urlNoAnchor = url.replace(/\\/g, '/').split('#')[0] ?? '';
    if (urlNoAnchor.startsWith('/'))
        return urlNoAnchor.replace(/^\/+/, '');
    const src = sourceRelPath.replace(/\\/g, '/');
    const srcDir = src.includes('/') ? src.slice(0, src.lastIndexOf('/')) : '';
    return posix.normalize(posix.join(srcDir, urlNoAnchor)).replace(/^\.\//, '');
}
function findForbiddenMatch(target, patterns) {
    for (const pattern of patterns) {
        if (target.includes(pattern))
            return pattern;
    }
    return null;
}
export function checkArtifactCrossRef(content, relFilePath, options = {}) {
    const result = { valid: true, errors: [], warnings: [], infos: [] };
    const indexTypeRules = options.indexTypeRules ?? [];
    const patterns = options.forbiddenPathPatterns ?? DEFAULT_FORBIDDEN_PATH_PATTERNS;
    const normalizedPath = relFilePath.replace(/\\/g, '/');
    if (indexTypeRules.some((idx) => idx.replace(/\\/g, '/') === normalizedPath))
        return result;
    for (const link of extractLinks(content)) {
        const linkType = classifyLink(link.url);
        if (linkType === 'external' || linkType === 'anchor')
            continue;
        const target = resolveTargetPath(link.url, relFilePath);
        const matched = findForbiddenMatch(target, patterns);
        if (matched === null)
            continue;
        result.warnings.push({
            type: 'warning',
            message: `Artifact cross-reference to "${matched}" path delegates meaning to another artifact (ADR-0027 §4 anti-pattern). Allowed alternatives: inline reconstruction, URL breadcrumb, ADR cite, sub-agent \`skills\` frontmatter, or operational invocation.`,
            file: relFilePath,
            line: link.line,
            rule: ARTIFACT_CROSS_REF_RULES.crossRef,
        });
    }
    return result;
}
//# sourceMappingURL=artifact-cross-ref.js.map