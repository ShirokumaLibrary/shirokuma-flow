/**
 * アノテーション整合性検証ロジック
 *
 * コードアノテーション（@usedComponents, @screen, @component等）の
 * 整合性を検証するユーティリティ関数群
 *
 * @module lint/annotation-lint
 */

import { minimatch } from "minimatch";
import type {
  UsedComponentsResult,
  AnnotationCheckResult,
  AnnotationIssue,
  ExtractImportsOptions,
  AnnotationCheckOptions,
} from "./annotation-types.js";

// Re-export types for external use
export type { UsedComponentsResult, AnnotationCheckResult };

/**
 * 修正結果の型
 */
export interface FixResult {
  /** ファイル内容が変更されたか */
  changed: boolean;
  /** 修正後のファイル内容 */
  content: string;
}

/**
 * 複数修正結果の型
 */
export interface ApplyFixesResult extends FixResult {
  /** 適用された変更のリスト */
  changes: string[];
}

/**
 * 修正オプション
 */
export interface FixOptions {
  /** @usedComponents を修正するか */
  fixUsedComponents?: boolean;
  /** @screen を修正するか */
  fixScreen?: boolean;
  /** @route を修正するか */
  fixRoute?: boolean;
}

/**
 * JSDoc から @usedComponents アノテーションを抽出
 *
 * @param content - ファイル内容
 * @returns コンポーネント名の配列
 *
 * @example
 * ```typescript
 * const components = extractUsedComponentsAnnotation(`
 *   /**
 *    * @usedComponents Button, Card, Dialog
 *    *\/
 *   export function MyComponent() {}
 * `);
 * // Returns: ["Button", "Card", "Dialog"]
 * ```
 */
export function extractUsedComponentsAnnotation(content: string): string[] {
  // JSDocブロックを探す
  const jsdocPattern = /\/\*\*[\s\S]*?\*\//g;
  const jsdocMatches = content.match(jsdocPattern);

  if (!jsdocMatches) {
    return [];
  }

  for (const jsdoc of jsdocMatches) {
    // @usedComponents タグを探す
    // 複数行対応: @usedComponents の後の値を、次の @ または */ まで取得
    const usedComponentsMatch = jsdoc.match(
      /@usedComponents\s+([^@]*?)(?=\s*(?:@|\*\/))/s
    );

    if (usedComponentsMatch) {
      const rawValue = usedComponentsMatch[1];

      // クリーンアップ: * や改行を除去し、カンマで分割
      const cleaned = rawValue
        .replace(/\*/g, "")
        .replace(/\n/g, " ")
        .trim();

      // カンマで分割し、トリム
      const components = cleaned
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      return components;
    }
  }

  return [];
}

/**
 * import文からコンポーネント名を抽出
 *
 * components ディレクトリからのインポートのみを対象とする
 *
 * @param content - ファイル内容
 * @param options - 抽出オプション
 * @returns コンポーネント名の配列
 *
 * @example
 * ```typescript
 * const components = extractComponentsFromImports(`
 *   import { Button, Card } from "@/components/ui/button";
 * `, { excludeHooks: true });
 * // Returns: ["Button", "Card"]
 * ```
 */
export function extractComponentsFromImports(
  content: string,
  options: ExtractImportsOptions = {}
): string[] {
  const { excludeHooks = false } = options;
  const components: string[] = [];

  // Named imports from components directory
  // Matches: import { A, B } from "@/components/...", "../components/...", "./components/..."
  const namedImportPattern =
    /import\s*\{([^}]+)\}\s*from\s*["'](?:@\/|\.\.\/|\.\/)?components\/[^"']+["']/g;

  let match;
  while ((match = namedImportPattern.exec(content)) !== null) {
    const imports = match[1];
    const names = imports.split(",").map((s) => s.trim());

    for (const name of names) {
      // Handle "A as B" syntax - take original name (A)
      const actualName = name.split(/\s+as\s+/)[0].trim();

      // Skip empty names
      if (!actualName) continue;

      // Skip hooks if excludeHooks is true
      if (excludeHooks && actualName.startsWith("use")) {
        continue;
      }

      // Only include PascalCase names (components start with uppercase)
      if (/^[A-Z]/.test(actualName)) {
        components.push(actualName);
      }
    }
  }

  // Default imports from components directory
  // Matches: import A from "@/components/...", "../components/...", "./components/..."
  const defaultImportPattern =
    /import\s+([A-Z][a-zA-Z0-9]*)\s+from\s*["'](?:@\/|\.\.\/|\.\/)?components\/[^"']+["']/g;

  while ((match = defaultImportPattern.exec(content)) !== null) {
    const name = match[1];
    if (name && /^[A-Z]/.test(name)) {
      components.push(name);
    }
  }

  // Remove duplicates
  return [...new Set(components)];
}

/**
 * @usedComponents アノテーションとインポートを比較
 *
 * @param annotated - アノテーションに記載されたコンポーネント
 * @param imported - インポートされているコンポーネント
 * @returns 比較結果
 *
 * @example
 * ```typescript
 * const result = compareUsedComponents(
 *   ["Button", "Card"],
 *   ["Button", "Card", "Dialog"]
 * );
 * // result.missing: ["Dialog"]
 * // result.extra: []
 * // result.valid: false
 * ```
 */
export function compareUsedComponents(
  annotated: string[],
  imported: string[]
): UsedComponentsResult {
  const annotatedSet = new Set(annotated);
  const importedSet = new Set(imported);

  // Missing: imported but not annotated
  const missing = imported.filter((c) => !annotatedSet.has(c));

  // Extra: annotated but not imported
  const extra = annotated.filter((c) => !importedSet.has(c));

  return {
    valid: missing.length === 0 && extra.length === 0,
    annotated,
    imported,
    missing,
    extra,
  };
}

/**
 * パスがパターンに一致するか確認
 */
function matchesPattern(filePath: string, patterns: string[]): boolean {
  return patterns.some((pattern) => minimatch(filePath, pattern));
}

/**
 * @screen アノテーションの存在をチェック
 *
 * page.tsx ファイルに @screen アノテーションがあるか確認
 *
 * @param content - ファイル内容
 * @param filePath - ファイルパス
 * @param options - チェックオプション
 * @returns チェック結果
 *
 * @example
 * ```typescript
 * const result = checkScreenAnnotation(
 *   content,
 *   "app/[locale]/dashboard/page.tsx",
 *   { exclude: ["*\/not-found.tsx"] }
 * );
 * ```
 */
export function checkScreenAnnotation(
  content: string,
  filePath: string,
  options: AnnotationCheckOptions = {}
): AnnotationCheckResult {
  const { exclude = [] } = options;
  const errors: AnnotationIssue[] = [];
  const warnings: AnnotationIssue[] = [];
  const infos: AnnotationIssue[] = [];

  // Check if file should be excluded
  if (matchesPattern(filePath, exclude)) {
    return {
      valid: true,
      skipped: true,
      errors: [],
      warnings: [],
      infos: [],
    };
  }

  // Check for @screen annotation
  // Support screen names with parentheses like "(dashboard)SettingsScreen"
  const hasScreenAnnotation = /@screen\s+\S+/.test(content);

  if (!hasScreenAnnotation) {
    const issue: AnnotationIssue = {
      type: "warning",
      message: `Missing @screen annotation in page file`,
      file: filePath,
      rule: "screen-required",
      annotation: "@screen",
    };
    warnings.push(issue);
  }

  return {
    valid: warnings.length === 0 && errors.length === 0,
    skipped: false,
    errors,
    warnings,
    infos,
  };
}

/**
 * @component アノテーションの存在をチェック
 *
 * コンポーネントファイルに @component アノテーションがあるか確認
 *
 * @param content - ファイル内容
 * @param filePath - ファイルパス
 * @param options - チェックオプション
 * @returns チェック結果
 *
 * @example
 * ```typescript
 * const result = checkComponentAnnotation(
 *   content,
 *   "components/project-list.tsx",
 *   { exclude: ["*\/ui\/**"] }
 * );
 * ```
 */
export function checkComponentAnnotation(
  content: string,
  filePath: string,
  options: AnnotationCheckOptions = {}
): AnnotationCheckResult {
  const { exclude = [] } = options;
  const errors: AnnotationIssue[] = [];
  const warnings: AnnotationIssue[] = [];
  const infos: AnnotationIssue[] = [];

  // Check if file should be excluded
  if (matchesPattern(filePath, exclude)) {
    return {
      valid: true,
      skipped: true,
      errors: [],
      warnings: [],
      infos: [],
    };
  }

  // Check for @component annotation
  const hasComponentAnnotation = /@component\s+\w+/.test(content);

  if (!hasComponentAnnotation) {
    const issue: AnnotationIssue = {
      type: "info",
      message: `Missing @component annotation in component file`,
      file: filePath,
      rule: "component-required",
      annotation: "@component",
    };
    // For component, we use info level
    infos.push(issue);
  }

  return {
    // info is not a blocking issue, so valid is true if only infos
    valid: errors.length === 0 && warnings.length === 0,
    skipped: false,
    errors,
    warnings,
    infos,
  };
}

// ============================================
// Fix Functions for --fix option
// ============================================

/**
 * ファイルパスからスクリーン名を生成
 *
 * @param filePath - ファイルパス
 * @returns スクリーン名 (PascalCase + "Screen")
 *
 * @example
 * ```typescript
 * generateScreenName("app/[locale]/dashboard/page.tsx")
 * // Returns: "DashboardScreen"
 *
 * generateScreenName("app/[locale]/settings/profile/page.tsx")
 * // Returns: "SettingsProfileScreen"
 * ```
 */
export function generateScreenName(filePath: string): string {
  // ファイルパスからルート部分を抽出
  // app/[locale]/dashboard/page.tsx -> dashboard
  // apps/web/app/[locale]/posts/[id]/page.tsx -> posts/[id]
  const parts = filePath.split("/");

  // app ディレクトリ以降を取得
  const appIndex = parts.findIndex((p) => p === "app");
  if (appIndex === -1) {
    return "UnknownScreen";
  }

  // app と page.tsx の間のパーツを取得
  const routeParts = parts.slice(appIndex + 1, -1); // 最後の page.tsx を除く

  // [locale] とルートグループ (xxx) を除外
  const meaningfulParts = routeParts.filter(
    (p) => p !== "[locale]" && !p.startsWith("(")
  );

  if (meaningfulParts.length === 0) {
    return "HomeScreen";
  }

  // PascalCase に変換
  const screenName = meaningfulParts
    .map((part) => {
      // 動的セグメント [id] -> Id
      if (part.startsWith("[") && part.endsWith("]")) {
        const inner = part.slice(1, -1);
        return inner.charAt(0).toUpperCase() + inner.slice(1);
      }
      // kebab-case -> PascalCase
      return part
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("");
    })
    .join("");

  return `${screenName}Screen`;
}

/**
 * ファイルパスからルートを生成
 *
 * @param filePath - ファイルパス
 * @returns ルートパス
 *
 * @example
 * ```typescript
 * generateRoute("app/[locale]/posts/page.tsx")
 * // Returns: "/posts"
 *
 * generateRoute("app/[locale]/posts/[id]/page.tsx")
 * // Returns: "/posts/[id]"
 * ```
 */
export function generateRoute(filePath: string): string {
  const parts = filePath.split("/");

  // app ディレクトリ以降を取得
  const appIndex = parts.findIndex((p) => p === "app");
  if (appIndex === -1) {
    return "/";
  }

  // app と page.tsx の間のパーツを取得
  const routeParts = parts.slice(appIndex + 1, -1);

  // [locale] とグループ (xxx) を除外
  const meaningfulParts = routeParts.filter(
    (p) => p !== "[locale]" && !p.startsWith("(")
  );

  if (meaningfulParts.length === 0) {
    return "/";
  }

  return "/" + meaningfulParts.join("/");
}

/**
 * JSDocコメントブロックを検出
 */
function findFirstJSDoc(content: string): { start: number; end: number; text: string } | null {
  const jsdocPattern = /\/\*\*[\s\S]*?\*\//;
  const match = content.match(jsdocPattern);

  if (!match || match.index === undefined) {
    return null;
  }

  return {
    start: match.index,
    end: match.index + match[0].length,
    text: match[0],
  };
}

/**
 * JSDocにタグを追加または更新
 */
function addOrUpdateJSDocTag(
  jsdocText: string,
  tag: string,
  value: string
): string {
  // 既存のタグを検索
  const tagPattern = new RegExp(`@${tag}\\s+[^@\\n]*`, "g");

  if (tagPattern.test(jsdocText)) {
    // .test() が lastIndex を進めるためリセット
    tagPattern.lastIndex = 0;
    // 既存のタグを更新
    return jsdocText.replace(tagPattern, `@${tag} ${value}`);
  }

  // 閉じる */ の前に新しいタグを追加
  return jsdocText.replace(/\s*\*\/\s*$/, `\n * @${tag} ${value}\n */`);
}

/**
 * 新しいJSDocブロックを作成
 */
function createJSDoc(tags: { tag: string; value: string }[]): string {
  const lines = ["/**"];
  for (const { tag, value } of tags) {
    lines.push(` * @${tag} ${value}`);
  }
  lines.push(" */");
  return lines.join("\n");
}

/**
 * @usedComponents アノテーションを自動修正
 *
 * @param content - ファイル内容
 * @param filePath - ファイルパス (未使用だが将来の拡張用)
 * @returns 修正結果
 */
export function fixUsedComponentsAnnotation(
  content: string,
  _filePath: string
): FixResult {
  // インポートからコンポーネントを抽出
  const components = extractComponentsFromImports(content, {
    excludeHooks: true,
  });

  // コンポーネントがなければ変更なし
  if (components.length === 0) {
    return { changed: false, content };
  }

  const componentsList = components.join(", ");
  const existingAnnotation = extractUsedComponentsAnnotation(content);

  // 既存のアノテーションと同じなら変更なし
  if (
    existingAnnotation.length === components.length &&
    existingAnnotation.every((c) => components.includes(c))
  ) {
    return { changed: false, content };
  }

  // JSDocを探す
  const jsdoc = findFirstJSDoc(content);

  if (jsdoc) {
    // 既存のJSDocにタグを追加/更新
    const updatedJSDoc = addOrUpdateJSDocTag(
      jsdoc.text,
      "usedComponents",
      componentsList
    );
    const newContent =
      content.slice(0, jsdoc.start) +
      updatedJSDoc +
      content.slice(jsdoc.end);
    return { changed: true, content: newContent };
  }

  // JSDocがない場合、ファイル先頭に新規作成
  const newJSDoc = createJSDoc([
    { tag: "usedComponents", value: componentsList },
  ]);
  return { changed: true, content: newJSDoc + "\n" + content };
}

/**
 * @screen アノテーションを自動修正
 *
 * @param content - ファイル内容
 * @param filePath - ファイルパス
 * @returns 修正結果
 */
export function fixScreenAnnotation(
  content: string,
  filePath: string
): FixResult {
  // 既存の @screen があれば変更なし
  if (/@screen\s+\S+/.test(content)) {
    return { changed: false, content };
  }

  const screenName = generateScreenName(filePath);
  const jsdoc = findFirstJSDoc(content);

  if (jsdoc) {
    const updatedJSDoc = addOrUpdateJSDocTag(jsdoc.text, "screen", screenName);
    const newContent =
      content.slice(0, jsdoc.start) +
      updatedJSDoc +
      content.slice(jsdoc.end);
    return { changed: true, content: newContent };
  }

  const newJSDoc = createJSDoc([{ tag: "screen", value: screenName }]);
  return { changed: true, content: newJSDoc + "\n" + content };
}

/**
 * @route アノテーションを自動修正
 *
 * @param content - ファイル内容
 * @param filePath - ファイルパス
 * @returns 修正結果
 */
export function fixRouteAnnotation(
  content: string,
  filePath: string
): FixResult {
  // 既存の @route があれば変更なし
  if (/@route\s+\//.test(content)) {
    return { changed: false, content };
  }

  const route = generateRoute(filePath);
  const jsdoc = findFirstJSDoc(content);

  if (jsdoc) {
    const updatedJSDoc = addOrUpdateJSDocTag(jsdoc.text, "route", route);
    const newContent =
      content.slice(0, jsdoc.start) +
      updatedJSDoc +
      content.slice(jsdoc.end);
    return { changed: true, content: newContent };
  }

  const newJSDoc = createJSDoc([{ tag: "route", value: route }]);
  return { changed: true, content: newJSDoc + "\n" + content };
}

/**
 * 複数の修正を一度に適用
 *
 * @param content - ファイル内容
 * @param filePath - ファイルパス
 * @param options - 修正オプション
 * @returns 修正結果
 */
export function applyFixes(
  content: string,
  filePath: string,
  options: FixOptions
): ApplyFixesResult {
  let currentContent = content;
  const changes: string[] = [];

  // @usedComponents の修正
  if (options.fixUsedComponents) {
    const result = fixUsedComponentsAnnotation(currentContent, filePath);
    if (result.changed) {
      currentContent = result.content;
      changes.push("@usedComponents");
    }
  }

  // @screen の修正
  if (options.fixScreen) {
    const result = fixScreenAnnotation(currentContent, filePath);
    if (result.changed) {
      currentContent = result.content;
      changes.push("@screen");
    }
  }

  // @route の修正
  if (options.fixRoute) {
    const result = fixRouteAnnotation(currentContent, filePath);
    if (result.changed) {
      currentContent = result.content;
      changes.push("@route");
    }
  }

  return {
    changed: changes.length > 0,
    content: currentContent,
    changes,
  };
}
