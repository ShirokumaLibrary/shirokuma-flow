/**
 * items template サブコマンドグループ (#1836)
 *
 * Issue・計画・PR・ADR・コメントの frontmatter + セクション骨格を生成する。
 * 各テンプレートは純粋関数として個別ファイルに実装し、CLI からは
 * このファクトリ経由で登録する。
 *
 * サブコマンド:
 * - items template issue                  — Issue 作成用テンプレート
 * - items template plan [--level <level>] — 計画 Issue テンプレート
 * - items template pr                     — PR 本文テンプレート
 * - items template adr                    — ADR Discussion テンプレート
 * - items template comment [--type <type>] — コメントテンプレート
 *
 * 共通オプション:
 * - --output <file>  — ファイルに書き出す（省略時は標準出力）
 * - --lang <ja|en>   — 言語（省略時は設定ファイルの language → i18n の currentLocale）
 */
import { Command } from "commander";
/**
 * items template サブコマンドグループを生成する
 */
export declare function createTemplateCommand(): Command;
//# sourceMappingURL=index.d.ts.map