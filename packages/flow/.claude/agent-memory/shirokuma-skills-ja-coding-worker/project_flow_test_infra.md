---
name: project-flow-test-infra
description: packages/flow の jest 実行方法と status-workflow.js モック時の落とし穴（statusRank 追加時など）
metadata:
  type: project
---

packages/flow は ESM プロジェクトで、jest は `npx jest` では動かない。

**Why:** `jest.config.js` が ts-jest ESM preset を使い、`--experimental-vm-modules` 必須。`npx jest` だと `SyntaxError: Cannot use import statement outside a module` になる。

**How to apply:** テスト実行は `cd packages/flow && node --experimental-vm-modules ../../node_modules/jest-cli/bin/jest.js <files>`（= `package.json` の `test` スクリプト）。フルスイートは `pnpm --filter @shirokuma-library/flow test`。

関連落とし穴:
- `src/utils/status-workflow.js` に新エクスポート（例 [[#2683]] の `statusRank`）を追加すると、`status-workflow.js` を `jest.unstable_mockModule` でモックしつつ**実 `parent-status.js` を import** するテスト（`__tests__/utils/check-children-all-done.test.ts` など）が `does not provide an export named X` で suite 全体落ちする。モックオブジェクトに新エクスポートのスタブを追加する必要がある。
- `cmdSubmit` のテストは `resolveCurrentStatus`（`src/commands/status/shared/resolve-status.js`）をモックしないと実 GraphQL を叩く。`repo-pairs.js` はモックしないこと（他モジュールが `validateCrossRepoAlias` 等を import しており module graph が壊れる）。
- 既知 flaky: `__tests__/commands/plugin-install-local.test.ts` の cache isolation guard はフルスイート順序依存で稀に落ちる（単独 PASS）。本件対象外。
