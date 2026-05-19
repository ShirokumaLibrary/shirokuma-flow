/**
 * Token optimizer
 * Detects token optimization opportunities without modifying files
 */
export class TokenOptimizer {
    rules = [];
    constructor() {
        this.registerBuiltinRules();
    }
    /**
     * Register built-in optimization rules
     */
    registerBuiltinRules() {
        // Rule: structural-bold
        this.rules.push({
            id: 'structural-bold',
            name: 'Structural Bold in Key-Value Pairs',
            severity: 'warning',
            description: 'Bold used for structural markup instead of semantic emphasis',
            detect: (content, filePath) => {
                const issues = [];
                const lines = content.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const lineNum = i + 1;
                    // Pattern: **Key**: Value (at start of line)
                    const match = line.match(/^\s*\*\*([^*]+)\*\*:\s*(.+)$/);
                    if (match && match[1] && match[2]) {
                        const key = match[1];
                        const value = match[2];
                        const before = `**${key}**: ${value}`;
                        const after = `${key}: ${value}`;
                        issues.push({
                            severity: 'warning',
                            message: 'Structural bold in key-value pair wastes ~4 tokens',
                            file: filePath,
                            line: lineNum,
                            rule: 'structural-bold',
                            tokenSavings: 4,
                            suggestion: `Remove bold: ${after}`,
                            before,
                            after,
                            context: line.substring(0, 80),
                        });
                    }
                }
                return issues;
            },
            estimateTokenSavings: (issue) => issue.tokenSavings,
        });
        // Rule: verbose-phrase
        this.rules.push({
            id: 'verbose-phrase',
            name: 'Verbose Phrases',
            severity: 'info',
            description: 'Verbose phrases that can be simplified',
            detect: (content, filePath) => {
                const issues = [];
                const lines = content.split('\n');
                // Define phrase replacements
                const phrases = [
                    { before: '詳細なログを出力', after: '詳細ログ出力', savings: 2 },
                    { before: 'Combine multiple Markdown files into', after: 'Combine files into', savings: 3 },
                    { before: 'Automatically extract', after: 'Auto-extract', savings: 2 },
                ];
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const lineNum = i + 1;
                    for (const phrase of phrases) {
                        if (line.includes(phrase.before)) {
                            issues.push({
                                severity: 'info',
                                message: `Verbose phrase can be simplified (saves ~${phrase.savings} tokens)`,
                                file: filePath,
                                line: lineNum,
                                rule: 'verbose-phrase',
                                tokenSavings: phrase.savings,
                                suggestion: `Replace "${phrase.before}" with "${phrase.after}"`,
                                before: phrase.before,
                                after: phrase.after,
                                context: line.substring(0, 80),
                            });
                        }
                    }
                }
                return issues;
            },
            estimateTokenSavings: (issue) => issue.tokenSavings,
        });
        // Rule: internal-link
        this.rules.push({
            id: 'internal-link',
            name: 'Internal Links in Combined Output',
            severity: 'warning',
            description: 'Internal links are redundant when all content is combined',
            detect: (content, filePath) => {
                const issues = [];
                const lines = content.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const lineNum = i + 1;
                    // Pattern: [text](../path/file.md) or [text](./file.md)
                    const regex = /\[([^\]]+)\]\(((?:\.\.\/)+[^\)]+\.md|\.\/[^\)]+\.md)\)/g;
                    let match;
                    while ((match = regex.exec(line)) !== null) {
                        const text = match[1];
                        const link = match[2];
                        const fullMatch = match[0];
                        issues.push({
                            severity: 'warning',
                            message: 'Internal link is redundant in combined LLM output',
                            file: filePath,
                            line: lineNum,
                            rule: 'internal-link',
                            tokenSavings: Math.floor(link.length / 2), // Rough estimate
                            suggestion: `Remove link markup: "${text}" (or keep path as plain text)`,
                            before: fullMatch,
                            after: text,
                            context: `Build combines all files → LLM sees entire context`,
                        });
                    }
                }
                return issues;
            },
            estimateTokenSavings: (issue) => issue.tokenSavings,
        });
        // Rule: redundant-modifier
        this.rules.push({
            id: 'redundant-modifier',
            name: 'Redundant Modifiers',
            severity: 'info',
            description: 'Redundant modifiers and filler words that can be removed',
            detect: (content, filePath) => {
                const issues = [];
                const lines = content.split('\n');
                const modifiers = [
                    { word: '非常に', savings: 1 },
                    { word: 'とても', savings: 1 },
                    { word: 'Automatically', savings: 1 },
                    { word: 'multiple', savings: 1 },
                ];
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const lineNum = i + 1;
                    for (const mod of modifiers) {
                        if (line.includes(mod.word)) {
                            issues.push({
                                severity: 'info',
                                message: `Redundant modifier "${mod.word}" can be removed`,
                                file: filePath,
                                line: lineNum,
                                rule: 'redundant-modifier',
                                tokenSavings: mod.savings,
                                suggestion: `Remove "${mod.word}"`,
                                before: mod.word,
                                after: '',
                                context: line.substring(0, 80),
                            });
                        }
                    }
                }
                return issues;
            },
            estimateTokenSavings: (issue) => issue.tokenSavings,
        });
    }
    /**
     * Analyze content for token optimization opportunities
     */
    analyze(content, filePath) {
        const allIssues = [];
        for (const rule of this.rules) {
            const issues = rule.detect(content, filePath);
            allIssues.push(...issues);
        }
        return allIssues;
    }
    /**
     * Generate optimization report
     */
    generateReport(issues) {
        const issuesBySeverity = {
            error: [],
            warning: [],
            info: [],
        };
        const issuesByRule = {};
        let totalTokenSavings = 0;
        for (const issue of issues) {
            issuesBySeverity[issue.severity].push(issue);
            if (!issuesByRule[issue.rule]) {
                issuesByRule[issue.rule] = [];
            }
            issuesByRule[issue.rule].push(issue);
            totalTokenSavings += issue.tokenSavings;
        }
        const recommendations = this.generateRecommendations(issues, totalTokenSavings);
        return {
            issues,
            totalIssues: issues.length,
            totalTokenSavings,
            issuesBySeverity,
            issuesByRule,
            recommendations,
        };
    }
    /**
     * Generate recommendations based on issues
     */
    generateRecommendations(issues, totalSavings) {
        const recommendations = [];
        if (issues.length === 0) {
            recommendations.push('✓ No token optimization issues found!');
            return recommendations;
        }
        recommendations.push(`Found ${issues.length} optimization opportunities (${totalSavings} tokens)`);
        // Priority recommendations
        const warnings = issues.filter(i => i.severity === 'warning');
        if (warnings.length > 0) {
            recommendations.push(`1. Fix ${warnings.length} warnings first (highest impact)`);
        }
        recommendations.push('2. Use Claude Code for context-aware fixes');
        recommendations.push('3. Run: claude "optimize docs based on lint report"');
        return recommendations;
    }
    /**
     * Format report as markdown
     */
    formatReportMarkdown(report) {
        const lines = [];
        lines.push('# Token Optimization Report');
        lines.push('');
        lines.push(`**Issues Found**: ${report.totalIssues}`);
        lines.push(`**Potential Token Savings**: ${report.totalTokenSavings} tokens`);
        lines.push('');
        if (report.totalIssues === 0) {
            lines.push('✓ No optimization opportunities found!');
            return lines.join('\n');
        }
        // Group by file
        const fileGroups = new Map();
        for (const issue of report.issues) {
            if (!fileGroups.has(issue.file)) {
                fileGroups.set(issue.file, []);
            }
            fileGroups.get(issue.file).push(issue);
        }
        lines.push('## Issues by File');
        lines.push('');
        for (const [file, fileIssues] of fileGroups) {
            lines.push(`### ${file}`);
            lines.push('');
            for (const issue of fileIssues) {
                lines.push(`**Line ${issue.line}** (${issue.severity}): ${issue.message}`);
                if (issue.before && issue.after) {
                    lines.push(`- Before: \`${issue.before}\``);
                    lines.push(`- After: \`${issue.after}\``);
                }
                lines.push(`- Token savings: ~${issue.tokenSavings}`);
                lines.push('');
            }
        }
        lines.push('## Summary by Severity');
        lines.push('');
        for (const severity of ['error', 'warning', 'info']) {
            const count = report.issuesBySeverity[severity].length;
            const savings = report.issuesBySeverity[severity].reduce((sum, i) => sum + i.tokenSavings, 0);
            lines.push(`- **${severity}**: ${count} issues (${savings} tokens)`);
        }
        lines.push('');
        lines.push('## Summary by Rule');
        lines.push('');
        for (const [rule, issues] of Object.entries(report.issuesByRule)) {
            const savings = issues.reduce((sum, i) => sum + i.tokenSavings, 0);
            lines.push(`- **${rule}**: ${issues.length} issues (${savings} tokens)`);
        }
        lines.push('');
        lines.push('## Recommendations');
        lines.push('');
        for (const rec of report.recommendations) {
            lines.push(`- ${rec}`);
        }
        return lines.join('\n');
    }
    /**
     * Format report as JSON
     */
    formatReportJSON(report) {
        return JSON.stringify(report, null, 2);
    }
}
//# sourceMappingURL=token-optimizer.js.map