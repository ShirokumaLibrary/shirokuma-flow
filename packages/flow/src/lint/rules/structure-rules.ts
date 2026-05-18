/**
 * 構造検証ルール
 *
 * プロジェクトのディレクトリ構造を検証するルール群
 *
 * @module lint/rules/structure-rules
 */

import { existsSync, readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "glob";
import type {
  StructureCheck,
  CheckStatus,
  Severity,
  StructureRuleId,
  LibNoRootFilesRuleConfig,
  LibHasIndexRuleConfig,
  NamingConventionRuleConfig,
  NoCrossAppImportRuleConfig,
  ComponentsDomainGroupingRuleConfig,
  LibStructureComplianceRuleConfig,
  BarrelExportRequiredRuleConfig,
  ActionsSeparationRuleConfig,
} from "../structure-types.js";
import { escapeRegExp } from "../../utils/sanitize.js";

/**
 * ステータスを重要度から決定
 */
function statusFromSeverity(severity: Severity, passed: boolean): CheckStatus {
  if (passed) return "pass";
  return severity;
}

/**
 * ディレクトリ必須ルール
 */
export function checkDirRequired(
  basePath: string,
  dirs: string[],
  severity: Severity
): StructureCheck[] {
  return dirs.map((dir) => {
    const fullPath = join(basePath, dir);
    const exists = existsSync(fullPath) && statSync(fullPath).isDirectory();

    return {
      rule: "dir-required" as StructureRuleId,
      target: dir + "/",
      status: statusFromSeverity(severity, exists),
      message: exists ? undefined : `必須ディレクトリ ${dir}/ がありません`,
      fix: exists ? undefined : `mkdir -p ${dir}`,
    };
  });
}

/**
 * ファイル必須ルール
 */
export function checkFileRequired(
  basePath: string,
  files: string[],
  severity: Severity
): StructureCheck[] {
  return files.map((file) => {
    const fullPath = join(basePath, file);
    const exists = existsSync(fullPath) && statSync(fullPath).isFile();

    return {
      rule: "file-required" as StructureRuleId,
      target: file,
      status: statusFromSeverity(severity, exists),
      message: exists ? undefined : `必須ファイル ${file} がありません`,
      fix: exists ? undefined : `ファイル ${file} を作成してください`,
    };
  });
}

/**
 * lib/ 直下ファイル禁止ルール
 */
export function checkLibNoRootFiles(
  basePath: string,
  config: LibNoRootFilesRuleConfig
): StructureCheck[] {
  if (!config.enabled) return [];

  const libPath = join(basePath, "lib");
  if (!existsSync(libPath)) return [];

  const rootFiles: string[] = [];

  try {
    const entries = readdirSync(libPath);
    for (const entry of entries) {
      const entryPath = join(libPath, entry);
      if (statSync(entryPath).isFile() && entry.endsWith(".ts")) {
        rootFiles.push(`lib/${entry}`);
      }
    }
  } catch {
    return [];
  }

  if (rootFiles.length === 0) {
    return [
      {
        rule: "lib-no-root-files",
        target: "lib/",
        status: "pass",
      },
    ];
  }

  return [
    {
      rule: "lib-no-root-files",
      target: "lib/",
      status: statusFromSeverity(config.severity, false),
      message: "lib/ 直下にファイルがあります",
      found: rootFiles,
      fix: "機能単位でディレクトリを作成し、ファイルを移動してください（例: lib/utils/）",
    },
  ];
}

/**
 * lib/ サブディレクトリに index.ts 必須ルール
 */
export function checkLibHasIndex(
  basePath: string,
  config: LibHasIndexRuleConfig
): StructureCheck[] {
  if (!config.enabled) return [];

  const libPath = join(basePath, "lib");
  if (!existsSync(libPath)) return [];

  const results: StructureCheck[] = [];

  try {
    const entries = readdirSync(libPath);
    for (const entry of entries) {
      const entryPath = join(libPath, entry);
      if (!statSync(entryPath).isDirectory()) continue;
      // actions は別構造なのでスキップ
      if (entry === "actions") continue;

      const indexPath = join(entryPath, "index.ts");
      const hasIndex = existsSync(indexPath);

      results.push({
        rule: "lib-has-index",
        target: `lib/${entry}/`,
        status: statusFromSeverity(config.severity, hasIndex),
        message: hasIndex
          ? undefined
          : `lib/${entry}/index.ts がありません`,
        fix: hasIndex
          ? undefined
          : `index.ts を作成し、公開APIをre-exportしてください`,
      });
    }
  } catch {
    return [];
  }

  return results;
}

/**
 * 推奨ディレクトリルール
 */
export function checkDirRecommended(
  basePath: string,
  dirs: string[],
  severity: Severity
): StructureCheck[] {
  return dirs.map((dir) => {
    const fullPath = join(basePath, dir);
    const exists = existsSync(fullPath) && statSync(fullPath).isDirectory();

    return {
      rule: "dir-recommended" as StructureRuleId,
      target: dir + "/",
      status: exists ? "pass" : statusFromSeverity(severity, false),
      message: exists ? undefined : `${dir}/ がありません（推奨）`,
    };
  });
}

/**
 * PascalCase チェック
 */
function isPascalCase(name: string): boolean {
  return /^[A-Z][a-zA-Z0-9]*$/.test(name);
}

/**
 * camelCase チェック
 */
function isCamelCase(name: string): boolean {
  return /^[a-z][a-zA-Z0-9]*$/.test(name);
}

/**
 * kebab-case チェック
 */
function isKebabCase(name: string): boolean {
  return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name);
}

/**
 * lowercase チェック
 */
function isLowercase(name: string): boolean {
  return /^[a-z][a-z0-9]*$/.test(name);
}

/**
 * 命名規則チェック
 */
export function checkNamingConvention(
  basePath: string,
  config: NamingConventionRuleConfig
): StructureCheck[] {
  if (!config.enabled) return [];

  const results: StructureCheck[] = [];
  const violations: Array<{ path: string; expected: string; actual?: string }> = [];

  // components/ 内のドメインディレクトリ
  const componentsPath = join(basePath, "components");
  if (existsSync(componentsPath)) {
    try {
      const entries = readdirSync(componentsPath);
      for (const entry of entries) {
        const entryPath = join(componentsPath, entry);
        if (!statSync(entryPath).isDirectory()) continue;
        // ui, layout, common はスキップ
        if (["ui", "layout", "common", "__tests__"].includes(entry)) continue;

        const expectedCase = config.rules?.domainDirs || "PascalCase";
        let isValid = false;

        switch (expectedCase) {
          case "PascalCase":
            isValid = isPascalCase(entry);
            break;
          case "camelCase":
            isValid = isCamelCase(entry);
            break;
          case "kebab-case":
            isValid = isKebabCase(entry);
            break;
        }

        if (!isValid) {
          violations.push({
            path: `components/${entry}/`,
            expected: expectedCase,
          });
        }
      }
    } catch {
      // ignore
    }
  }

  // app/ 内の Route Group
  const appPath = join(basePath, "app");
  if (existsSync(appPath)) {
    const routeGroups = globSync("**/(*)/*", { cwd: appPath });
    // Route Group はカッコ内が lowercase であるべき
    for (const group of routeGroups) {
      const match = group.match(/\(([^)]+)\)/);
      if (match) {
        const groupName = match[1];
        const expectedCase = config.rules?.routeGroups || "lowercase";

        if (expectedCase === "lowercase" && !isLowercase(groupName)) {
          violations.push({
            path: `app/${group}`,
            expected: "lowercase (例: (auth), (dashboard))",
          });
        }
      }
    }
  }

  if (violations.length === 0) {
    results.push({
      rule: "naming-convention",
      target: "components/, app/",
      status: "pass",
    });
  } else {
    results.push({
      rule: "naming-convention",
      target: "components/, app/",
      status: statusFromSeverity(config.severity, false),
      message: "命名規則に違反しているディレクトリがあります",
      violations,
      fix: "ディレクトリ名を規則に従ってリネームしてください",
    });
  }

  return results;
}

/**
 * Cross-app import 禁止ルール
 */
export function checkNoCrossAppImport(
  projectPath: string,
  appName: string,
  config: NoCrossAppImportRuleConfig
): StructureCheck[] {
  if (!config.enabled) return [];

  const appPath = join(projectPath, "apps", appName);
  if (!existsSync(appPath)) return [];

  const violations: Array<{ path: string; expected: string }> = [];

  // すべてのtsファイルを検索
  const tsFiles = globSync("**/*.ts", {
    cwd: appPath,
    ignore: ["node_modules/**", "**/*.d.ts", ".next/**"],
  });

  const tsxFiles = globSync("**/*.tsx", {
    cwd: appPath,
    ignore: ["node_modules/**", ".next/**"],
  });

  const allFiles = [...tsFiles, ...tsxFiles];

  // 他のアプリ名を取得
  const appsPath = join(projectPath, "apps");
  let otherApps: string[] = [];
  try {
    otherApps = readdirSync(appsPath).filter(
      (name) =>
        name !== appName &&
        statSync(join(appsPath, name)).isDirectory()
    );
  } catch {
    return [];
  }

  // 各ファイルをチェック
  for (const file of allFiles) {
    const filePath = join(appPath, file);
    try {
      const content = readFileSync(filePath, "utf-8");

      for (const otherApp of otherApps) {
        // @app名 または apps/app名 からのインポートを検出
        const escaped = escapeRegExp(otherApp);
        const patterns = [
          new RegExp(`from\\s+["']@${escaped}`, "g"),
          new RegExp(`from\\s+["'].*apps/${escaped}`, "g"),
          new RegExp(`from\\s+["']\\.\\./\\.\\./\\.\\./.*apps/${escaped}`, "g"),
        ];

        for (const pattern of patterns) {
          if (pattern.test(content)) {
            violations.push({
              path: file,
              expected: `@${otherApp} からのインポートを削除し、packages/shared/ に抽出してください`,
            });
            break;
          }
        }
      }
    } catch {
      // ファイル読み込みエラーは無視
    }
  }

  if (violations.length === 0) {
    return [
      {
        rule: "no-cross-app-import",
        target: `apps/${appName}`,
        status: "pass",
      },
    ];
  }

  return [
    {
      rule: "no-cross-app-import",
      target: `apps/${appName}`,
      status: statusFromSeverity(config.severity, false),
      message: "他のアプリからのインポートがあります",
      violations,
      fix: "共有コードを packages/shared/ に抽出し、@repo/shared からインポートしてください",
    },
  ];
}

/**
 * actions/ 構造チェック（crud/, domain/ パターン）
 */
export function checkActionsStructure(
  basePath: string,
  severity: Severity
): StructureCheck[] {
  const actionsPath = join(basePath, "lib", "actions");
  if (!existsSync(actionsPath)) return [];

  const results: StructureCheck[] = [];

  // crud/ と domain/ の存在確認
  const hasCrud = existsSync(join(actionsPath, "crud"));
  const hasDomain = existsSync(join(actionsPath, "domain"));

  if (hasCrud || hasDomain) {
    results.push({
      rule: "actions-structure" as StructureRuleId,
      target: "lib/actions/",
      status: "pass",
      message: hasCrud && hasDomain
        ? "crud/, domain/ パターンで構成されています"
        : hasCrud
          ? "crud/ パターンのみ"
          : "domain/ パターンのみ",
    });
  } else {
    // フラット構造かどうか確認
    try {
      const entries = readdirSync(actionsPath);
      const hasSubdirs = entries.some((entry) =>
        statSync(join(actionsPath, entry)).isDirectory()
      );

      if (!hasSubdirs) {
        results.push({
          rule: "actions-structure" as StructureRuleId,
          target: "lib/actions/",
          status: statusFromSeverity(severity, false),
          message: "lib/actions/ がフラット構造です",
          fix: "crud/, domain/ ディレクトリに分類することを推奨します",
        });
      }
    } catch {
      // ignore
    }
  }

  return results;
}

/**
 * components/ ドメイン別グループ化チェック
 *
 * components/ 直下にフラットなコンポーネントファイルがないかチェック。
 * ドメイン別のサブディレクトリ（例: Post/, Category/）に整理することを推奨。
 */
export function checkComponentsDomainGrouping(
  basePath: string,
  config: ComponentsDomainGroupingRuleConfig
): StructureCheck[] {
  if (!config.enabled) return [];

  const componentsPath = join(basePath, "components");
  if (!existsSync(componentsPath)) return [];

  const flatFiles: string[] = [];

  try {
    const entries = readdirSync(componentsPath);

    for (const entry of entries) {
      const entryPath = join(componentsPath, entry);
      const stat = statSync(entryPath);

      // ディレクトリはスキップ（システムディレクトリかドメインディレクトリ）
      if (stat.isDirectory()) continue;

      // .tsx ファイルのみ対象
      if (!entry.endsWith(".tsx")) continue;

      // index.ts/tsx はスキップ
      if (entry === "index.ts" || entry === "index.tsx") continue;

      flatFiles.push(`components/${entry}`);
    }
  } catch {
    return [];
  }

  if (flatFiles.length === 0) {
    return [
      {
        rule: "components-domain-grouping",
        target: "components/",
        status: "pass",
      },
    ];
  }

  return [
    {
      rule: "components-domain-grouping",
      target: "components/",
      status: statusFromSeverity(config.severity, false),
      message: "components/ 直下にフラットなコンポーネントがあります",
      found: flatFiles,
      fix: "ドメイン別のサブディレクトリ（例: Post/, Category/）に整理し、index.ts で re-export してください",
    },
  ];
}

/**
 * lib/ 構造準拠チェック
 *
 * lib/ 直下に許可されたディレクトリのみ存在するかチェック。
 * context/ と contexts/ の混在も検出。
 */
export function checkLibStructureCompliance(
  basePath: string,
  config: LibStructureComplianceRuleConfig
): StructureCheck[] {
  if (!config.enabled) return [];

  const libPath = join(basePath, "lib");
  if (!existsSync(libPath)) return [];

  const allowedDirs = config.allowedDirs || [
    "actions",
    "auth",
    "context",
    "constants",
    "security",
    "utils",
    "validations",
    "__tests__",
  ];

  const results: StructureCheck[] = [];
  const violations: Array<{ path: string; expected?: string; actual?: string }> = [];

  try {
    const entries = readdirSync(libPath);
    const foundDirs: string[] = [];

    for (const entry of entries) {
      const entryPath = join(libPath, entry);
      if (!statSync(entryPath).isDirectory()) continue;

      foundDirs.push(entry);

      if (!allowedDirs.includes(entry)) {
        violations.push({
          path: `lib/${entry}/`,
          expected: `許可: ${allowedDirs.join(", ")}`,
          actual: entry,
        });
      }
    }

    // context/ と contexts/ の混在チェック
    if (config.disallowContextMixing) {
      const hasContext = foundDirs.includes("context");
      const hasContexts = foundDirs.includes("contexts");
      if (hasContext && hasContexts) {
        violations.push({
          path: "lib/",
          expected: "context/ または contexts/ のいずれか",
          actual: "両方存在",
        });
      }
    }

    const passed = violations.length === 0;
    results.push({
      rule: "lib-structure-compliance",
      target: "lib/",
      status: statusFromSeverity(config.severity, passed),
      message: passed ? undefined : "lib/ に許可されていないディレクトリがあります",
      violations: passed ? undefined : violations,
      fix: passed
        ? undefined
        : "許可されたディレクトリ（actions, auth, context, constants, security, utils, validations）のみ使用してください",
    });
  } catch {
    return [];
  }

  return results;
}

/**
 * バレルエクスポート必須チェック
 *
 * 複数ファイルを持つディレクトリに index.ts が存在するかチェック。
 */
export function checkBarrelExportRequired(
  basePath: string,
  config: BarrelExportRequiredRuleConfig
): StructureCheck[] {
  if (!config.enabled) return [];

  const targetDirs = config.targetDirs || ["components", "lib"];
  const excludeDirs = config.excludeDirs || ["ui", "__tests__", "node_modules"];
  const minFiles = config.minFiles || 2;

  const results: StructureCheck[] = [];
  const missingBarrels: string[] = [];

  for (const targetDir of targetDirs) {
    const targetPath = join(basePath, targetDir);
    if (!existsSync(targetPath)) continue;

    try {
      const entries = readdirSync(targetPath);

      for (const entry of entries) {
        const entryPath = join(targetPath, entry);
        if (!statSync(entryPath).isDirectory()) continue;

        // 除外ディレクトリはスキップ
        if (excludeDirs.includes(entry)) continue;

        // サブディレクトリ内のファイル数をカウント
        const subEntries = readdirSync(entryPath);
        const tsFiles = subEntries.filter(
          (f) => f.endsWith(".ts") || f.endsWith(".tsx")
        );

        // index.ts/tsx を除いたファイル数
        const nonIndexFiles = tsFiles.filter(
          (f) => f !== "index.ts" && f !== "index.tsx"
        );

        // 最小ファイル数以上で index.ts が無い場合
        if (nonIndexFiles.length >= minFiles) {
          const hasIndex = tsFiles.some(
            (f) => f === "index.ts" || f === "index.tsx"
          );
          if (!hasIndex) {
            missingBarrels.push(`${targetDir}/${entry}/`);
          }
        }
      }
    } catch {
      continue;
    }
  }

  const passed = missingBarrels.length === 0;
  results.push({
    rule: "barrel-export-required",
    target: targetDirs.join(", "),
    status: statusFromSeverity(config.severity, passed),
    message: passed
      ? undefined
      : "index.ts が不足しているディレクトリがあります",
    found: passed ? undefined : missingBarrels,
    fix: passed
      ? undefined
      : "各ディレクトリに index.ts を作成し、バレルエクスポートを追加してください",
  });

  return results;
}

/**
 * actions分離チェック
 *
 * lib/actions/crud/ が lib/actions/domain/ をインポートしていないかチェック。
 */
export function checkActionsSeparation(
  basePath: string,
  config: ActionsSeparationRuleConfig
): StructureCheck[] {
  if (!config.enabled) return [];

  const crudPath = join(basePath, "lib/actions/crud");
  const domainPath = join(basePath, "lib/actions/domain");

  // crud/ と domain/ の両方が存在する場合のみチェック
  if (!existsSync(crudPath) || !existsSync(domainPath)) {
    return [
      {
        rule: "actions-separation",
        target: "lib/actions/",
        status: "pass",
      },
    ];
  }

  const violations: Array<{ path: string; expected?: string; actual?: string }> = [];

  try {
    // crud/ 内のファイルをチェック
    const crudFiles = globSync("**/*.ts", { cwd: crudPath });

    for (const file of crudFiles) {
      const filePath = join(crudPath, file);
      const content = readFileSync(filePath, "utf-8");

      // domain/ からのインポートを検出
      const domainImportPattern =
        /from\s+["'](?:\.\.\/domain|@\/lib\/actions\/domain|lib\/actions\/domain)/g;
      const matches = content.match(domainImportPattern);

      if (matches) {
        violations.push({
          path: `lib/actions/crud/${file}`,
          expected: "crud/ は domain/ をインポートしない",
          actual: `domain/ からのインポート検出: ${matches.length}件`,
        });
      }
    }
  } catch {
    return [];
  }

  const passed = violations.length === 0;
  return [
    {
      rule: "actions-separation",
      target: "lib/actions/",
      status: statusFromSeverity(config.severity, passed),
      message: passed
        ? undefined
        : "crud/ から domain/ へのインポートが検出されました",
      violations: passed ? undefined : violations,
      fix: passed
        ? undefined
        : "crud/ は DB操作のみに限定し、ビジネスロジックは domain/ に配置してください。crud/ から domain/ を呼び出す必要がある場合は、呼び出し元を domain/ に移動してください",
    },
  ];
}
