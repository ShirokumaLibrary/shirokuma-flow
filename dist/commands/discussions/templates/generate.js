import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import Handlebars from "handlebars";
// =============================================================================
// Constants
// =============================================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Templates and i18n are in the package root
const PACKAGE_ROOT = join(__dirname, "..", "..", "..", "..");
const TEMPLATES_DIR = join(PACKAGE_ROOT, "templates", "discussion");
const I18N_DIR = join(PACKAGE_ROOT, "i18n", "discussion");
const TEMPLATE_FILES = ["handovers", "adr", "knowledge", "research", "reports"];
// =============================================================================
// Helper Functions
// =============================================================================
function getNestedValue(obj, path) {
    const keys = path.split(".");
    let current = obj;
    for (const key of keys) {
        if (typeof current !== "object" || current === null) {
            return path;
        }
        current = current[key];
    }
    if (typeof current === "string") {
        return current;
    }
    return path;
}
function indentMultiline(text, spaces) {
    const indent = " ".repeat(spaces);
    const lines = text.split("\n");
    return lines.map((line, index) => (index === 0 ? line : indent + line)).join("\n");
}
function loadDictionary(lang) {
    const dictPath = join(I18N_DIR, `${lang}.json`);
    if (!existsSync(dictPath)) {
        return null;
    }
    try {
        const content = readFileSync(dictPath, "utf-8");
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
export function getAvailableLanguages() {
    if (!existsSync(I18N_DIR)) {
        return [];
    }
    try {
        const files = readdirSync(I18N_DIR);
        return files
            .filter((f) => f.endsWith(".json"))
            .map((f) => f.replace(".json", ""));
    }
    catch {
        return [];
    }
}
function renderTemplate(templateName, dictionary) {
    const templatePath = join(TEMPLATES_DIR, `${templateName}.yml.hbs`);
    if (!existsSync(templatePath)) {
        return null;
    }
    try {
        const templateContent = readFileSync(templatePath, "utf-8");
        const handlebars = Handlebars.create();
        handlebars.registerHelper("t", (key) => {
            return getNestedValue(dictionary, key);
        });
        handlebars.registerHelper("ti", (key, spaces) => {
            const value = getNestedValue(dictionary, key);
            return indentMultiline(value, spaces);
        });
        const template = handlebars.compile(templateContent, { noEscape: true });
        return template({});
    }
    catch {
        return null;
    }
}
export function cmdGenerate(options, logger) {
    const lang = options.lang ?? "en";
    const outputDir = options.output ?? ".github/DISCUSSION_TEMPLATE";
    if (!existsSync(TEMPLATES_DIR)) {
        logger.error(`Templates directory not found: ${TEMPLATES_DIR}`);
        return 1;
    }
    const dictionary = loadDictionary(lang);
    if (!dictionary) {
        logger.error(`Language '${lang}' not found`);
        const available = getAvailableLanguages();
        if (available.length > 0) {
            logger.info(`Available languages: ${available.join(", ")}`);
        }
        return 1;
    }
    if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
        logger.debug(`Created directory: ${outputDir}`);
    }
    const generated = [];
    const errors = [];
    for (const templateName of TEMPLATE_FILES) {
        const rendered = renderTemplate(templateName, dictionary);
        if (rendered === null) {
            errors.push(templateName);
            logger.warn(`Failed to render template: ${templateName}`);
            continue;
        }
        const outputPath = join(outputDir, `${templateName}.yml`);
        writeFileSync(outputPath, rendered, "utf-8");
        generated.push(templateName);
        logger.debug(`Generated: ${outputPath}`);
    }
    if (errors.length > 0) {
        logger.warn(`Failed to generate ${errors.length} template(s): ${errors.join(", ")}`);
    }
    if (generated.length > 0) {
        logger.success(`Generated ${generated.length} template(s) in ${outputDir}`);
    }
    const output = {
        language: lang,
        output_directory: outputDir,
        generated: generated,
        errors: errors.length > 0 ? errors : undefined,
    };
    console.log(JSON.stringify(output, null, 2));
    return errors.length > 0 && generated.length === 0 ? 1 : 0;
}
export function cmdListLanguages(_options, logger) {
    const languages = getAvailableLanguages();
    if (languages.length === 0) {
        logger.warn("No languages found");
        return 0;
    }
    const output = {
        languages: languages,
        total_count: languages.length,
    };
    console.log(JSON.stringify(output, null, 2));
    return 0;
}
export function cmdAddLanguage(langCode, _options, logger) {
    const existing = getAvailableLanguages();
    if (existing.includes(langCode)) {
        logger.error(`Language '${langCode}' already exists`);
        return 1;
    }
    const baseDictionary = loadDictionary("en");
    if (!baseDictionary) {
        logger.error("Base language (en) not found. Cannot create new language.");
        return 1;
    }
    if (!existsSync(I18N_DIR)) {
        mkdirSync(I18N_DIR, { recursive: true });
    }
    const newDictPath = join(I18N_DIR, `${langCode}.json`);
    writeFileSync(newDictPath, JSON.stringify(baseDictionary, null, 2), "utf-8");
    logger.success(`Created language file: ${newDictPath}`);
    logger.info("Edit the file to add translations for the new language.");
    const output = {
        language: langCode,
        file: newDictPath,
        status: "created",
    };
    console.log(JSON.stringify(output, null, 2));
    return 0;
}
//# sourceMappingURL=generate.js.map