/**
 * feature-map スタイル・スクリプト・設定
 *
 * feature-map HTML ページ用の CSS スタイルと JavaScript、
 * および設定解決ロジック。
 */

import { globSync } from "glob";
import type {
  ExternalDocConfig,
  StorybookConfig,
  ResolvedFeatureMapConfig,
  FeatureMap,
} from "../commands/feature-map-types.js";

// ============================================================
// Configuration
// ============================================================

/**
 * デフォルト設定を取得
 */
export function getDefaultFeatureMapConfig(): ResolvedFeatureMapConfig {
  return {
    enabled: true,
    include: [
      "apps/*/app/**/*.tsx",
      "apps/*/components/**/*.tsx",
      "apps/*/lib/actions/**/*.ts",
      // middleware & layout
      "apps/*/middleware.ts",
      // lib/ モジュール (@module アノテーション対象)
      "apps/*/lib/*.ts",           // lib/ 直下のファイル
      "apps/*/lib/auth/**/*.ts",
      "apps/*/lib/security/**/*.ts",
      "apps/*/lib/content/**/*.ts",
      "apps/*/lib/utils/**/*.ts",
      "apps/*/lib/validations/**/*.ts",  // バリデーション
      "packages/*/src/schema/**/*.ts",
    ],
    exclude: [
      "**/node_modules/**",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "**/lib/*/index.ts",  // index.ts (re-export) は除外
    ],
    externalDocs: [],
    storybook: undefined,
  };
}

/**
 * 設定を解決
 */
export function resolveFeatureMapConfig(config?: {
  enabled?: boolean;
  include?: string[];
  exclude?: string[];
  externalDocs?: ExternalDocConfig[];
  storybook?: {
    enabled?: boolean;
    url?: string;
    pathTemplate?: string;
    label?: string;
  };
}): ResolvedFeatureMapConfig {
  const defaults = getDefaultFeatureMapConfig();

  // Storybook 設定を解決
  let storybook: StorybookConfig | undefined;
  if (config?.storybook?.enabled) {
    storybook = {
      enabled: true,
      url: config.storybook.url || "http://localhost:6006",
      pathTemplate: config.storybook.pathTemplate || "?path=/docs/{name}--docs",
      label: config.storybook.label || "Storybook",
    };
  }

  return {
    enabled: config?.enabled ?? defaults.enabled,
    include: config?.include ?? defaults.include,
    exclude: config?.exclude ?? defaults.exclude,
    externalDocs: config?.externalDocs ?? defaults.externalDocs,
    storybook,
  };
}

/**
 * ファイルを収集
 */
export function collectFiles(projectPath: string, config: ResolvedFeatureMapConfig): string[] {
  const allFiles = new Set<string>();

  for (const pattern of config.include) {
    const files = globSync(pattern, {
      cwd: projectPath,
      absolute: true,
      ignore: config.exclude,
    });

    for (const file of files) {
      allFiles.add(file);
    }
  }

  return Array.from(allFiles).sort();
}

// ============================================================
// Styles
// ============================================================

/**
 * スタイル
 */
export function getStyles(): string {
  return `
    /* Container */
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }

    /* Export Link */
    .export-link {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      margin-left: 1rem;
      padding: 0.25rem 0.5rem;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      font-size: 0.75rem;
      color: var(--text-secondary);
      text-decoration: none;
      transition: all 0.2s;
    }

    .export-link:hover {
      background: var(--border-color);
      color: var(--text-primary);
      text-decoration: none;
    }

    .export-link svg {
      width: 12px;
      height: 12px;
    }

    /* Summary Card */
    .summary-card {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.25rem;
      margin-bottom: 1.5rem;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }

    .summary-item {
      text-align: center;
      padding: 0.75rem;
      background: var(--bg-color);
      border-radius: 8px;
    }

    .summary-value {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .summary-label {
      font-size: 0.7rem;
      color: var(--text-secondary);
      margin-top: 0.125rem;
    }

    .summary-features .summary-value { color: #a855f7; }
    .summary-screens .summary-value { color: #3b82f6; }
    .summary-components .summary-value { color: #22c55e; }
    .summary-actions .summary-value { color: #f97316; }
    .summary-tables .summary-value { color: #ec4899; }

    .summary-meta {
      text-align: right;
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    /* Filter Tabs */
    .filter-tabs {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
    }

    .filter-tab {
      padding: 0.5rem 1rem;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.2s;
      font-size: 0.85rem;
    }

    .filter-tab:hover {
      background: var(--bg-color);
      color: var(--text-primary);
    }

    .filter-tab.active {
      background: var(--accent-blue);
      border-color: var(--accent-blue);
      color: white;
    }

    .filter-tab.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* List Panels */
    .list-panel {
      display: none;
    }

    .list-panel.active {
      display: block;
    }

    /* Module Groups */
    .module-group {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      margin-bottom: 1rem;
      overflow: hidden;
    }

    .module-group.hidden {
      display: none;
    }

    .module-header {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      padding: 0.75rem 1rem;
      background: var(--bg-color);
      border-bottom: 1px solid var(--border-color);
      cursor: pointer;
      text-decoration: none;
      color: inherit;
      transition: background 0.15s;
    }

    .module-header:hover {
      background: rgba(59, 130, 246, 0.08);
      text-decoration: none;
    }

    .module-header:hover .module-name {
      color: var(--accent-blue);
    }

    .module-header-main {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }

    .module-name {
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--text-primary);
      font-family: monospace;
    }

    .module-count {
      font-size: 0.75rem;
      color: var(--text-secondary);
      background: var(--border-color);
      padding: 0.125rem 0.5rem;
      border-radius: 10px;
    }

    .module-description {
      font-size: 0.8rem;
      color: var(--text-secondary);
      margin: 0;
      line-height: 1.4;
      padding-left: 0.25rem;
    }

    .module-items {
      display: flex;
      flex-direction: column;
    }

    /* List Items */
    .list-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.625rem 1rem;
      border-bottom: 1px solid var(--border-color);
      text-decoration: none;
      color: inherit;
      transition: background 0.15s;
    }

    .list-item:last-child {
      border-bottom: none;
    }

    .list-item:hover {
      background: rgba(59, 130, 246, 0.05);
      text-decoration: none;
    }

    .list-item.hidden {
      display: none;
    }

    .item-name {
      font-weight: 500;
      font-size: 0.875rem;
      color: var(--text-primary);
      min-width: 180px;
      font-family: monospace;
    }

    .item-description {
      flex: 1;
      font-size: 0.8rem;
      color: var(--text-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .item-route {
      font-size: 0.7rem;
      padding: 0.125rem 0.5rem;
      background: rgba(59, 130, 246, 0.15);
      color: #3b82f6;
      border-radius: 4px;
      font-family: monospace;
    }

    .item-meta {
      font-size: 0.7rem;
      color: var(--text-secondary);
    }

    /* Empty message */
    .empty-message {
      padding: 2rem;
      text-align: center;
      color: var(--text-secondary);
    }

    /* Responsive */
    @media (max-width: 1200px) {
      .summary-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (max-width: 768px) {
      .container {
        padding: 1.5rem 1rem;
      }

      .summary-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .summary-item:nth-child(5) {
        grid-column: span 2;
      }

      .filter-tabs {
        flex-wrap: nowrap;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }

      .filter-tab {
        white-space: nowrap;
        flex-shrink: 0;
      }

      .item-name {
        min-width: 120px;
      }

      .item-description {
        display: none;
      }
    }

    @media (max-width: 480px) {
      .summary-grid {
        grid-template-columns: 1fr;
      }

      .summary-item:nth-child(5) {
        grid-column: auto;
      }

      .list-item {
        padding: 0.5rem 0.75rem;
        gap: 0.5rem;
      }

      .item-name {
        min-width: auto;
        font-size: 0.8rem;
      }
    }
  `;
}

// ============================================================
// Scripts
// ============================================================

/**
 * スクリプト
 */
export function getScripts(_featureMap: FeatureMap, _config: ResolvedFeatureMapConfig): string {
  return `
    // DOM Elements
    const filterTabs = document.querySelectorAll('.filter-tab');
    const listPanels = document.querySelectorAll('.list-panel');

    // Current state
    let currentType = 'action';

    // ========================================
    // Tab Switching
    // ========================================
    filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Update active tab
        filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Update current type and show corresponding panel
        currentType = tab.dataset.filter;
        listPanels.forEach(panel => {
          if (panel.dataset.type === currentType) {
            panel.classList.add('active');
          } else {
            panel.classList.remove('active');
          }
        });
      });
    });

  `;
}
