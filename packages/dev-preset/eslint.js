// ベース ESLint flat config 配列（typescript-eslint 含む）
// 消費側: import baseConfig from "@shirokuma-library/dev-preset/eslint"
import tseslint from "typescript-eslint";

/** @type {import("typescript-eslint").ConfigArray} */
const baseConfig = tseslint.config(
  ...tseslint.configs.recommendedTypeChecked,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-empty-object-type": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/restrict-template-expressions": "error",
      "@typescript-eslint/no-base-to-string": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
    },
  }
);

export default baseConfig;
