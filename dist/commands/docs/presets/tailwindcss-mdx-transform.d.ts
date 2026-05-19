/**
 * Tailwind CSS MDX → Markdown 変換
 *
 * tailwindcss.com の .mdx ファイルを LLM が読める純粋な Markdown に変換する。
 * JSX コンポーネントを静的にテキスト変換する（JS 実行は行わない）。
 *
 * 対応パターン:
 * - import 文の除去
 * - export const title/description → H1 + 説明段落
 * - <ApiTable rows={[...]} /> → Markdown テーブル
 * - <Figure>, <Example> → ラッパー除去（中の Markdown/コードは保持）
 * - content.tsx コンポーネント → 定型テキストに置換
 * - その他の自己閉じ JSX タグ → 除去
 */
export declare function transformMdxToMd(content: string): string;
//# sourceMappingURL=tailwindcss-mdx-transform.d.ts.map