/**
 * CLI i18n utility - Load messages from dictionary files
 *
 * Locale resolution order:
 * 1. Explicit locale (from --locale flag)
 * 2. Config file (shirokuma-docs.config.yaml locale field)
 * 3. Environment variable (SHIROKUMA_LOCALE or LANG)
 * 4. Default: "ja"
 */
export type Locale = "en" | "ja";
export type MessageParams = Record<string, string | number>;
/**
 * Initialize i18n with a specific locale.
 * Call once at CLI startup.
 */
export declare function initI18n(locale?: string): void;
/**
 * Set locale from config (called after config is loaded).
 * Only applies if no explicit locale was set via CLI flag or env variable.
 */
export declare function setLocaleFromConfig(configLocale?: string): void;
/**
 * Get the current locale
 */
export declare function getLocale(): Locale;
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
export declare function t(key: string, params?: MessageParams): string;
//# sourceMappingURL=i18n.d.ts.map