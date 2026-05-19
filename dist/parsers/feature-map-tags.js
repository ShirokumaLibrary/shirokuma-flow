/**
 * feature-map JSDoc タグパーサー
 *
 * TypeScript ファイルから feature-map 用のカスタム JSDoc タグを解析し、
 * FeatureMapItem に変換する。
 */
import { inferAppFromPath } from "../utils/app-inference.js";
import { inferActionTypeFromPath } from "../utils/action-inference.js";
import { isComponentFile } from "../analyzers/reference-analyzer.js";
import { extractExportedComponentName } from "../parsers/jsdoc-common.js";
import { extractTags, extractDescription, parseCommaSeparatedList } from "./feature-map-utils.js";
import { extractExportedTypes, extractExportedUtilities } from "./feature-map-type-extraction.js";
/**
 * ファイルヘッダー領域の終了位置を検出
 *
 * @description
 * ファイルヘッダー領域とは、以下のいずれかが最初に現れるまでの領域:
 * - "use server" または "use client" ディレクティブ
 * - import 文
 * - export 文
 * - 通常の関数/変数宣言
 *
 * ファイルヘッダー内のJSDocコメントは、モジュール全体のドキュメントとして扱い、
 * 個別のアイテム（Screen/Component/Action）として抽出しない。
 *
 * @param content - ファイル内容
 * @returns ヘッダー領域の終了位置（インデックス）
 */
export function findCodeStartIndex(content) {
    // パターン1: import 文（先頭の空白・コメント無視）
    const importMatch = content.match(/^(?:\/\/.*\n|\/\*[\s\S]*?\*\/\n|\s)*import\s/m);
    if (importMatch && importMatch.index !== undefined) {
        // import文の実際の開始位置を計算（コメント・空白の後）
        const importStart = importMatch.index + importMatch[0].indexOf('import');
        return importStart;
    }
    // パターン2: export 文
    const exportMatch = content.match(/^(?:\/\/.*\n|\/\*[\s\S]*?\*\/\n|\s)*export\s/m);
    if (exportMatch && exportMatch.index !== undefined) {
        const exportStart = exportMatch.index + exportMatch[0].indexOf('export');
        return exportStart;
    }
    // パターン3: トップレベルの関数/変数宣言
    const declarationMatch = content.match(/^(?:\/\/.*\n|\/\*[\s\S]*?\*\/\n|\s)*(?:const|let|var|function|class|interface|type|enum)\s/m);
    if (declarationMatch && declarationMatch.index !== undefined) {
        const declarationStart = declarationMatch.index + declarationMatch[0].search(/(?:const|let|var|function|class|interface|type|enum)/);
        return declarationStart;
    }
    // コード開始が見つからない場合は0（全てを対象）
    return 0;
}
/**
 * ファイルヘッダーからメタデータを抽出
 */
export function extractFileMetadata(content, codeStartIndex) {
    const headerContent = content.slice(0, codeStartIndex);
    // ファイルヘッダー内のJSDocを検索
    const jsdocMatch = headerContent.match(/\/\*\*[\s\S]*?\*\//);
    if (!jsdocMatch) {
        return {};
    }
    const jsdocBlock = jsdocMatch[0];
    const tags = extractTags(jsdocBlock);
    // parseCommaSeparatedListは空配列を返すため、空の場合はundefinedに変換
    const toUndefinedIfEmpty = (arr) => arr.length > 0 ? arr : undefined;
    // モジュール説明を抽出（@description タグまたは先頭の説明文）
    let moduleDescription = tags.description;
    if (!moduleDescription) {
        // @description がない場合は先頭の説明文を使用
        moduleDescription = extractDescription(jsdocBlock);
    }
    return {
        feature: tags.feature,
        usedInScreens: toUndefinedIfEmpty(parseCommaSeparatedList(tags.usedInScreen)),
        // ファイルレベルでは @usedComponents (複数形) を使用
        usedInComponents: toUndefinedIfEmpty(parseCommaSeparatedList(tags.usedComponents)),
        dbTables: toUndefinedIfEmpty(parseCommaSeparatedList(tags.dbTables)),
        moduleDescription,
        moduleName: tags.module,
    };
}
/**
 * ファイルから Feature Map タグを解析
 */
export function parseFeatureMapTags(content, filePath) {
    return parseFeatureMapTagsWithMetadata(content, filePath).items;
}
/**
 * ファイルから Feature Map タグを解析（メタデータ付き）
 */
export function parseFeatureMapTagsWithMetadata(content, filePath) {
    const items = [];
    // ファイルヘッダー領域の終了位置を検出
    const codeStartIndex = findCodeStartIndex(content);
    // ファイルヘッダーからメタデータを抽出
    const fileMetadata = extractFileMetadata(content, codeStartIndex);
    // エクスポートされた型定義を抽出
    const types = extractExportedTypes(content);
    // エクスポートされたユーティリティ（定数・ヘルパー関数）を抽出
    const utilities = extractExportedUtilities(content);
    // ファイルヘッダーJSDocから @screen/@component/@module を抽出
    // (page.tsx など、ファイル全体が1つの画面/コンポーネント/モジュールを表す場合)
    const headerContent = content.slice(0, codeStartIndex);
    const headerJsdocMatch = headerContent.match(/\/\*\*[\s\S]*?\*\//);
    if (headerJsdocMatch) {
        const headerJsdoc = headerJsdocMatch[0];
        const headerTags = extractTags(headerJsdoc);
        // @screen/@component/@module/@serverAction/@dbTable がファイルヘッダーにある場合、アイテムとして追加
        if (headerTags.screen || headerTags.component || headerTags.module || headerTags.serverAction !== undefined || headerTags.dbTable) {
            // @serverAction/@dbTable の場合、関数名を抽出するために後続コードを取得
            let headerItemName;
            if (headerTags.serverAction !== undefined || headerTags.dbTable) {
                const headerJsdocIndex = headerContent.indexOf(headerJsdoc);
                const afterHeaderJsdoc = content.slice(headerJsdocIndex + headerJsdoc.length);
                headerItemName = extractItemName(afterHeaderJsdoc);
            }
            const headerItem = parseJSDocBlock(headerJsdoc, filePath, headerItemName, fileMetadata);
            if (headerItem) {
                items.push(headerItem);
            }
        }
        // @component が無いがコンポーネントファイルの場合、自動検出
        else if (isComponentFile(filePath)) {
            const autoComponentName = extractExportedComponentName(content);
            if (autoComponentName) {
                // 自動検出されたコンポーネントをアイテムとして追加
                const description = extractDescription(headerJsdoc);
                const usedComponents = parseCommaSeparatedList(headerTags.usedComponents);
                const usedActions = parseCommaSeparatedList(headerTags.usedActions);
                items.push({
                    type: "component",
                    name: autoComponentName,
                    path: filePath,
                    description: description || undefined,
                    feature: fileMetadata.feature,
                    usedInScreens: fileMetadata.usedInScreens || [],
                    usedInComponents: [],
                    usedComponents,
                    usedActions,
                    app: inferAppFromPath(filePath),
                });
            }
        }
    }
    // @component アノテーションもヘッダーJSDocも無いがコンポーネントファイルの場合
    else if (isComponentFile(filePath)) {
        const autoComponentName = extractExportedComponentName(content);
        if (autoComponentName) {
            items.push({
                type: "component",
                name: autoComponentName,
                path: filePath,
                feature: undefined,
                usedInScreens: [],
                usedInComponents: [],
                usedComponents: [],
                usedActions: [],
                app: inferAppFromPath(filePath),
            });
        }
    }
    // JSDoc コメントブロックを抽出 (/** ... */)
    const jsdocRegex = /\/\*\*[\s\S]*?\*\//g;
    const matches = content.matchAll(jsdocRegex);
    for (const match of matches) {
        const jsdocBlock = match[0];
        const blockStart = match.index || 0;
        // ファイルヘッダー領域内のJSDocはスキップ（上で処理済み）
        if (blockStart < codeStartIndex) {
            continue;
        }
        // コメント後のコードを取得 (関数名/変数名を抽出)
        const afterComment = content.slice(blockStart + jsdocBlock.length);
        const itemName = extractItemName(afterComment);
        // タグを解析（ファイルメタデータを継承）
        const item = parseJSDocBlock(jsdocBlock, filePath, itemName, fileMetadata);
        if (item) {
            items.push(item);
        }
    }
    return { items, metadata: fileMetadata, types, utilities };
}
/**
 * コメント後のコードからアイテム名を抽出
 */
export function extractItemName(code) {
    // 関数/コンポーネント名を抽出
    const patterns = [
        /export\s+(?:async\s+)?function\s+(\w+)/,
        /export\s+default\s+(?:async\s+)?function\s+(\w+)/,
        /export\s+const\s+(\w+)/,
        /(?:async\s+)?function\s+(\w+)/,
        /const\s+(\w+)\s*=/,
    ];
    for (const pattern of patterns) {
        const match = code.match(pattern);
        if (match) {
            return match[1];
        }
    }
    return undefined;
}
/**
 * JSDoc ブロックを解析（ファイルメタデータ継承版）
 */
export function parseJSDocBlock(jsdocBlock, filePath, defaultName, fileMetadata) {
    // タグを抽出
    const tags = extractTags(jsdocBlock);
    // アイテムタイプを判定
    let type;
    let name = defaultName;
    if (tags.screen) {
        type = "screen";
        name = tags.screen;
    }
    else if (tags.component) {
        type = "component";
        name = tags.component;
    }
    else if (tags.serverAction !== undefined) {
        type = "action";
        // nameはdefaultNameから取得
    }
    else if (tags.module) {
        type = "module";
        if (defaultName) {
            name = defaultName.replace(/\//g, "-");
        }
        else {
            const match = filePath.match(/lib\/(\w+)\/(\w+)\.ts$/);
            if (match) {
                name = `${match[1]}-${match[2]}`;
            }
            else {
                name = filePath.split("/").pop()?.replace(/\.tsx?$/, "") || "unknown";
            }
        }
    }
    else if (tags.dbTable) {
        type = "table";
        name = tags.dbTable;
    }
    // タイプが不明な場合はスキップ
    if (!type || !name) {
        return null;
    }
    // 説明文を抽出
    const description = extractDescription(jsdocBlock);
    // アプリ名を推論
    const app = inferAppFromPath(filePath);
    // 基本アイテムを作成
    const item = {
        type,
        name,
        path: filePath,
        feature: tags.feature || fileMetadata.feature,
        description,
        app,
    };
    // タイプ別の追加フィールド（ファイルメタデータを継承）
    switch (type) {
        case "screen":
            item.route = tags.route;
            item.usedComponents = parseCommaSeparatedList(tags.usedComponents);
            item.usedActions = parseCommaSeparatedList(tags.usedActions);
            break;
        case "component":
            item.usedInScreens = parseCommaSeparatedList(tags.usedInScreen);
            item.usedActions = parseCommaSeparatedList(tags.usedActions);
            break;
        case "action": {
            const functionUsedInScreens = parseCommaSeparatedList(tags.usedInScreen);
            const functionUsedInComponents = parseCommaSeparatedList(tags.usedInComponent);
            const functionDbTables = parseCommaSeparatedList(tags.dbTables);
            item.usedInScreens = functionUsedInScreens.length > 0 ? functionUsedInScreens : fileMetadata.usedInScreens;
            item.usedInComponents = functionUsedInComponents.length > 0 ? functionUsedInComponents : fileMetadata.usedInComponents;
            item.dbTables = functionDbTables.length > 0 ? functionDbTables : fileMetadata.dbTables;
            item.actionType = inferActionTypeFromPath(filePath);
            break;
        }
        case "module":
            item.category = tags.module;
            item.usedInScreens = parseCommaSeparatedList(tags.usedInScreen);
            item.usedInActions = parseCommaSeparatedList(tags.usedInActions);
            break;
        case "table":
            item.usedInActions = parseCommaSeparatedList(tags.usedInActions);
            break;
    }
    return item;
}
//# sourceMappingURL=feature-map-tags.js.map