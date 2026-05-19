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
/**
 * Screenshot annotation data extracted from page.tsx
 */
export interface ScreenshotAnnotation {
    /** Screen name (from @screen or inferred from file path) */
    name: string;
    /** File path where annotation was found */
    filePath: string;
    /** Whether screenshot is enabled */
    enabled: boolean;
    /** Optional viewport size */
    viewport?: {
        width: number;
        height: number;
    };
    /** Auth requirement */
    auth?: "required" | "none" | "optional";
    /** Wait condition (networkidle, domcontentloaded, load) */
    waitFor?: string;
    /** Delay in ms */
    delay?: number;
    /** Description from JSDoc */
    description?: string;
    /** Explicit route from @route annotation */
    route?: string;
    /** CSS selectors to wait for before taking screenshot */
    waitForSelectors?: string[];
    /** Account names to use for screenshot (for multi-account support) */
    accounts?: string[];
}
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
export declare function parseScreenshotAnnotations(content: string, filePath: string): ScreenshotAnnotation | null;
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
export declare function scanFilesForScreenshots(files: Array<{
    content: string;
    path: string;
}>): ScreenshotAnnotation[];
//# sourceMappingURL=screenshot-annotations.d.ts.map