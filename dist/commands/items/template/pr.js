/**
 * items template pr — PR テンプレート生成 (#1836)
 *
 * PR 本文骨格を生成する純粋関数。
 */
/** JA/EN の PR テンプレート文字列マップ */
const PR_TEMPLATES = {
    ja: `## 概要
- {変更内容の箇条書き}

## 関連 Issue
Closes #{issue-number}

## テスト計画
- [ ] {テスト項目}
`,
    en: `## Summary
- {bullet points of changes}

## Related Issue
Closes #{issue-number}

## Test Plan
- [ ] {test item}
`,
};
/**
 * PR テンプレートを生成する
 * @param lang - 言語 (ja|en)
 * @returns テンプレート文字列
 */
export function generatePrTemplate(lang) {
    return PR_TEMPLATES[lang] ?? PR_TEMPLATES.ja;
}
//# sourceMappingURL=pr.js.map