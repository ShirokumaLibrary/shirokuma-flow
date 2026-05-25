/**
 * items template plan — 計画テンプレート生成 (#1836)
 *
 * 計画 Issue 本文の骨格を level に応じて生成する純粋関数。
 */

import type { Locale } from "../../../utils/i18n.js";

/** 計画レベル */
export type PlanLevel = "light" | "standard" | "detailed" | "epic";

/** JA テンプレート */
const PLAN_TEMPLATES_JA: Record<PlanLevel, string> = {
  light: `---
title: "計画: {親 Issue のタイトル}"
status: "Backlog"
---

## 計画

### アプローチ
{1-2行で方針を記載}

## 親 Issue

#{parent-number} の課題を参照。
`,
  standard: `---
title: "計画: {親 Issue のタイトル}"
status: "Backlog"
---

## 計画

### アプローチ
{選択したアプローチと理由}

### 変更対象ファイル
- \`path/to/file.ts\` — {変更内容の要約}

### タスク分解
- [ ] タスク 1
- [ ] タスク 2

## 親 Issue

#{parent-number} の課題を参照。
`,
  detailed: `---
title: "計画: {親 Issue のタイトル}"
status: "Backlog"
---

## 計画

### アプローチ
{複数案の比較と選定理由}

### 変更対象ファイル
- \`path/to/file.ts\` — {変更内容の要約}

### タスク分解
- [ ] タスク 1
- [ ] タスク 2

### リスク・懸念
- {破壊的変更、パフォーマンス、セキュリティ等}

## 親 Issue

#{parent-number} の課題を参照。
`,
  epic: `---
title: "計画: {親 Issue のタイトル}"
status: "Backlog"
---

## 計画

### アプローチ
{全体方針}

### Integration ブランチ
\`epic/{number}-{slug}\`

### サブ Issue 構成

| # | Issue | 内容 | 依存 | サイズ |
|---|-------|------|------|--------|
| 1 | #{sub1} | {概要} | — | S |
| 2 | #{sub2} | {概要} | #{sub1} | M |

### 実行順序
{依存関係に基づく推奨順序}

### タスク分解
- [ ] Integration ブランチ作成
- [ ] #{sub1}: {タスク概要}
- [ ] #{sub2}: {タスク概要}
- [ ] 最終 PR: integration → develop

### リスク・懸念
- {サブ Issue 間の依存リスク}

## 親 Issue

#{parent-number} の課題を参照。
`,
};

/** EN テンプレート */
const PLAN_TEMPLATES_EN: Record<PlanLevel, string> = {
  light: `---
title: "Plan: {parent issue title}"
status: "Backlog"
---

## Plan

### Approach
{describe the approach in 1-2 lines}

## Parent Issue

Refer to #{parent-number}.
`,
  standard: `---
title: "Plan: {parent issue title}"
status: "Backlog"
---

## Plan

### Approach
{chosen approach and rationale}

### Files to Change
- \`path/to/file.ts\` — {summary of changes}

### Task Breakdown
- [ ] Task 1
- [ ] Task 2

## Parent Issue

Refer to #{parent-number}.
`,
  detailed: `---
title: "Plan: {parent issue title}"
status: "Backlog"
---

## Plan

### Approach
{comparison of alternatives and selection rationale}

### Files to Change
- \`path/to/file.ts\` — {summary of changes}

### Task Breakdown
- [ ] Task 1
- [ ] Task 2

### Risks & Concerns
- {breaking changes, performance, security, etc.}

## Parent Issue

Refer to #{parent-number}.
`,
  epic: `---
title: "Plan: {parent issue title}"
status: "Backlog"
---

## Plan

### Approach
{overall strategy}

### Integration Branch
\`epic/{number}-{slug}\`

### Sub-Issue Structure

| # | Issue | Content | Depends | Size |
|---|-------|---------|---------|------|
| 1 | #{sub1} | {overview} | — | S |
| 2 | #{sub2} | {overview} | #{sub1} | M |

### Execution Order
{recommended order based on dependencies}

### Task Breakdown
- [ ] Create integration branch
- [ ] #{sub1}: {task summary}
- [ ] #{sub2}: {task summary}
- [ ] Final PR: integration → develop

### Risks & Concerns
- {dependency risks between sub-issues}

## Parent Issue

Refer to #{parent-number}.
`,
};

/**
 * 計画テンプレートを生成する
 * @param lang - 言語 (ja|en)
 * @param level - 計画レベル (light|standard|detailed|epic)
 * @returns テンプレート文字列
 */
export function generatePlanTemplate(lang: Locale, level: PlanLevel = "standard"): string {
  const templates = lang === "en" ? PLAN_TEMPLATES_EN : PLAN_TEMPLATES_JA;
  return templates[level] ?? templates.standard;
}
