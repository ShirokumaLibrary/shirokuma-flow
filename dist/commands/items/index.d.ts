/**
 * items コマンド - Commander.js ネストサブコマンドファクトリ (#1776, #1810, #1814, #1818, #1820)
 *
 * Issue / Discussion / PR / ADR の統合管理コマンド。
 * Phase 5-2 以降、Issue 専用サブコマンドは `issue` カテゴリに移行済み。
 * Phase 5-3 以降、PR サブコマンドは `pr` トップレベルカテゴリに移行済み (#2218)。
 * Phase 5-4 以降、Discussion / ADR サブコマンドは `discussion` トップレベルカテゴリに移行済み (#2219)。
 * Phase 5-5 以降、Project V2 サブコマンドは `project` トップレベルカテゴリに移行済み (#2220)。
 * Phase 5-6 以降、dashboard / preflight / integrity はトップレベルに昇格済み (#2221)。
 *
 * 残存サブコマンド（items カテゴリ、deprecation alias として維持）:
 * - `items add discussion --file <file>`: Discussion を作成してキャッシュに移動
 * - `items projects`: `project` トップレベルへの deprecation alias
 * - `items integrity`: `integrity` トップレベルへの deprecation alias
 * - `items dashboard`: `dashboard` トップレベルへの deprecation alias
 * - `items preflight`: `preflight` トップレベルへの deprecation alias
 */
import { Command } from "commander";
export declare function createItemsCommand(): Command;
//# sourceMappingURL=index.d.ts.map