// consumer が convention を設定しない場合に使われる汎用ペア。pnpm workspace /
// TS monorepo 前提（source=src 配下、test=tests 配下）。Next.js 等の __tests__
// レイアウトは consumer 側で convention を上書きする。
export const defaultConventions = [
    { source: 'src/**/*.ts', test: 'tests/**/*.test.ts' },
    { source: 'src/**/*.tsx', test: 'tests/**/*.test.tsx' },
];
export const defaultExcludes = [
    '**/index.ts',
    '**/*.d.ts',
    '**/node_modules/**',
    '**/dist/**',
    '**/tests/**',
    '**/__tests__/**',
];
//# sourceMappingURL=coverage-types.js.map