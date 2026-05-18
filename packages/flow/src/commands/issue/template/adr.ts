/**
 * items template adr — ADR テンプレート生成 (#1836)
 *
 * ADR Discussion 本文骨格を生成する純粋関数。
 */

import type { Locale } from "../../../utils/i18n.js";

/** JA/EN の ADR テンプレート文字列マップ */
const ADR_TEMPLATES: Record<Locale, string> = {
  ja: `**ステータス:** Proposed
**日付:** {YYYY-MM-DD}

## コンテキスト

{この決定・変更の動機となっている問題は何か？}

## 決定

{何を提案・実行するのか？}

## 検討した代替案

### {代替案 1}
- **利点:** {メリット}
- **欠点:** {デメリット}

### {代替案 2}
- **利点:** {メリット}
- **欠点:** {デメリット}

## 結果

### ポジティブ
- {メリット}

### ネガティブ
- {トレードオフ}

## 関連する決定
- {ADR-NNN: 関連の概要}
`,
  en: `**Status:** Proposed
**Date:** {YYYY-MM-DD}

## Context

{What is the problem motivating this decision or change?}

## Decision

{What is being proposed or done?}

## Alternatives Considered

### {Alternative 1}
- **Pros:** {benefits}
- **Cons:** {drawbacks}

### {Alternative 2}
- **Pros:** {benefits}
- **Cons:** {drawbacks}

## Consequences

### Positive
- {benefit}

### Negative
- {trade-off}

## Related Decisions
- {ADR-NNN: relationship summary}
`,
};

/**
 * ADR テンプレートを生成する
 * @param lang - 言語 (ja|en)
 * @returns テンプレート文字列
 */
export function generateAdrTemplate(lang: Locale): string {
  return ADR_TEMPLATES[lang] ?? ADR_TEMPLATES.ja;
}
