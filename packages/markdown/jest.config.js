// ESM プロジェクトのため --experimental-vm-modules が必須。
// package.json の test スクリプトで node 直接実行により自動付与される。
/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  roots: ["<rootDir>/__tests__"],
  testMatch: ["**/*.test.ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "tsconfig.test.json",
      },
    ],
  },
  extensionsToTreatAsEsm: [".ts"],
  transformIgnorePatterns: [
    // Transform ESM packages
    "node_modules/(?!(chalk|ansi-styles|unified|remark-.*|unist-.*|mdast-.*|micromark.*|vfile.*|bail|trough|is-plain-obj|devlop|markdown-it)/)",
  ],
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "text-summary", "lcov"],
  injectGlobals: true,
  maxWorkers: 4,
};

export default config;
