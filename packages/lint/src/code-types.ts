export type CodeIssueRule =
  | 'module-tag-required'
  | 'function-jsdoc-required'
  | 'function-tag-required';

export interface CodeIssue {
  rule: CodeIssueRule;
  status: 'error';
  file: string;
  line?: number;
  functionName?: string;
  tag?: string;
  message: string;
}

export interface CodeRule {
  /** project root 相対の glob（例: `src/**\/*.ts`） */
  filePattern: string;
  excludePatterns?: string[];
  /** 各ファイル先頭の JSDoc に必須のタグ（例: `['@module']`） */
  moduleTags?: string[];
  /** 各 `export [async] function` に必須のタグ（例: `['@returns']`） */
  functionTags?: string[];
}

export interface LintCodeConfig {
  rules: CodeRule[];
}

export interface LintCodeReport {
  issues: CodeIssue[];
  summary: {
    rulesRun: number;
    filesChecked: number;
    issueCount: number;
  };
  passed: boolean;
}
