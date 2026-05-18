// Next.js 用 Prettier config（Tailwind CSS plugin 込み）
// 消費側: import nextjsPrettierConfig from "@shirokuma-library/dev-preset/nextjs/prettier"
// 前提: 消費側で prettier-plugin-tailwindcss をインストール済みであること

/** @type {import("prettier").Config} */
const nextjsPrettierConfig = {
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "es5",
  printWidth: 100,
  endOfLine: "lf",
  plugins: ["prettier-plugin-tailwindcss"],
};

export default nextjsPrettierConfig;
