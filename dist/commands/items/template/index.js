/**
 * items template サブコマンドグループ (#1836)
 *
 * Issue・計画・PR・ADR・コメントの frontmatter + セクション骨格を生成する。
 * 各テンプレートは純粋関数として個別ファイルに実装し、CLI からは
 * このファクトリ経由で登録する。
 *
 * サブコマンド:
 * - items template issue                  — Issue 作成用テンプレート
 * - items template plan [--level <level>] — 計画 Issue テンプレート
 * - items template pr                     — PR 本文テンプレート
 * - items template adr                    — ADR Discussion テンプレート
 * - items template comment [--type <type>] — コメントテンプレート
 *
 * 共通オプション:
 * - --output <file>  — ファイルに書き出す（省略時は標準出力）
 * - --lang <ja|en>   — 言語（省略時は設定ファイルの language → i18n の currentLocale）
 */
// Commander.js action callbacks receive localOpts as any; parent opts cast via as at boundary.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { Command, Option } from "commander";
import { writeFileSync } from "node:fs";
import { getLocale } from "../../../utils/i18n.js";
/**
 * テンプレート文字列を出力先に書き出す
 * @param result - テンプレート文字列
 * @param outputPath - 出力ファイルパス（未指定時は stdout）
 */
function writeOutput(result, outputPath) {
    if (outputPath) {
        writeFileSync(outputPath, result, "utf-8");
    }
    else {
        process.stdout.write(result);
    }
}
/** --lang 共通オプションを生成する */
function langOption() {
    return new Option("--lang <lang>", "言語 (ja|en)").choices(["ja", "en"]).default(getLocale());
}
/**
 * items template サブコマンドグループを生成する
 */
export function createTemplateCommand() {
    const template = new Command("template")
        .description("テンプレート骨格を生成する (issue, plan, pr, adr, comment)");
    // ---------------------------------------------------------------------------
    // issue
    // ---------------------------------------------------------------------------
    template
        .command("issue")
        .description("Issue 作成用テンプレートを出力")
        .option("--output <file>", "出力ファイルパス")
        .addOption(langOption())
        .action(async (localOpts) => {
        const { generateIssueTemplate } = await import("./issue.js");
        const result = generateIssueTemplate(localOpts.lang);
        writeOutput(result, localOpts.output);
    });
    // ---------------------------------------------------------------------------
    // plan
    // ---------------------------------------------------------------------------
    template
        .command("plan")
        .description("計画 Issue テンプレートを出力")
        .addOption(new Option("--level <level>", "計画レベル (light|standard|detailed|epic)").choices(["light", "standard", "detailed", "epic"]).default("standard"))
        .option("--output <file>", "出力ファイルパス")
        .addOption(langOption())
        .action(async (localOpts) => {
        const { generatePlanTemplate } = await import("./plan.js");
        const result = generatePlanTemplate(localOpts.lang, localOpts.level);
        writeOutput(result, localOpts.output);
    });
    // ---------------------------------------------------------------------------
    // pr
    // ---------------------------------------------------------------------------
    template
        .command("pr")
        .description("PR 本文テンプレートを出力")
        .option("--output <file>", "出力ファイルパス")
        .addOption(langOption())
        .action(async (localOpts) => {
        const { generatePrTemplate } = await import("./pr.js");
        const result = generatePrTemplate(localOpts.lang);
        writeOutput(result, localOpts.output);
    });
    // ---------------------------------------------------------------------------
    // adr
    // ---------------------------------------------------------------------------
    template
        .command("adr")
        .description("ADR Discussion テンプレートを出力")
        .option("--output <file>", "出力ファイルパス")
        .addOption(langOption())
        .action(async (localOpts) => {
        const { generateAdrTemplate } = await import("./adr.js");
        const result = generateAdrTemplate(localOpts.lang);
        writeOutput(result, localOpts.output);
    });
    // ---------------------------------------------------------------------------
    // comment
    // ---------------------------------------------------------------------------
    template
        .command("comment")
        .description("コメントテンプレートを出力")
        .addOption(new Option("--type <type>", "コメントタイプ (review-report|review-response|completion-report|handover)").choices(["review-report", "review-response", "completion-report", "handover"]).default("completion-report"))
        .option("--output <file>", "出力ファイルパス")
        .addOption(langOption())
        .action(async (localOpts) => {
        const { generateCommentTemplate } = await import("./comment.js");
        const result = generateCommentTemplate(localOpts.lang, localOpts.type);
        writeOutput(result, localOpts.output);
    });
    return template;
}
//# sourceMappingURL=index.js.map