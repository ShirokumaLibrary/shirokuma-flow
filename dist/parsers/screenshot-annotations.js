/**
 * Screenshot Annotations Parser
 *
 * Parses @screenshot annotations from page.tsx files to identify
 * pages that should be included in screenshot generation.
 *
 * Supported annotations:
 * - @screenshot           - Marks page for screenshot (required)
 * - @screenshot-viewport  - Custom viewport size (e.g., "1920x1080")
 * - @screenshot-auth      - Auth requirement: "required" | "none" | "optional"
 * - @screenshot-waitFor   - Wait condition: "networkidle" | "domcontentloaded" | "load"
 * - @screenshot-delay     - Delay in ms after page load
 * - @screenshotWaitFor    - CSS selector(s) to wait for before screenshot (multiple allowed)
 * - @screenshotAccount    - Account name(s) for multi-account screenshots (comma-separated)
 *
 * @module parsers/screenshot-annotations
 */
import { inferScreenNameFromPath } from "../utils/route-inference.js";
/**
 * Parse screenshot annotations from file content.
 *
 * Searches for JSDoc blocks containing @screenshot and extracts
 * all related annotation values.
 *
 * @param content - File content to parse
 * @param filePath - File path for reference and screen name inference
 * @returns ScreenshotAnnotation if @screenshot found, null otherwise
 *
 * @example
 * ```typescript
 * const content = `
 * /**
 *  * Dashboard Page
 *  * @screen DashboardScreen
 *  * @screenshot
 *  * @screenshot-viewport 1280x720
 *  * /
 * export default function Page() {}
 * `;
 * const result = parseScreenshotAnnotations(content, "apps/web/app/page.tsx");
 * // Returns: { name: "DashboardScreen", enabled: true, viewport: { width: 1280, height: 720 }, ... }
 * ```
 */
export function parseScreenshotAnnotations(content, filePath) {
    // Find JSDoc blocks containing @screenshot
    const jsdocRegex = /\/\*\*[\s\S]*?\*\//g;
    const matches = content.matchAll(jsdocRegex);
    for (const match of matches) {
        const jsdocBlock = match[0];
        // Check if this block contains @screenshot
        if (!jsdocBlock.includes("@screenshot")) {
            continue;
        }
        // Check for standalone @screenshot (not @screenshot-*)
        if (!/@screenshot(?!\s*-)/m.test(jsdocBlock)) {
            continue;
        }
        // Extract tags
        const { single: tags, multi: multiTags } = extractTags(jsdocBlock);
        // Get screen name from @screen or infer from file path
        const name = tags.screen || inferScreenNameFromPath(filePath);
        // Build annotation object
        const annotation = {
            name,
            filePath,
            enabled: true,
        };
        // Parse @screenshot-viewport (format: WIDTHxHEIGHT)
        if (tags["screenshot-viewport"]) {
            const viewportMatch = tags["screenshot-viewport"].match(/^(\d+)x(\d+)$/);
            if (viewportMatch) {
                annotation.viewport = {
                    width: parseInt(viewportMatch[1], 10),
                    height: parseInt(viewportMatch[2], 10),
                };
            }
        }
        // Parse @screenshot-auth
        if (tags["screenshot-auth"]) {
            const authValue = tags["screenshot-auth"];
            if (authValue === "required" || authValue === "none" || authValue === "optional") {
                annotation.auth = authValue;
            }
        }
        // Parse @screenshot-waitFor (page load condition)
        if (tags["screenshot-waitFor"]) {
            annotation.waitFor = tags["screenshot-waitFor"];
        }
        // Parse @screenshotWaitFor (CSS selectors to wait for - multiple allowed)
        if (multiTags["screenshotWaitFor"] && multiTags["screenshotWaitFor"].length > 0) {
            annotation.waitForSelectors = multiTags["screenshotWaitFor"];
        }
        // Parse @screenshotAccount (comma-separated account names)
        if (tags["screenshotAccount"]) {
            const accountsValue = tags["screenshotAccount"];
            const accounts = accountsValue
                .split(",")
                .map((a) => a.trim())
                .filter((a) => a.length > 0);
            if (accounts.length > 0) {
                annotation.accounts = accounts;
            }
        }
        // Parse @screenshot-delay
        if (tags["screenshot-delay"]) {
            const delay = parseInt(tags["screenshot-delay"], 10);
            if (!isNaN(delay)) {
                annotation.delay = delay;
            }
        }
        // Extract description
        const description = extractDescription(jsdocBlock);
        if (description) {
            annotation.description = description;
        }
        // Extract @route
        if (tags.route) {
            annotation.route = tags.route;
        }
        return annotation;
    }
    return null;
}
/**
 * Scan multiple files for screenshot annotations.
 *
 * Convenience function to process multiple files and collect
 * all screenshot annotations.
 *
 * @param files - Array of file objects with content and path
 * @returns Array of ScreenshotAnnotation from files with @screenshot
 *
 * @example
 * ```typescript
 * const files = [
 *   { path: "apps/web/app/page.tsx", content: "..." },
 *   { path: "apps/web/app/about/page.tsx", content: "..." },
 * ];
 * const annotations = scanFilesForScreenshots(files);
 * ```
 */
export function scanFilesForScreenshots(files) {
    const results = [];
    for (const file of files) {
        const annotation = parseScreenshotAnnotations(file.content, file.path);
        if (annotation) {
            results.push(annotation);
        }
    }
    return results;
}
/**
 * Extract JSDoc tags from a JSDoc block.
 *
 * @param jsdocBlock - JSDoc comment block
 * @returns Object containing single-value tags and array-value tags
 */
function extractTags(jsdocBlock) {
    const single = {};
    const multi = {};
    const lines = jsdocBlock.split("\n");
    for (const line of lines) {
        // Match @tag value pattern
        const tagMatch = line.match(/@([\w-]+)(?:\s+(.+?))?(?:\s*\*\/|\s*$)/);
        if (tagMatch) {
            const [, tag, value] = tagMatch;
            // Handle standalone @screenshot marker
            if (tag === "screenshot" && !value) {
                single[tag] = "";
            }
            else if (value) {
                // Tags that support multiple values
                if (tag === "screenshotWaitFor") {
                    if (!multi[tag]) {
                        multi[tag] = [];
                    }
                    multi[tag].push(value.trim());
                }
                else {
                    single[tag] = value.trim();
                }
            }
        }
    }
    return { single, multi };
}
/**
 * Extract description from JSDoc block (non-tag lines).
 *
 * Preserves paragraph structure by keeping empty lines between text blocks.
 *
 * @param jsdocBlock - JSDoc comment block
 * @returns Description text or undefined
 */
function extractDescription(jsdocBlock) {
    const lines = jsdocBlock.split("\n");
    const descLines = [];
    let foundContent = false;
    for (const line of lines) {
        // Remove JSDoc prefix (* )
        const trimmed = line.replace(/^\s*\*\s?/, "").trim();
        // Skip JSDoc start/end
        if (trimmed.startsWith("/**") || trimmed.startsWith("*/") || trimmed === "/") {
            continue;
        }
        // Stop at first tag
        if (trimmed.startsWith("@")) {
            break;
        }
        // Handle empty lines - keep them to preserve paragraph structure
        // but only after we've found some content
        if (trimmed === "") {
            if (foundContent) {
                descLines.push("");
            }
            continue;
        }
        foundContent = true;
        descLines.push(trimmed);
    }
    // Remove trailing empty lines
    while (descLines.length > 0 && descLines[descLines.length - 1] === "") {
        descLines.pop();
    }
    return descLines.length > 0 ? descLines.join("\n") : undefined;
}
//# sourceMappingURL=screenshot-annotations.js.map