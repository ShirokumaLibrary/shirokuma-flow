// ベース Prettier config
// 消費側: import prettierConfig from "@shirokuma-library/dev-preset/prettier"

/** @type {import("prettier").Config} */
const prettierConfig = {
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "es5",
  printWidth: 100,
  endOfLine: "lf",
};

export default prettierConfig;
