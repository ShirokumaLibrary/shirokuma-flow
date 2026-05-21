---
name: status-mermaid-duplication
description: Status ワークフロー mermaid/Status 表は複数の reference に重複コピーされている。Status モデル変更時は全コピーを同期する必要がある
metadata:
  type: project
---

Status ワークフローの mermaid 状態遷移図 + Status 説明表は、shirokuma-docs 内の複数ファイルに**ほぼ同一内容で重複コピー**されている。Status モデル変更（遷移追加等）時は全コピーを漏れなく同期すること。

**同期対象（同じ mermaid + Status 表が登場する箇所）:**
- `docs/specs/workflow/status.md`（人間向け正本に近い）
- `docs/specs/cli/items-transition.md`（CLI 仕様、ISSUE_FORWARD mermaid + 遷移マトリクス）
- `plugin/shirokuma-skills-{ja,en}/rules/github/project-items.md`（配布ルール、mermaid + 4 系統遷移テーブル）
- `plugin/shirokuma-skills-{ja,en}/skills/showing-github/reference/github-operations.md`
- `plugin/shirokuma-skills-{ja,en}/skills/managing-github-items/reference/github-operations.md`（showing-github とほぼ同一の status block）

**Why:** 各スキルが実行時に自前の reference を読むため DRY 化されていない。1 箇所だけ直すと mermaid と表（または ja/en）が不整合になり、#2683 でも plugin rules は表だけ先行更新され mermaid の `Review --> ToDo` エッジが落ちていた。

**How to apply:** Status 遷移を変えたら上記全ファイルを grep（`Review --> ` 等）で洗い、ja/en・mermaid・表の三者整合を取る。実装の単一ソースは `packages/flow/src/utils/status-workflow.ts`（`ISSUE_FORWARD_TRANSITIONS` 等）。テストは `node --experimental-vm-modules node_modules/jest/bin/jest.js __tests__/utils/status-workflow.test.ts` で確認。

関連: [[flow-test-infra]]
