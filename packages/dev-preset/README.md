# @shirokuma-library/dev-preset

ESLint / Prettier / TypeScript の共通設定プリセット。

## 構造

```
packages/dev-preset/
├── eslint.js              # ベース ESLint flat config
├── prettier.js            # ベース Prettier config
├── tsconfig.base.json     # 共通 TypeScript コンパイラオプション
├── presets/
│   └── nextjs/
│       ├── eslint.js      # Next.js 用 ESLint config
│       ├── prettier.js    # Next.js 用 Prettier config（Tailwind plugin 込み）
│       └── tsconfig.json  # Next.js 用 tsconfig（base を extends）
└── __tests__/
    └── smoke.test.ts      # 各 preset の import スモークテスト
```

## 使い方

### TypeScript tsconfig

```jsonc
// tsconfig.json
{
  "extends": "@shirokuma-library/dev-preset/tsconfig",
  "compilerOptions": {
    // プロジェクト固有のオプションを上書き
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

### ESLint（ベース）

```typescript
// eslint.config.ts
import baseConfig from "@shirokuma-library/dev-preset/eslint";
import tseslint from "typescript-eslint";

export default tseslint.config(
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    // プロジェクト固有のルールを追加
  }
);
```

### Prettier（ベース）

```javascript
// prettier.config.js
import prettierConfig from "@shirokuma-library/dev-preset/prettier";

export default prettierConfig;
```

### Next.js プリセット

> **現状の制限**: Next.js ESLint preset は React 用の最小ルール（`react/react-in-jsx-scope: off`, `react/prop-types: off`）のみを提供する雛形です。`eslint-config-next` の取り込みは未実装で、消費側で別途設定する必要があります。`eslint-config-next` を preset に統合する作業は別 Issue で対応予定です。

```typescript
// eslint.config.ts（Next.js）
import nextjsConfig from "@shirokuma-library/dev-preset/nextjs/eslint";
// 現時点では消費側で eslint-config-next を別途読み込む必要あり
```

```javascript
// prettier.config.js（Next.js）
import nextjsPrettierConfig from "@shirokuma-library/dev-preset/nextjs/prettier";
export default nextjsPrettierConfig;
```

```jsonc
// tsconfig.json（Next.js）
{
  "extends": "@shirokuma-library/dev-preset/nextjs/tsconfig"
}
```

## 命名規則・exports 追加手順

新しいプリセットを追加する場合:

1. `presets/<name>/` ディレクトリを作成
2. 必要な設定ファイル（`eslint.js`, `prettier.js`, `tsconfig.json`）を追加
3. `package.json` の `exports` フィールドにサブパスを追加:
   ```json
   {
     "exports": {
       "./<name>/eslint": "./presets/<name>/eslint.js",
       "./<name>/prettier": "./presets/<name>/prettier.js",
       "./<name>/tsconfig": "./presets/<name>/tsconfig.json"
     }
   }
   ```
4. `files` フィールドに `presets/` が含まれていることを確認（既に含まれている）
5. `__tests__/smoke.test.ts` に対応するスモークテストを追加

## 依存管理

- `eslint` と `typescript-eslint` は `peerDependencies` に登録済み（消費側でインストール）
- Next.js preset 向けの `eslint-config-next` は消費側でインストールが必要
- Next.js preset 向けの `prettier-plugin-tailwindcss` は消費側でインストールが必要

## 今後の拡張

- `presets/vite/` — Vite プロジェクト向けプリセット
- `presets/node/` — Node.js ライブラリ向けプリセット
