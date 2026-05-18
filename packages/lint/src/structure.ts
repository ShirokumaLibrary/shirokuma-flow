import { resolve } from 'node:path';
import { dirExists, fileExists } from './file.js';
import { escapesProjectRoot } from './path-guard.js';
import type {
  LintStructureConfig,
  LintStructureReport,
  StructureCheck,
} from './structure-types.js';

export interface LintStructureParams {
  projectPath: string;
  config: LintStructureConfig;
}

export function lintStructure(params: LintStructureParams): LintStructureReport {
  const projectPath = resolve(params.projectPath);
  const checks: StructureCheck[] = [];

  for (const dir of params.config.dirRequired ?? []) {
    checks.push(dirCheck(projectPath, dir, 'dir-required', 'error'));
  }
  for (const file of params.config.fileRequired ?? []) {
    checks.push(fileCheck(projectPath, file, 'file-required'));
  }
  for (const dir of params.config.dirRecommended ?? []) {
    checks.push(dirCheck(projectPath, dir, 'dir-recommended', 'warning'));
  }

  let errorCount = 0;
  let warningCount = 0;
  let passCount = 0;
  for (const c of checks) {
    if (c.status === 'error') errorCount++;
    else if (c.status === 'warning') warningCount++;
    else passCount++;
  }

  return {
    checks,
    summary: {
      totalChecks: checks.length,
      errorCount,
      warningCount,
      passCount,
    },
    passed: errorCount === 0,
  };
}

function dirCheck(
  projectPath: string,
  relPath: string,
  rule: 'dir-required' | 'dir-recommended',
  failStatus: 'error' | 'warning',
): StructureCheck {
  if (escapesProjectRoot(projectPath, relPath)) {
    return {
      rule,
      status: 'error',
      target: relPath,
      message: `Path escapes project root: ${relPath} (must be relative to project and within the tree)`,
    };
  }
  const absolute = resolve(projectPath, relPath);
  return dirExists(absolute)
    ? { rule, status: 'pass', target: relPath }
    : {
        rule,
        status: failStatus,
        target: relPath,
        message: `Missing ${failStatus === 'error' ? 'required' : 'recommended'} directory: ${relPath}`,
      };
}

function fileCheck(projectPath: string, relPath: string, rule: 'file-required'): StructureCheck {
  if (escapesProjectRoot(projectPath, relPath)) {
    return {
      rule,
      status: 'error',
      target: relPath,
      message: `Path escapes project root: ${relPath} (must be relative to project and within the tree)`,
    };
  }
  const absolute = resolve(projectPath, relPath);
  return fileExists(absolute)
    ? { rule, status: 'pass', target: relPath }
    : {
        rule,
        status: 'error',
        target: relPath,
        message: `Missing required file: ${relPath}`,
      };
}
