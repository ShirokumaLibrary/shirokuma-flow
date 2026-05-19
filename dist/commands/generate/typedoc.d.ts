/**
 * typedoc コマンド - TypeDoc API ドキュメント生成
 *
 * TypeDoc API を使用して、Server Actions や DB スキーマの
 * API ドキュメントを生成する。
 *
 * - typedoc-plugin-markdown がある場合: Markdown 出力
 * - ない場合: HTML 出力
 */
interface TypedocOptions {
    project: string;
    config: string;
    output?: string;
    verbose?: boolean;
}
/**
 * typedoc コマンドハンドラ
 */
export declare function typedocCommand(options: TypedocOptions): Promise<number>;
export {};
//# sourceMappingURL=typedoc.d.ts.map