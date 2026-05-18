/**
 * Handlebars レンダラー
 *
 * テンプレートファイルを読み込み、パーシャル登録、コンパイルを行うユーティリティ。
 */

import Handlebars from "handlebars";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, basename, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * テンプレートディレクトリのパスを取得する
 * dist/ からの相対パスで templates/ を探す
 */
function getTemplatesDir(): string {
  // dist/generators/portal/renderer.js → ../../templates/portal
  return resolve(__dirname, "..", "..", "..", "templates", "portal");
}

/**
 * テンプレートファイルを読み込んでコンパイルする
 *
 * @param templatePath - templates/portal/ からの相対パス（例: "pages/home.html.hbs"）
 * @param data - テンプレートに渡すデータ
 * @returns レンダリングされた HTML 文字列
 */
export function renderTemplate(
  templatePath: string,
  data: Record<string, unknown>
): string {
  const fullPath = join(getTemplatesDir(), templatePath);
  if (!existsSync(fullPath)) {
    throw new Error(`テンプレートが見つかりません: ${fullPath}`);
  }
  const source = readFileSync(fullPath, "utf-8");
  const template = Handlebars.compile(source);
  return template(data);
}

/**
 * パーシャルファイルを一括登録する
 *
 * templates/portal/_partials/ 内の *.html.hbs ファイルをすべて登録する。
 * パーシャル名はファイル名（拡張子なし）。
 */
export function registerPartials(): void {
  const partialsDir = join(getTemplatesDir(), "_partials");
  if (!existsSync(partialsDir)) {
    return;
  }

  const files = readdirSync(partialsDir);
  for (const file of files) {
    if (!file.endsWith(".html.hbs")) continue;

    const partialName = basename(file, ".html.hbs");
    const partialPath = join(partialsDir, file);
    const partialSource = readFileSync(partialPath, "utf-8");
    Handlebars.registerPartial(partialName, partialSource);
  }
}

/**
 * テンプレートディレクトリが存在するか確認する
 */
export function templatesExist(): boolean {
  return existsSync(getTemplatesDir());
}

/**
 * テンプレートディレクトリのパスを返す（デバッグ用）
 */
export function getTemplatesDirPath(): string {
  return getTemplatesDir();
}
