// Next.js 用 ESLint flat config（eslint-config-next ベース）
// 消費側: import nextjsConfig from "@shirokuma-library/dev-preset/nextjs/eslint"
// 前提: 消費側で eslint-config-next をインストール済みであること（peerDependency）

/** @type {import("eslint").Linter.Config[]} */
const nextjsConfig = [
  {
    // eslint-config-next を消費側環境で動的解決する
    // 消費側の package.json に eslint-config-next が含まれている必要がある
    name: "dev-preset/nextjs",
    rules: {
      // Next.js 向けの追加ルール（eslint-config-next を extends した後に適用）
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
  },
];

export default nextjsConfig;
