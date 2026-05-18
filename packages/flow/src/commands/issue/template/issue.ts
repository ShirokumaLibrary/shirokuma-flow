/**
 * items template issue — Issue テンプレート生成 (#1836)
 *
 * Issue 作成用の frontmatter + セクション骨格を生成する純粋関数。
 */

import type { Locale } from "../../../utils/i18n.js";

/** JA/EN の Issue テンプレート文字列マップ */
const ISSUE_TEMPLATES: Record<Locale, string> = {
  ja: `---
title: ""
status: "In progress"
priority: "Medium"
size: "S"
labels: []
---

## 目的
{ロール}が{機能}できるようにする。{ユーザー価値}。

## 概要
{技術的な説明}

## 背景
{現状の問題、関連する制約や依存関係}

## 検討事項
- {計画策定時に考慮すべき視点・制約・技術的な検討事項}

## 成果物
{完了の定義}
`,
  en: `---
title: ""
status: "In progress"
priority: "Medium"
size: "S"
labels: []
---

## Purpose
{role} can {capability}. {user value}.

## Overview
{technical description}

## Background
{current issues, related constraints and dependencies}

## Considerations
- {perspectives, constraints, and technical considerations for planning}

## Deliverables
{definition of done}
`,
};

/**
 * Issue テンプレートを生成する
 * @param lang - 言語 (ja|en)
 * @returns テンプレート文字列
 */
export function generateIssueTemplate(lang: Locale): string {
  return ISSUE_TEMPLATES[lang] ?? ISSUE_TEMPLATES.ja;
}
