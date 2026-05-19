/**
 * CLI i18n utility - Load messages from dictionary files
 *
 * Locale resolution order:
 * 1. Explicit locale (from --locale flag)
 * 2. Config file (shirokuma-docs.config.yaml locale field)
 * 3. Environment variable (SHIROKUMA_LOCALE or LANG)
 * 4. Default: "ja"
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/** Loaded dictionaries cache */
const cache = new Map();
/** Current locale (set once at startup) */
let currentLocale = "ja";
/** Whether locale was explicitly set via CLI flag (takes priority over config) */
let explicitlySet = false;
/**
 * Resolve locale from environment
 */
function resolveLocaleFromEnv() {
    const envLocale = process.env.SHIROKUMA_LOCALE;
    if (envLocale && isValidLocale(envLocale))
        return envLocale;
    const lang = process.env.LANG;
    if (lang?.startsWith("ja"))
        return "ja";
    return undefined;
}
/**
 * Check if a string is a valid locale
 */
function isValidLocale(value) {
    return value === "en" || value === "ja";
}
/**
 * Initialize i18n with a specific locale.
 * Call once at CLI startup.
 */
export function initI18n(locale) {
    if (locale && isValidLocale(locale)) {
        currentLocale = locale;
        explicitlySet = true;
    }
    else {
        currentLocale = resolveLocaleFromEnv() ?? "ja";
        explicitlySet = false;
    }
}
/**
 * Set locale from config (called after config is loaded).
 * Only applies if no explicit locale was set via CLI flag or env variable.
 */
export function setLocaleFromConfig(configLocale) {
    if (explicitlySet)
        return;
    if (configLocale && isValidLocale(configLocale)) {
        currentLocale = configLocale;
    }
}
/**
 * Get the current locale
 */
export function getLocale() {
    return currentLocale;
}
/**
 * Load dictionary for a locale
 */
function loadDict(locale) {
    const cached = cache.get(locale);
    if (cached)
        return cached;
    const dictPath = resolve(__dirname, "..", "..", "i18n", "cli", `${locale}.json`);
    try {
        const content = readFileSync(dictPath, "utf-8");
        const dict = JSON.parse(content);
        cache.set(locale, dict);
        return dict;
    }
    catch {
        // Fallback to empty dict if file not found
        const empty = {};
        cache.set(locale, empty);
        return empty;
    }
}
/**
 * Get a nested value from a dictionary using dot notation
 */
function getNestedValue(dict, key) {
    const parts = key.split(".");
    let current = dict;
    for (const part of parts) {
        if (typeof current !== "object" || current === null)
            return undefined;
        current = current[part];
        if (current === undefined)
            return undefined;
    }
    return typeof current === "string" ? current : undefined;
}
/**
 * Interpolate parameters into a message string.
 * Replaces {key} with the corresponding value.
 */
function interpolate(message, params) {
    if (!params)
        return message;
    return message.replace(/\{(\w+)\}/g, (match, key) => {
        const value = params[key];
        return value !== undefined ? String(value) : match;
    });
}
/**
 * Translate a message key.
 *
 * @param key - Dot-notated key (e.g., "commands.init.success")
 * @param params - Optional interpolation parameters
 * @returns Translated string, or the key itself if not found
 *
 * @example
 * ```ts
 * t("commands.init.success", { path: "/path/to/config" })
 * // => "Configuration file created: /path/to/config"
 * ```
 */
export function t(key, params) {
    const dict = loadDict(currentLocale);
    const message = getNestedValue(dict, key);
    if (message) {
        return interpolate(message, params);
    }
    // Fallback to English if current locale doesn't have the key
    if (currentLocale !== "en") {
        const enDict = loadDict("en");
        const enMessage = getNestedValue(enDict, key);
        if (enMessage) {
            return interpolate(enMessage, params);
        }
    }
    // Return key as-is if no translation found
    return key;
}
//# sourceMappingURL=i18n.js.map