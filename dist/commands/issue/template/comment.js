/**
 * items template comment — コメントテンプレート生成 (#1836)
 *
 * 各種コメント骨格 (review-report|review-response|completion-report|handover) を
 * 生成する純粋関数。
 */
/** JA テンプレート */
const COMMENT_TEMPLATES_JA = {
    "review-report": `# {レビュータイプ} レビューレポート

**日付:** {YYYY-MM-DD}
**レビュアー:** Claude (reviewer agent)
**対象:** {ファイル/ディレクトリパス}
**ロール:** {code|security|testing}

## サマリー

{概要: 2-3文}

### 問題サマリー

| 深刻度 | 件数 |
|--------|------|
| Critical | {n} |
| High | {n} |
| Medium | {n} |
| Low | {n} |
| **合計** | **{n}** |

## 重大な問題

| 問題 | 場所 | 深刻度 | 説明 |
|------|------|--------|------|

## 改善提案

| 問題 | 場所 | 深刻度 | 説明 |
|------|------|--------|------|

## 良い実践

- {ポジティブな発見}

## 推奨事項

1. **即時対応:** {Critical な修正}
2. **マージ前:** {重要な改善}
3. **将来:** {技術的負債}
`,
    "review-response": `## レビュー対応完了

{N} 件のスレッドに対応しました。

| スレッド | タイプ | コミット |
|---------|--------|---------|
| {要約} | コード修正 | {commit-hash} |
| {要約} | 質問 | — |
`,
    "completion-report": `## {動作の名詞}完了

**ブランチ:** {branch-name}
**ステータス:** {status}

### 変更内容
{実装または修正した内容}

### 変更ファイル
- \`path/file.ts\` — {変更内容}
`,
    handover: `## 引き継ぎ

### 作業状態
**Issue:** #{number}
**ブランチ:** {branch-name}
**ステータス:** {status}

### 完了した作業
- {完了項目}

### 残作業
- {未完了項目}

### 注意事項
- {次の作業者への申し送り}
`,
};
/** EN テンプレート */
const COMMENT_TEMPLATES_EN = {
    "review-report": `# {review type} Review Report

**Date:** {YYYY-MM-DD}
**Reviewer:** Claude (reviewer agent)
**Target:** {file/directory path}
**Role:** {code|security|testing}

## Summary

{overview: 2-3 sentences}

### Issue Summary

| Severity | Count |
|----------|-------|
| Critical | {n} |
| High | {n} |
| Medium | {n} |
| Low | {n} |
| **Total** | **{n}** |

## Critical Issues

| Issue | Location | Severity | Description |
|-------|----------|----------|-------------|

## Improvements

| Issue | Location | Severity | Description |
|-------|----------|----------|-------------|

## Good Practices

- {positive finding}

## Recommendations

1. **Immediate:** {Critical fixes}
2. **Before Merge:** {important improvements}
3. **Future:** {technical debt}
`,
    "review-response": `## Review Response Complete

Resolved {N} threads.

| Thread | Type | Commit |
|--------|------|--------|
| {summary} | Code fix | {commit-hash} |
| {summary} | Question | — |
`,
    "completion-report": `## {action noun} Complete

**Branch:** {branch-name}
**Status:** {status}

### Changes
{what was implemented or fixed}

### Changed Files
- \`path/file.ts\` — {description}
`,
    handover: `## Handover

### Work State
**Issue:** #{number}
**Branch:** {branch-name}
**Status:** {status}

### Completed Work
- {completed item}

### Remaining Work
- {incomplete item}

### Notes
- {notes for the next person}
`,
};
/**
 * コメントテンプレートを生成する
 * @param lang - 言語 (ja|en)
 * @param type - コメントタイプ
 * @returns テンプレート文字列
 */
export function generateCommentTemplate(lang, type) {
    const templates = lang === "en" ? COMMENT_TEMPLATES_EN : COMMENT_TEMPLATES_JA;
    return templates[type] ?? templates["completion-report"];
}
//# sourceMappingURL=comment.js.map