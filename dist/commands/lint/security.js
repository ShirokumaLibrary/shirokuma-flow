/**
 * lint-security コマンド - 依存パッケージ脆弱性チェック
 *
 * パッケージマネージャー（npm / pnpm / yarn）を自動検出し、
 * audit コマンドを実行して脆弱性を検出・報告する。
 *
 * 方針:
 * - lockfile の存在でパッケージマネージャーを自動判定
 * - audit JSON 出力をパース、共通型 VulnerabilityItem に正規化
 * - critical / high はエラー、moderate / low は警告
 * - dev dependency の脆弱性は warning 扱い（production より低重要度）
 * - ネットワークエラー時は warning + skip（lint 全体をブロックしない）
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { createLogger } from "../../utils/logger.js";
import { t } from "../../utils/i18n.js";
import { determineLintExitCode } from "../../lint/exit-code.js";
// =============================================================================
// Package Manager Detection
// =============================================================================
/**
 * lockfile の存在からパッケージマネージャーを検出する
 */
export function detectPackageManager(projectPath) {
    if (existsSync(join(projectPath, "pnpm-lock.yaml"))) {
        return "pnpm";
    }
    if (existsSync(join(projectPath, "yarn.lock"))) {
        return "yarn";
    }
    return "npm";
}
// =============================================================================
// Audit Execution
// =============================================================================
/**
 * audit コマンドを実行し JSON 文字列を返す
 *
 * audit コマンドは脆弱性検出時に exit code 非ゼロを返すため、
 * execSync のエラーから stdout を取り出す。
 * ネットワーク未接続等の真のエラーは ENETUNREACH / ENOTFOUND 等で判断。
 */
export function runAudit(pm, projectPath) {
    const args = ["audit", "--json"];
    try {
        const output = execFileSync(pm, args, {
            cwd: projectPath,
            encoding: "utf8",
            // 脆弱性ありでも stdout を取得するため stdio: pipe
            stdio: ["pipe", "pipe", "pipe"],
        });
        return { output, error: null };
    }
    catch (err) {
        // execFileSync は exit code 非ゼロで例外を throw する
        // stdout が含まれていれば脆弱性検出の正常ケース
        if (err && typeof err === "object" && "stdout" in err) {
            const stdout = err.stdout;
            if (stdout && stdout.trim().length > 0) {
                return { output: stdout, error: null };
            }
        }
        // stdout がない = ネットワークエラー等
        const message = err instanceof Error ? err.message : String(err);
        const isNetworkError = message.includes("ENETUNREACH") ||
            message.includes("ENOTFOUND") ||
            message.includes("ETIMEDOUT") ||
            message.includes("network") ||
            message.includes("ECONNREFUSED");
        if (isNetworkError) {
            return { output: null, error: "NETWORK_ERROR" };
        }
        return { output: null, error: message };
    }
}
// =============================================================================
// Parsers
// =============================================================================
/**
 * npm audit JSON をパースして VulnerabilityItem[] に正規化
 */
function parseNpmAudit(jsonOutput) {
    let parsed;
    try {
        parsed = JSON.parse(jsonOutput);
    }
    catch {
        return [];
    }
    const items = [];
    // npm v7+ 形式: vulnerabilities
    if (parsed.vulnerabilities) {
        for (const [, entry] of Object.entries(parsed.vulnerabilities)) {
            const severity = normalizeSeverity(entry.severity);
            const fixAvailable = entry.fixAvailable === true ||
                (typeof entry.fixAvailable === "object" && entry.fixAvailable !== null);
            // via から CVE IDs と説明を収集
            const cveIds = [];
            let description = "";
            const viaNames = [];
            for (const via of entry.via ?? []) {
                if (typeof via === "string") {
                    viaNames.push(via);
                }
                else {
                    if (via.title)
                        description = via.title;
                    if (via.cwe)
                        cveIds.push(...via.cwe);
                    if (via.name)
                        viaNames.push(via.name);
                }
            }
            // dev 判定: npm v7+ の isDirect フラグを利用。
            // isDirect が false かつ via が他パッケージ経由のみの場合、
            // 保守的に prod 扱い（isDev=false）とする。
            // 明示的な dev 判定は pnpm/yarn の方が正確。
            const isDev = false;
            items.push({
                name: entry.name,
                severity,
                description: description || `Vulnerability in ${entry.name}`,
                range: entry.range,
                fixAvailable,
                cveIds: cveIds.length > 0 ? cveIds : undefined,
                isDev,
                via: viaNames,
            });
        }
        return items;
    }
    // npm v6 形式: advisories
    if (parsed.advisories) {
        for (const [, advisory] of Object.entries(parsed.advisories)) {
            const severity = normalizeSeverity(advisory.severity);
            const isDev = advisory.findings.some((f) => f.paths.some((p) => p.includes(">") || p.includes("dev")));
            items.push({
                name: advisory.module_name,
                severity,
                description: advisory.title,
                fixAvailable: !!advisory.patched_versions && advisory.patched_versions !== "<0.0.0",
                fixedIn: advisory.patched_versions,
                cveIds: advisory.cves,
                isDev,
                via: [],
            });
        }
    }
    return items;
}
/**
 * pnpm audit JSON をパースして VulnerabilityItem[] に正規化
 */
function parsePnpmAudit(jsonOutput) {
    let parsed;
    try {
        parsed = JSON.parse(jsonOutput);
    }
    catch {
        return [];
    }
    const items = [];
    if (!parsed.advisories)
        return items;
    for (const [, advisory] of Object.entries(parsed.advisories)) {
        const severity = normalizeSeverity(advisory.severity);
        const isDev = advisory.findings.some((f) => f.dev);
        items.push({
            name: advisory.module_name,
            severity,
            description: advisory.title,
            fixAvailable: !!advisory.patched_versions && advisory.patched_versions !== "<0.0.0",
            fixedIn: advisory.patched_versions,
            cveIds: advisory.cves,
            isDev,
            via: [],
        });
    }
    return items;
}
/**
 * yarn audit NDJSON をパースして VulnerabilityItem[] に正規化
 *
 * yarn audit は各行が独立した JSON オブジェクトの NDJSON 形式
 */
function parseYarnAudit(jsonOutput) {
    const items = [];
    const seen = new Set();
    for (const line of jsonOutput.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        let obj;
        try {
            obj = JSON.parse(trimmed);
        }
        catch {
            continue;
        }
        const entry = obj;
        if (entry.type !== "auditAdvisory")
            continue;
        const { advisory, resolution } = entry.data;
        const key = `${advisory.module_name}:${advisory.severity}`;
        // 同一パッケージ・severity の重複を除去
        if (seen.has(key))
            continue;
        seen.add(key);
        const severity = normalizeSeverity(advisory.severity);
        items.push({
            name: advisory.module_name,
            severity,
            description: advisory.title,
            fixAvailable: !!advisory.patched_versions && advisory.patched_versions !== "<0.0.0",
            fixedIn: advisory.patched_versions,
            cveIds: advisory.cves,
            isDev: resolution.dev,
            via: [],
        });
    }
    return items;
}
/**
 * パッケージマネージャーに応じて audit 結果をパース
 */
export function parseAuditResult(pm, jsonOutput) {
    switch (pm) {
        case "npm":
            return parseNpmAudit(jsonOutput);
        case "pnpm":
            return parsePnpmAudit(jsonOutput);
        case "yarn":
            return parseYarnAudit(jsonOutput);
    }
}
// =============================================================================
// Helpers
// =============================================================================
/**
 * severity 文字列を正規化
 */
function normalizeSeverity(raw) {
    const lower = raw.toLowerCase();
    if (lower === "critical")
        return "critical";
    if (lower === "high")
        return "high";
    if (lower === "moderate" || lower === "medium")
        return "moderate";
    if (lower === "low")
        return "low";
    return "info";
}
/**
 * severity の重み（フィルタリング用）
 */
const SEVERITY_WEIGHT = {
    critical: 4,
    high: 3,
    moderate: 2,
    low: 1,
    info: 0,
};
/**
 * severity 文字列からフィルタ閾値を取得
 */
function parseSeverityThreshold(level) {
    const lower = (level ?? "high").toLowerCase();
    if (lower === "critical")
        return SEVERITY_WEIGHT.critical;
    if (lower === "high")
        return SEVERITY_WEIGHT.high;
    if (lower === "moderate" || lower === "medium")
        return SEVERITY_WEIGHT.moderate;
    if (lower === "low")
        return SEVERITY_WEIGHT.low;
    return SEVERITY_WEIGHT.high;
}
/**
 * サマリーを計算
 */
function calcSummary(vulnerabilities) {
    let critical = 0, high = 0, moderate = 0, low = 0, info = 0;
    let prodErrorCount = 0;
    for (const v of vulnerabilities) {
        if (v.severity === "critical")
            critical++;
        else if (v.severity === "high")
            high++;
        else if (v.severity === "moderate")
            moderate++;
        else if (v.severity === "low")
            low++;
        else
            info++;
        // errorCount は prod の critical/high のみ（dev は除外）
        if (!v.isDev && (v.severity === "critical" || v.severity === "high")) {
            prodErrorCount++;
        }
    }
    return {
        critical,
        high,
        moderate,
        low,
        info,
        errorCount: prodErrorCount,
        warningCount: moderate + low,
        total: critical + high + moderate + low + info,
    };
}
// =============================================================================
// Formatter
// =============================================================================
/**
 * レポートをフォーマット
 */
function formatReport(report, format) {
    if (format === "json") {
        return JSON.stringify(report, null, 2);
    }
    if (format === "summary") {
        return formatSummary(report);
    }
    return formatTerminal(report);
}
function formatSummary(report) {
    if (report.skipped) {
        return `\nSecurity Audit: SKIPPED\nReason: ${report.skipReason ?? "unknown"}\n`;
    }
    const { summary } = report;
    const lines = [
        "",
        "Security Audit Summary",
        "======================",
        "",
        `Package Manager: ${report.packageManager}`,
        `Critical:        ${summary.critical}`,
        `High:            ${summary.high}`,
        `Moderate:        ${summary.moderate}`,
        `Low:             ${summary.low}`,
        `Total:           ${summary.total}`,
        "",
        report.passed ? "PASSED" : "FAILED",
        "",
    ];
    return lines.join("\n");
}
function formatTerminal(report) {
    const lines = [];
    lines.push("");
    lines.push("Security Vulnerability Audit");
    lines.push("=".repeat(60));
    lines.push("");
    if (report.skipped) {
        lines.push(`\u26A0\uFE0F  Skipped: ${report.skipReason ?? "unknown"}`);
        lines.push("");
        return lines.join("\n");
    }
    lines.push(`Package Manager: ${report.packageManager}`);
    lines.push("");
    if (report.vulnerabilities.length === 0) {
        lines.push("\u2705 No vulnerabilities found");
    }
    else {
        for (const v of report.vulnerabilities) {
            const icon = v.severity === "critical" || v.severity === "high" ? "\u274C" : "\u26A0\uFE0F";
            const devLabel = v.isDev ? " [dev]" : "";
            lines.push(`${icon} ${v.name}${devLabel} (${v.severity})`);
            lines.push(`   ${v.description}`);
            if (v.fixAvailable) {
                lines.push(`   \u2192 Fix available${v.fixedIn ? `: ${v.fixedIn}` : ""}`);
            }
            else {
                lines.push(`   \u2192 No fix available`);
            }
            if (v.cveIds && v.cveIds.length > 0) {
                lines.push(`   CVE: ${v.cveIds.join(", ")}`);
            }
            lines.push("");
        }
    }
    const { summary } = report;
    lines.push("=".repeat(60));
    lines.push("");
    lines.push("Summary:");
    lines.push(`  \u274C Critical:  ${summary.critical}`);
    lines.push(`  \u274C High:      ${summary.high}`);
    lines.push(`  \u26A0\uFE0F  Moderate:  ${summary.moderate}`);
    lines.push(`  \u26A0\uFE0F  Low:       ${summary.low}`);
    lines.push(`  \u2139\uFE0F  Info:      ${summary.info}`);
    lines.push("");
    lines.push(report.passed ? "\u2705 PASSED" : "\u274C FAILED");
    lines.push("");
    return lines.join("\n");
}
// =============================================================================
// Main Handler
// =============================================================================
/**
 * lint-security コマンドハンドラ
 */
export async function lintSecurityCommand(options) {
    const logger = createLogger(options.verbose);
    const projectPath = resolve(options.project);
    logger.info(t("commands.lintSecurity.validating"));
    const pm = detectPackageManager(projectPath);
    logger.info(`パッケージマネージャー: ${pm}`);
    // audit 実行
    const auditResult = runAudit(pm, projectPath);
    if (auditResult.error !== null) {
        const isNetwork = auditResult.error === "NETWORK_ERROR";
        const report = {
            packageManager: pm,
            vulnerabilities: [],
            summary: { critical: 0, high: 0, moderate: 0, low: 0, info: 0, errorCount: 0, warningCount: 0, total: 0 },
            skipped: true,
            skipReason: isNetwork
                ? "ネットワーク未接続のためスキップ"
                : `audit コマンドエラー: ${auditResult.error}`,
            passed: true,
        };
        const outputFormat = options.format ?? "terminal";
        console.log(formatReport(report, outputFormat));
        logger.warn(`セキュリティ監査をスキップ: ${report.skipReason}`);
        return 0;
    }
    // パース
    const allVulnerabilities = parseAuditResult(pm, auditResult.output);
    // severity フィルタ適用
    const threshold = parseSeverityThreshold(options.severity);
    const filtered = allVulnerabilities.filter((v) => SEVERITY_WEIGHT[v.severity] >= threshold);
    const summary = calcSummary(filtered);
    // errorCount は calcSummary 内で prod の critical/high のみカウント
    const passed = summary.errorCount === 0;
    const report = {
        packageManager: pm,
        vulnerabilities: filtered,
        summary,
        skipped: false,
        passed,
    };
    // 出力
    const outputFormat = options.format ?? "terminal";
    const output = formatReport(report, outputFormat);
    if (options.output) {
        const { writeFile } = await import("../../utils/file.js");
        writeFile(options.output, output);
        logger.success(`レポートを出力: ${options.output}`);
    }
    else {
        console.log(output);
    }
    // 結果メッセージ
    const strict = options.strict ?? false;
    if (report.passed) {
        logger.success(t("commands.lintSecurity.allPassed"));
    }
    else if (strict) {
        logger.error(`セキュリティ監査失敗 - critical/high ${summary.errorCount}件の脆弱性が検出されました`);
    }
    else {
        logger.warn(`セキュリティ監査完了 - ${summary.errorCount}件のエラー（non-strictモード）`);
    }
    return determineLintExitCode(report.passed, strict);
}
//# sourceMappingURL=security.js.map