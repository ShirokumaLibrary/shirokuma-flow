import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // .js 拡張子を .ts に解決する（NodeNext モジュール解決との互換）
    extensionAlias: {
      '.js': ['.ts', '.js'],
    },
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
