/**
 * feature-map HTML ジェネレーター
 *
 * FeatureMap データから HTML ページを生成する。
 * メインリストレイアウト、サイドバービュー、カード/リストアイテムを構築。
 */
import { escapeHtml, formatDescription, wrapHtmlDocument, icons } from "../utils/html.js";
import { extractModuleName } from "../parsers/feature-map-utils.js";
import { getStyles, getScripts } from "./feature-map-styles.js";
/**
 * アイテムをモジュール別にグループ化
 */
export function groupByModule(items) {
    const grouped = new Map();
    for (const item of items) {
        const moduleName = extractModuleName(item.path);
        const existing = grouped.get(moduleName) || [];
        existing.push(item);
        grouped.set(moduleName, existing);
    }
    // モジュール名でソート
    return new Map([...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}
/**
 * モジュール別リストセクションを生成
 */
export function buildModuleListSection(type, groupedItems, moduleDescriptions = new Map()) {
    if (groupedItems.size === 0) {
        return '<div class="empty-message">アイテムがありません</div>';
    }
    const sections = [];
    for (const [moduleName, items] of groupedItems) {
        const listItems = items.map(item => buildListItem(type, item, moduleName)).join('');
        const description = moduleDescriptions.get(moduleName);
        const descriptionHtml = description
            ? `<p class="module-description">${formatDescription(description)}</p>`
            : '';
        // モジュール詳細ページへのリンク
        const moduleDetailHref = `details/${type}/${encodeURIComponent(moduleName)}.html`;
        sections.push(`
      <div class="module-group" data-module="${escapeHtml(moduleName)}">
        <a href="${moduleDetailHref}" class="module-header">
          <div class="module-header-main">
            <span class="module-name">${escapeHtml(moduleName)}</span>
            <span class="module-count">${items.length}</span>
          </div>
          ${descriptionHtml}
        </a>
        <div class="module-items">
          ${listItems}
        </div>
      </div>
    `);
    }
    return sections.join('');
}
/**
 * リストアイテムを生成
 */
export function buildListItem(type, item, moduleName) {
    const name = item.name;
    const description = item.description || '';
    const href = `details/${type}/${encodeURIComponent(moduleName)}/${encodeURIComponent(name)}.html`;
    // 追加情報
    let meta = '';
    if (type === 'screen' && 'route' in item && item.route) {
        meta = `<span class="item-route">${escapeHtml(item.route)}</span>`;
    }
    else if (type === 'action' && 'dbTables' in item && item.dbTables.length > 0) {
        meta = `<span class="item-meta">${item.dbTables.length} tables</span>`;
    }
    else if (type === 'table' && 'usedInActions' in item && item.usedInActions.length > 0) {
        meta = `<span class="item-meta">${item.usedInActions.length} actions</span>`;
    }
    return `
    <a href="${href}" class="list-item" data-name="${escapeHtml(name)}" data-module="${escapeHtml(moduleName)}">
      <span class="item-name">${escapeHtml(name)}</span>
      ${description ? `<span class="item-description">${escapeHtml(description.substring(0, 60))}${description.length > 60 ? '...' : ''}</span>` : ''}
      ${meta}
    </a>
  `;
}
/**
 * Feature Map HTML を生成 (Module-grouped List レイアウト)
 */
export function generateFeatureMapHtml(featureMap, projectName, config, moduleDescriptions = new Map()) {
    const styles = getStyles();
    const scripts = getScripts(featureMap, config);
    // 全アイテムを収集
    const allScreens = [];
    const allComponents = [];
    const allActions = [];
    const allModules = [];
    const allTables = [];
    for (const group of Object.values(featureMap.features)) {
        allScreens.push(...group.screens);
        allComponents.push(...group.components);
        allActions.push(...group.actions);
        allModules.push(...group.modules);
        allTables.push(...group.tables);
    }
    allScreens.push(...featureMap.uncategorized.screens);
    allComponents.push(...featureMap.uncategorized.components);
    allActions.push(...featureMap.uncategorized.actions);
    allModules.push(...featureMap.uncategorized.modules);
    allTables.push(...featureMap.uncategorized.tables);
    // モジュール別にグループ化
    const groupedScreens = groupByModule(allScreens);
    const groupedComponents = groupByModule(allComponents);
    const groupedActions = groupByModule(allActions);
    const groupedTables = groupByModule(allTables);
    const content = `
    <div class="container">
      <div class="page-header">
        <h1 class="page-title">${escapeHtml(projectName)} 機能マップ</h1>
        <p class="page-description">
          コードアノテーションから抽出された機能階層構造
          <a href="feature-map.json" class="export-link" download title="JSONエクスポート">
            ${icons.download} JSON
          </a>
        </p>
      </div>
      ${buildSummaryCard(featureMap)}

      <!-- Filter Tabs -->
      <div class="filter-tabs">
        <button class="filter-tab${allScreens.length > 0 ? '' : ' disabled'}" data-filter="screen">Screens (${allScreens.length})</button>
        <button class="filter-tab${allComponents.length > 0 ? '' : ' disabled'}" data-filter="component">Components (${allComponents.length})</button>
        <button class="filter-tab active" data-filter="action">Actions (${allActions.length})</button>
        <button class="filter-tab" data-filter="table">Tables (${allTables.length})</button>
      </div>

      <!-- List Panels -->
      <div class="list-panel" id="panel-screen" data-type="screen">
        ${buildModuleListSection('screen', groupedScreens, moduleDescriptions)}
      </div>
      <div class="list-panel" id="panel-component" data-type="component">
        ${buildModuleListSection('component', groupedComponents, moduleDescriptions)}
      </div>
      <div class="list-panel active" id="panel-action" data-type="action">
        ${buildModuleListSection('action', groupedActions, moduleDescriptions)}
      </div>
      <div class="list-panel" id="panel-table" data-type="table">
        ${buildModuleListSection('table', groupedTables, moduleDescriptions)}
      </div>

    </div>
  `;
    return wrapHtmlDocument({
        title: `機能階層マップ - ${projectName}`,
        content,
        styles,
        scripts,
        headElements: `<link rel="stylesheet" href="/global-nav.css">`,
        bodyEndScripts: `<script src="/global-nav.js"></script>`,
    });
}
/**
 * サイドバー HTML を構築
 */
export function buildSidebar(featureMap) {
    const layerView = buildLayerView(featureMap);
    const featureView = buildFeatureView(featureMap);
    return `
    <div id="layerView" class="sidebar-view active">
      ${layerView}
    </div>
    <div id="featureView" class="sidebar-view">
      ${featureView}
    </div>
  `;
}
/**
 * レイヤー別サイドバービューを構築
 */
export function buildLayerView(featureMap) {
    const allScreens = [];
    const allComponents = [];
    const allActions = [];
    const allModules = [];
    const allTables = [];
    const collectFromGroup = (group) => {
        allScreens.push(...group.screens);
        allComponents.push(...group.components);
        allActions.push(...group.actions);
        allModules.push(...group.modules);
        allTables.push(...group.tables);
    };
    for (const group of Object.values(featureMap.features)) {
        collectFromGroup(group);
    }
    collectFromGroup(featureMap.uncategorized);
    return `
    <div class="sidebar-group expanded" data-group="features">
      <div class="sidebar-group-header">
        <span class="expand-icon">${icons.chevronDown}</span>
        <span class="layer-icon feature">${icons.feature}</span>
        <span class="group-name">Features</span>
        <span class="group-count">${Object.keys(featureMap.features).length}</span>
      </div>
      <div class="sidebar-group-items">
        ${Object.keys(featureMap.features).sort().map(name => `
          <div class="sidebar-item" data-id="feature-${escapeHtml(name)}" data-type="feature" tabindex="0">
            <span class="item-name">${escapeHtml(name)}</span>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="sidebar-group expanded" data-group="screens">
      <div class="sidebar-group-header">
        <span class="expand-icon">${icons.chevronDown}</span>
        <span class="layer-icon screen">${icons.screen}</span>
        <span class="group-name">Screens</span>
        <span class="group-count">${allScreens.length}</span>
      </div>
      <div class="sidebar-group-items">
        ${allScreens.map(s => `
          <div class="sidebar-item" data-id="screen-${escapeHtml(s.name)}" data-type="screen" tabindex="0">
            <span class="item-name">${escapeHtml(s.name)}</span>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="sidebar-group expanded" data-group="components">
      <div class="sidebar-group-header">
        <span class="expand-icon">${icons.chevronDown}</span>
        <span class="layer-icon component">${icons.component}</span>
        <span class="group-name">Components</span>
        <span class="group-count">${allComponents.length}</span>
      </div>
      <div class="sidebar-group-items">
        ${allComponents.map(c => `
          <div class="sidebar-item" data-id="component-${escapeHtml(c.name)}" data-type="component" tabindex="0">
            <span class="item-name">${escapeHtml(c.name)}</span>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="sidebar-group expanded" data-group="actions">
      <div class="sidebar-group-header">
        <span class="expand-icon">${icons.chevronDown}</span>
        <span class="layer-icon action">${icons.action}</span>
        <span class="group-name">Actions</span>
        <span class="group-count">${allActions.length}</span>
      </div>
      <div class="sidebar-group-items">
        ${allActions.map(a => `
          <div class="sidebar-item" data-id="action-${escapeHtml(a.name)}" data-type="action" tabindex="0">
            <span class="item-name">${escapeHtml(a.name)}</span>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="sidebar-group expanded" data-group="tables">
      <div class="sidebar-group-header">
        <span class="expand-icon">${icons.chevronDown}</span>
        <span class="layer-icon table">${icons.table}</span>
        <span class="group-name">Tables</span>
        <span class="group-count">${allTables.length}</span>
      </div>
      <div class="sidebar-group-items">
        ${allTables.map(t => `
          <div class="sidebar-item" data-id="table-${escapeHtml(t.name)}" data-type="table" tabindex="0">
            <span class="item-name">${escapeHtml(t.name)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
/**
 * 機能別サイドバービューを構築
 */
export function buildFeatureView(featureMap) {
    const featureItems = [];
    for (const [featureName, group] of Object.entries(featureMap.features).sort()) {
        const totalCount = group.screens.length + group.components.length + group.actions.length + group.tables.length;
        featureItems.push(`
      <div class="sidebar-group expanded" data-group="feature-${escapeHtml(featureName)}">
        <div class="sidebar-group-header">
          <span class="expand-icon">${icons.chevronDown}</span>
          <span class="layer-icon feature">${icons.feature}</span>
          <span class="group-name">${escapeHtml(featureName)}</span>
          <span class="group-count">${totalCount}</span>
        </div>
        <div class="sidebar-group-items">
          ${group.screens.map(s => `
            <div class="sidebar-item" data-id="screen-${escapeHtml(s.name)}" data-type="screen" tabindex="0">
              <span class="layer-icon screen mini">${icons.screen}</span>
              <span class="item-name">${escapeHtml(s.name)}</span>
            </div>
          `).join('')}
          ${group.components.map(c => `
            <div class="sidebar-item" data-id="component-${escapeHtml(c.name)}" data-type="component" tabindex="0">
              <span class="layer-icon component mini">${icons.component}</span>
              <span class="item-name">${escapeHtml(c.name)}</span>
            </div>
          `).join('')}
          ${group.actions.map(a => `
            <div class="sidebar-item" data-id="action-${escapeHtml(a.name)}" data-type="action" tabindex="0">
              <span class="layer-icon action mini">${icons.action}</span>
              <span class="item-name">${escapeHtml(a.name)}</span>
            </div>
          `).join('')}
          ${group.tables.map(t => `
            <div class="sidebar-item" data-id="table-${escapeHtml(t.name)}" data-type="table" tabindex="0">
              <span class="layer-icon table mini">${icons.table}</span>
              <span class="item-name">${escapeHtml(t.name)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `);
    }
    // Uncategorized
    const uncat = featureMap.uncategorized;
    const uncatTotal = uncat.screens.length + uncat.components.length + uncat.actions.length + uncat.tables.length;
    if (uncatTotal > 0) {
        featureItems.push(`
      <div class="sidebar-group expanded" data-group="uncategorized">
        <div class="sidebar-group-header">
          <span class="expand-icon">${icons.chevronDown}</span>
          <span class="layer-icon feature">${icons.feature}</span>
          <span class="group-name">未分類</span>
          <span class="group-count">${uncatTotal}</span>
        </div>
        <div class="sidebar-group-items">
          ${uncat.screens.map(s => `
            <div class="sidebar-item" data-id="screen-${escapeHtml(s.name)}" data-type="screen" tabindex="0">
              <span class="layer-icon screen mini">${icons.screen}</span>
              <span class="item-name">${escapeHtml(s.name)}</span>
            </div>
          `).join('')}
          ${uncat.components.map(c => `
            <div class="sidebar-item" data-id="component-${escapeHtml(c.name)}" data-type="component" tabindex="0">
              <span class="layer-icon component mini">${icons.component}</span>
              <span class="item-name">${escapeHtml(c.name)}</span>
            </div>
          `).join('')}
          ${uncat.actions.map(a => `
            <div class="sidebar-item" data-id="action-${escapeHtml(a.name)}" data-type="action" tabindex="0">
              <span class="layer-icon action mini">${icons.action}</span>
              <span class="item-name">${escapeHtml(a.name)}</span>
            </div>
          `).join('')}
          ${uncat.tables.map(t => `
            <div class="sidebar-item" data-id="table-${escapeHtml(t.name)}" data-type="table" tabindex="0">
              <span class="layer-icon table mini">${icons.table}</span>
              <span class="item-name">${escapeHtml(t.name)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `);
    }
    return featureItems.join('');
}
/**
 * 詳細パネルのHTMLデータを構築
 */
export function buildDetailPanel(featureMap) {
    const featureNames = Object.keys(featureMap.features).sort();
    if (featureNames.length > 0) {
        return buildFeatureDetail(featureNames[0], featureMap.features[featureNames[0]], featureMap);
    }
    return `
    <div class="detail-welcome">
      <h2>機能マップへようこそ</h2>
      <p>左のサイドバーからアイテムを選択して詳細を表示します。</p>
    </div>
  `;
}
/**
 * Feature詳細を構築
 */
export function buildFeatureDetail(name, group, _featureMap) {
    const screenCount = group.screens.length;
    const componentCount = group.components.length;
    const actionCount = group.actions.length;
    const tableCount = group.tables.length;
    let description = '';
    if (group.screens.length > 0 && group.screens[0].description) {
        description = group.screens[0].description;
    }
    else if (group.components.length > 0 && group.components[0].description) {
        description = group.components[0].description;
    }
    return `
    <div class="detail-header">
      <span class="detail-icon feature">${icons.feature}</span>
      <div class="detail-title-area">
        <h2>${escapeHtml(name)}</h2>
        ${description ? `<p class="detail-description">${escapeHtml(description)}</p>` : ''}
      </div>
    </div>
    <div class="detail-summary">
      <span class="summary-badge screens">${screenCount} screens</span>
      <span class="summary-badge components">${componentCount} components</span>
      <span class="summary-badge actions">${actionCount} actions</span>
      <span class="summary-badge tables">${tableCount} tables</span>
    </div>
    ${screenCount > 0 ? `
      <div class="detail-section">
        <h3><span class="layer-icon screen">${icons.screen}</span> Screens (${screenCount})</h3>
        <div class="detail-cards">
          ${group.screens.map(s => buildScreenCard(s)).join('')}
        </div>
      </div>
    ` : ''}
    ${componentCount > 0 ? `
      <div class="detail-section">
        <h3><span class="layer-icon component">${icons.component}</span> Components (${componentCount})</h3>
        <div class="detail-cards">
          ${group.components.map(c => buildComponentCard(c)).join('')}
        </div>
      </div>
    ` : ''}
    ${actionCount > 0 ? `
      <div class="detail-section">
        <h3><span class="layer-icon action">${icons.action}</span> Actions (${actionCount})</h3>
        <div class="detail-cards">
          ${group.actions.map(a => buildActionCard(a)).join('')}
        </div>
      </div>
    ` : ''}
    ${tableCount > 0 ? `
      <div class="detail-section">
        <h3><span class="layer-icon table">${icons.table}</span> Tables (${tableCount})</h3>
        <div class="detail-cards">
          ${group.tables.map(t => buildTableCard(t)).join('')}
        </div>
      </div>
    ` : ''}
  `;
}
/**
 * Screen詳細カードを構築
 */
export function buildScreenCard(screen) {
    const moduleName = extractModuleName(screen.path);
    return `
    <a href="details/screens/${encodeURIComponent(moduleName)}/${encodeURIComponent(screen.name)}.html" class="detail-card screen" data-type="screen" data-name="${escapeHtml(screen.name)}" data-module="${escapeHtml(moduleName)}">
      <div class="card-icon">${icons.screen}</div>
      <div class="card-body">
        <h3 class="card-name">${escapeHtml(screen.name)}</h3>
        <div class="card-module">${escapeHtml(moduleName)}</div>
        ${screen.route ? `<div class="card-route">${escapeHtml(screen.route)}</div>` : ''}
        ${screen.description ? `<p class="card-description">${escapeHtml(screen.description)}</p>` : ''}
        <div class="card-footer">
          <span class="card-type-badge screen">Screen</span>
          ${screen.usedComponents.length > 0 ? `<span class="card-count">${screen.usedComponents.length} components</span>` : ''}
          ${screen.usedActions.length > 0 ? `<span class="card-count">${screen.usedActions.length} actions</span>` : ''}
        </div>
      </div>
    </a>
  `;
}
/**
 * Component詳細カードを構築
 */
export function buildComponentCard(comp) {
    const moduleName = extractModuleName(comp.path);
    return `
    <a href="details/components/${encodeURIComponent(moduleName)}/${encodeURIComponent(comp.name)}.html" class="detail-card component" data-type="component" data-name="${escapeHtml(comp.name)}" data-module="${escapeHtml(moduleName)}">
      <div class="card-icon">${icons.component}</div>
      <div class="card-body">
        <h3 class="card-name">${escapeHtml(comp.name)}</h3>
        <div class="card-module">${escapeHtml(moduleName)}</div>
        ${comp.description ? `<p class="card-description">${escapeHtml(comp.description)}</p>` : ''}
        <div class="card-footer">
          <span class="card-type-badge component">Component</span>
          ${comp.usedInScreens.length > 0 ? `<span class="card-count">${comp.usedInScreens.length} screens</span>` : ''}
          ${comp.usedActions.length > 0 ? `<span class="card-count">${comp.usedActions.length} actions</span>` : ''}
        </div>
      </div>
    </a>
  `;
}
/**
 * Action詳細カードを構築
 */
export function buildActionCard(action) {
    const moduleName = extractModuleName(action.path);
    return `
    <a href="details/actions/${encodeURIComponent(moduleName)}/${encodeURIComponent(action.name)}.html" class="detail-card action" data-type="action" data-name="${escapeHtml(action.name)}" data-module="${escapeHtml(moduleName)}">
      <div class="card-icon">${icons.action}</div>
      <div class="card-body">
        <h3 class="card-name">${escapeHtml(action.name)}</h3>
        <div class="card-module">${escapeHtml(moduleName)}</div>
        ${action.description ? `<p class="card-description">${escapeHtml(action.description)}</p>` : ''}
        <div class="card-footer">
          <span class="card-type-badge action">Action</span>
          ${action.usedInScreens.length > 0 ? `<span class="card-count">${action.usedInScreens.length} screens</span>` : ''}
          ${action.dbTables.length > 0 ? `<span class="card-count">${action.dbTables.length} tables</span>` : ''}
        </div>
      </div>
    </a>
  `;
}
/**
 * Table詳細カードを構築
 */
export function buildTableCard(table) {
    const moduleName = extractModuleName(table.path);
    return `
    <a href="details/tables/${encodeURIComponent(moduleName)}/${encodeURIComponent(table.name)}.html" class="detail-card table" data-type="table" data-name="${escapeHtml(table.name)}" data-module="${escapeHtml(moduleName)}">
      <div class="card-icon">${icons.table}</div>
      <div class="card-body">
        <h3 class="card-name">${escapeHtml(table.name)}</h3>
        <div class="card-module">${escapeHtml(moduleName)}</div>
        ${table.description ? `<p class="card-description">${escapeHtml(table.description)}</p>` : ''}
        <div class="card-footer">
          <span class="card-type-badge table">Table</span>
          ${table.usedInActions.length > 0 ? `<span class="card-count">${table.usedInActions.length} actions</span>` : ''}
        </div>
      </div>
    </a>
  `;
}
/**
 * サマリーカード HTML を生成
 */
export function buildSummaryCard(featureMap) {
    const featureCount = Object.keys(featureMap.features).length;
    let totalScreens = 0;
    let totalComponents = 0;
    let totalActions = 0;
    let totalTables = 0;
    for (const group of Object.values(featureMap.features)) {
        totalScreens += group.screens.length;
        totalComponents += group.components.length;
        totalActions += group.actions.length;
        totalTables += group.tables.length;
    }
    totalScreens += featureMap.uncategorized.screens.length;
    totalComponents += featureMap.uncategorized.components.length;
    totalActions += featureMap.uncategorized.actions.length;
    totalTables += featureMap.uncategorized.tables.length;
    return `
    <div class="summary-card">
      <div class="summary-grid">
        <div class="summary-item summary-features">
          <div class="summary-value">${featureCount}</div>
          <div class="summary-label">Features</div>
        </div>
        <div class="summary-item summary-screens">
          <div class="summary-value">${totalScreens}</div>
          <div class="summary-label">Screens</div>
        </div>
        <div class="summary-item summary-components">
          <div class="summary-value">${totalComponents}</div>
          <div class="summary-label">Components</div>
        </div>
        <div class="summary-item summary-actions">
          <div class="summary-value">${totalActions}</div>
          <div class="summary-label">Actions</div>
        </div>
        <div class="summary-item summary-tables">
          <div class="summary-value">${totalTables}</div>
          <div class="summary-label">Tables</div>
        </div>
      </div>
      <div class="summary-meta">
        生成日時: ${new Date(featureMap.generatedAt).toLocaleString("ja-JP")}
      </div>
    </div>
  `;
}
//# sourceMappingURL=feature-map-html.js.map