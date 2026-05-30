/**
 * GitHub item lint 共通入力型
 *
 * github-item-comment-first / github-item-body-history ルールが共有する純粋関数の入力型。
 * fetcher（非純粋層）が GraphQL から組み立て、各ルールの validate*（純粋層）が受け取る。
 *
 * 「本文＝最新 payload / コメント＝Why」原則の機械検査に必要な最小フィールドのみを保持する。
 */

import { ADR_CATEGORY } from "../commands/adr/create.js";

/**
 * lint 対象アイテムのコメント（最小フィールド）
 */
export interface GitHubItemLintComment {
  /** コメント本文 */
  body: string;
  /** 作成日時（ISO 8601） */
  createdAt: string;
}

/**
 * lint 対象の GitHub アイテム（Issue / PR / Discussion）
 */
export interface GitHubItemLintInput {
  /** アイテム番号 */
  number: number;
  /** 種別 */
  type: "issue" | "pull" | "discussion";
  /** Discussion カテゴリ名（Discussion のみ。Issue/PR では undefined） */
  category?: string;
  /** 本文 */
  body: string;
  /** 最終更新日時（ISO 8601） */
  updatedAt: string;
  /** 作成日時（ISO 8601） */
  createdAt: string;
  /**
   * コメント（古い順。GraphQL の comments(first: 100) が CREATED_AT 昇順で返すため
   * comments[0] が最古コメントである前提）
   */
  comments: GitHubItemLintComment[];
  /** コメント総数（first: 100 のページングを考慮した totalCount） */
  totalCommentCount: number;
}

/**
 * github-item-* 両ルール共通の種別免除判定（設計 #2821 設計判断 5）。
 *
 * - Issue / PR → 両ルールとも対象（免除しない）
 * - Discussion かつ category === "ADR" → 両ルール対象外（本文 = Why payload のため）
 * - Discussion かつ category !== "ADR" → 両ルール対象（免除しない）
 *
 * comment-first / body-history の双方が参照する単一正本。重複定義しないこと。
 *
 * @param type   アイテム種別
 * @param category Discussion カテゴリ名（Discussion のみ。Issue/PR では undefined）
 * @returns 免除する場合 true
 */
export function isExemptFromGitHubItemChecks(
  type: GitHubItemLintInput["type"],
  category?: string
): boolean {
  return type === "discussion" && category === ADR_CATEGORY;
}
