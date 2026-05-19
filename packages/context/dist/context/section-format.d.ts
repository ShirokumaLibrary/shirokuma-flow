export type SectionFormatter = (section: string, titleMap: Map<string, string>) => string;
export type SectionFormatterName = 'metadata-to-frontmatter' | 'passthrough';
/**
 * 名前から SectionFormatter 関数を解決する。未知の名前や `undefined` は `passthrough`。
 */
export declare function resolveSectionFormatter(name: string | undefined): SectionFormatter;
/**
 * セクション内容からファイル名の候補を導出し、`usedNames` と衝突しないよう
 * 必要に応じて `-N` サフィックスを付ける。
 *
 * 候補の優先順:
 *   1. frontmatter の `title:` 行
 *   2. 本文中の `# H1`
 *   3. 先頭行
 *   4. `section-{index+1}` フォールバック
 */
export declare function deriveSectionFilename(section: string, index: number, usedNames: Set<string>): string;
/** `/[^a-z0-9]+/` → `-`、先頭末尾の `-` を除去した snake-case 化。 */
export declare function slugify(text: string): string;
//# sourceMappingURL=section-format.d.ts.map