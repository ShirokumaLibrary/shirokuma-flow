import { join, relative, resolve } from 'node:path';
import { globSync } from 'glob';
import { readFile } from './file.js';
import { escapesProjectRoot } from './path-guard.js';
import type { CodeIssue, CodeRule, LintCodeConfig, LintCodeReport } from './code-types.js';

export interface LintCodeParams {
  projectPath: string;
  config: LintCodeConfig;
}

const MODULE_HEADER_RE = /\/\*\*[\s\S]*?\*\//;
const EXPORT_FUNCTION_RE =
  /(?:(\/\*\*[\s\S]*?\*\/)\s*)?export\s+(?:async\s+)?function\s+(\w+)\s*\(/g;
const TAG_RE = /@(\w+)/g;

export function lintCode(params: LintCodeParams): LintCodeReport {
  const projectPath = resolve(params.projectPath);
  const issues: CodeIssue[] = [];
  const filesChecked = new Set<string>();
  const contentCache = new Map<string, string | null>();

  const readCached = (file: string): string | null => {
    const cached = contentCache.get(file);
    if (cached !== undefined) return cached;
    const content = readFile(join(projectPath, file));
    contentCache.set(file, content);
    return content;
  };

  for (const rule of params.config.rules) {
    for (const file of collectFiles(projectPath, rule)) {
      filesChecked.add(file);
      const content = readCached(file);
      if (content === null) continue;
      issues.push(...checkFile(file, content, rule));
    }
  }

  return {
    issues,
    summary: {
      rulesRun: params.config.rules.length,
      filesChecked: filesChecked.size,
      issueCount: issues.length,
    },
    passed: issues.length === 0,
  };
}

function collectFiles(projectPath: string, rule: CodeRule): string[] {
  const pattern = join(projectPath, rule.filePattern);
  const ignore = (rule.excludePatterns ?? []).map((p) => join(projectPath, p));
  const matched = globSync(pattern, { nodir: true, ignore });
  const results: string[] = [];
  for (const abs of matched) {
    const rel = relative(projectPath, abs);
    if (rel === '' || escapesProjectRoot(projectPath, rel)) continue;
    results.push(rel);
  }
  return results.sort();
}

function checkFile(file: string, content: string, rule: CodeRule): CodeIssue[] {
  const issues: CodeIssue[] = [];
  if (rule.moduleTags?.length) {
    issues.push(...checkModuleTags(file, content, rule.moduleTags));
  }
  if (rule.functionTags?.length) {
    issues.push(...checkFunctionTags(file, content, rule.functionTags));
  }
  return issues;
}

function checkModuleTags(file: string, content: string, required: string[]): CodeIssue[] {
  const m = MODULE_HEADER_RE.exec(content);
  const tags = m ? extractTags(m[0]) : [];
  return required
    .filter((t) => !tags.includes(t))
    .map(
      (tag): CodeIssue => ({
        rule: 'module-tag-required',
        status: 'error',
        file,
        tag,
        message: `Missing module tag ${tag} in file-level JSDoc`,
      }),
    );
}

function checkFunctionTags(file: string, content: string, required: string[]): CodeIssue[] {
  const issues: CodeIssue[] = [];
  for (const m of content.matchAll(EXPORT_FUNCTION_RE)) {
    const jsdoc = m[1] ?? '';
    const name = m[2];
    if (!name) continue;
    // m.index は先頭が JSDoc の場合 JSDoc 開始位置を指すので、function キーワード
    // の offset を使って宣言行を正しく報告する。
    const fnOffset = (m.index ?? 0) + m[0].indexOf('function');
    const line = lineOf(content, fnOffset);

    if (!jsdoc) {
      issues.push({
        rule: 'function-jsdoc-required',
        status: 'error',
        file,
        line,
        functionName: name,
        message: `Function ${name} has no JSDoc`,
      });
      continue;
    }

    const tags = extractTags(jsdoc);
    for (const req of required) {
      if (tags.includes(req)) continue;
      issues.push({
        rule: 'function-tag-required',
        status: 'error',
        file,
        line,
        functionName: name,
        tag: req,
        message: `Function ${name} missing tag ${req}`,
      });
    }
  }
  return issues;
}

function extractTags(jsdoc: string): string[] {
  const tags = new Set<string>();
  for (const m of jsdoc.matchAll(TAG_RE)) {
    if (m[1]) tags.add(`@${m[1]}`);
  }
  return [...tags];
}

function lineOf(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}
