import type { Issue } from '../../parsers/md/types/validation.js';
/**
 * Token optimization rule
 */
export interface OptimizationRule {
    id: string;
    name: string;
    severity: 'error' | 'warning' | 'info';
    description: string;
    detect: (content: string, filePath: string) => OptimizationIssue[];
    estimateTokenSavings: (issue: OptimizationIssue) => number;
}
/**
 * Optimization issue (extends base Issue with optimization-specific fields)
 */
export interface OptimizationIssue extends Issue {
    tokenSavings: number;
    suggestion: string;
    before?: string;
    after?: string;
    context?: string;
}
/**
 * Token optimization report
 */
export interface OptimizationReport {
    issues: OptimizationIssue[];
    totalIssues: number;
    totalTokenSavings: number;
    issuesBySeverity: Record<'error' | 'warning' | 'info', OptimizationIssue[]>;
    issuesByRule: Record<string, OptimizationIssue[]>;
    recommendations: string[];
}
/**
 * Token optimizer
 * Detects token optimization opportunities without modifying files
 */
export declare class TokenOptimizer {
    private rules;
    constructor();
    /**
     * Register built-in optimization rules
     */
    private registerBuiltinRules;
    /**
     * Analyze content for token optimization opportunities
     */
    analyze(content: string, filePath: string): OptimizationIssue[];
    /**
     * Generate optimization report
     */
    generateReport(issues: OptimizationIssue[]): OptimizationReport;
    /**
     * Generate recommendations based on issues
     */
    private generateRecommendations;
    /**
     * Format report as markdown
     */
    formatReportMarkdown(report: OptimizationReport): string;
    /**
     * Format report as JSON
     */
    formatReportJSON(report: OptimizationReport): string;
}
//# sourceMappingURL=token-optimizer.d.ts.map