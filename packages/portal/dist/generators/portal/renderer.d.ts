/**
 * Handlebars レンダラー
 *
 * テンプレートファイルを読み込み、パーシャル登録、コンパイルを行うユーティリティ。
 */
/**
 * テンプレートファイルを読み込んでコンパイルする
 *
 * @param templatePath - templates/portal/ からの相対パス（例: "pages/home.html.hbs"）
 * @param data - テンプレートに渡すデータ
 * @returns レンダリングされた HTML 文字列
 */
export declare function renderTemplate(templatePath: string, data: Record<string, unknown>): string;
/**
 * パーシャルファイルを一括登録する
 *
 * templates/portal/_partials/ 内の *.html.hbs ファイルをすべて登録する。
 * パーシャル名はファイル名（拡張子なし）。
 */
export declare function registerPartials(): void;
/**
 * テンプレートディレクトリが存在するか確認する
 */
export declare function templatesExist(): boolean;
/**
 * テンプレートディレクトリのパスを返す（デバッグ用）
 */
export declare function getTemplatesDirPath(): string;
//# sourceMappingURL=renderer.d.ts.map