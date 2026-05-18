/**
 * items コマンド共通型定義 (#1776, #1814)
 */

import type { OutputFormat } from "../../utils/formatters.js";

// =============================================================================
// Options
// =============================================================================

/** items コマンドの共通オプション */
export interface ItemsOptions {
  verbose?: boolean;
  /** 公開リポジトリを対象 (repoPairs 設定から) */
  public?: boolean;
  /** クロスリポジトリのエイリアス (crossRepos 設定から) */
  repo?: string;
}

/** items list サブコマンドのオプション */
export interface ListOptions extends ItemsOptions {
  all?: boolean;
  status?: string[];
  state?: string;
  labels?: string[];
  limit?: number;
  format?: OutputFormat;
  issueType?: string;
}

/** items comments サブコマンドのオプション */
export interface CommentsOptions extends ItemsOptions {
  format?: OutputFormat;
}

/** items search サブコマンドのオプション */
export interface SearchOptions extends ItemsOptions {
  query?: string;
  state?: string;
  limit?: number;
  format?: OutputFormat;
  /** 検索対象タイプ: issues, discussions (カンマ区切り) (#1818) */
  type?: string;
  /** Discussions カテゴリフィルタ (#1818) */
  category?: string;
}

/** items import サブコマンドのオプション */
export interface ImportOptions extends ItemsOptions {
  fromPublic?: string;
  fieldStatus?: string;
  priority?: string;
  size?: string;
  syncPublic?: boolean;
}

/** items fields サブコマンドのオプション */
export interface FieldsOptions extends ItemsOptions {}

/** items remove サブコマンドのオプション */
export interface RemoveOptions extends ItemsOptions {}

/** items sub-list サブコマンドのオプション */
export interface SubListOptions extends ItemsOptions {}

/** items pull サブコマンドのオプション */
export interface PullOptions extends ItemsOptions {
  dir?: string;
}

/** items push サブコマンドのオプション */
export interface PushOptions extends ItemsOptions {
  force?: boolean;
}

/** items check サブコマンドのオプション */
export interface CheckOptions extends ItemsOptions {
  dir?: string;
}

/** items add comment サブコマンドのオプション */
export type AddCommentOptions = ItemsOptions;

/** items add issue サブコマンドのオプション */
export type AddIssueOptions = ItemsOptions;

/** items add discussion サブコマンドのオプション */
export type AddDiscussionOptions = ItemsOptions;

// =============================================================================
// Shared data types
// =============================================================================

/** pull/check で取得した GitHub アイテムのスナップショット */
export interface RemoteItemSnapshot {
  number: number;
  type: "issue" | "pull_request" | "discussion";
  title: string;
  body: string;
  updated_at: string;
  status?: string;
  priority?: string;
  size?: string;
  labels?: string[];
  assignees?: string[];
  /** 親 Issue 番号（Issue のみ） */
  parent?: number;
  /** サブ Issue の要約（Issue のみ） */
  subIssuesSummary?: {
    total: number;
    completed: number;
    percentCompleted: number;
  };
}

/** フロントマターから読み取ったローカルアイテムのスナップショット */
export interface LocalItemSnapshot {
  number: number;
  type: "issue" | "pull_request" | "discussion";
  title?: string;
  status?: string;
  priority?: string;
  size?: string;
  labels?: string[];
  updated_at?: string;
  cached_at?: string;
  /** ローカルファイルの Markdown 本文 */
  body: string;
}

/** check の差分結果 */
export interface DiffField {
  field: string;
  local: unknown;
  remote: unknown;
}

/** check の出力エントリ */
export interface CheckResult {
  number: number;
  type: "issue" | "pull_request" | "discussion";
  changed: boolean;
  diffs: DiffField[];
  cache_file: string;
}

/** list で取得した Issue + Projects フィールドのスナップショット */
export interface IssueWithProjects {
  number: number;
  title: string;
  body?: string;
  url: string;
  state: string;
  issueType?: string;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  projectItemId?: string;
  status?: string;
  priority?: string;
  size?: string;
}
