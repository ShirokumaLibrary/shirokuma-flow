/**
 * status transition サブコマンド
 *
 * Issue のステータス遷移を検証付きで実行する。
 * 不正な遷移を防ぎ、ワークフローの整合性を CLI レベルで保証する。
 *
 * - status-workflow.ts の validateTransition と getAllowedTransitions を使用（ADR-v3-022 第二改訂版）
 * - Draft → ToDo 遷移時は Issue をプロジェクトに追加（#2439: 旧 Backlog の後継）
 * - --to Blocked 時は --reason が必須（reason は Issue コメントとして記録）
 * - キャッシュを優先参照し、なければ API フォールバック
 */

import { runGraphQL, parseIssueNumber, isIssueNumber } from "../../../utils/github.js";
import { resolveTargetRepo } from "../../../utils/repo-pairs.js";
import {
  validateTransition,
  getAllowedTransitions,
  STATUS_VALUES,
} from "../../../utils/status-workflow.js";
import { resolveAndUpdateStatus, getIssueDetail, resolvePrAndUpdateStatus } from "../../../utils/issue-detail.js";
import {
  readContextCache,
  writeContextCache,
} from "../../../utils/context-cache.js";
import {
  getProjectId,
} from "../../../utils/project-utils.js";
import {
  getProjectFields,
  addItemToProject,
} from "../../../utils/project-fields.js";
import { getIssueId } from "../../items/helpers.js";
import {
  GRAPHQL_MUTATION_ADD_COMMENT,
  type AddCommentResult,
} from "../../../utils/graphql-queries.js";
import type { Logger } from "../../../utils/logger.js";
import type { ItemsOptions } from "../../items/types.js";
import type { ContextTarget } from "../../issue/context/index.js";
import { checkChildrenAllDone } from "../../../utils/parent-status.js";
import { resolveCurrentStatus } from "../shared/resolve-status.js";

// =============================================================================
// オプション型
// =============================================================================

/** items transition サブコマンドのオプション */
export interface TransitionOptions extends ItemsOptions {
  /** 遷移先ステータス（必須） */
  to: string;
  /**
   * 中間ステータス（オプション）。指定された場合、from → via → to の 2 段階で
   * 遷移を実行する。validateTransition は via への遷移と via からの遷移を
   * 個別に検証する。途中で失敗した場合は via で停止し、エラーを返す。
   *
   * 用途: `ToDo → In progress → Review` のように直接遷移が許可されていない
   * 経路を 1 コマンドで実行する（plan-issue の計画 Issue 完了遷移など）。
   */
  via?: string;
  /** 遷移ルールを無視して強制遷移 */
  force?: boolean;
  /** Blocked 遷移時の reason（必須）。Issue コメントとして記録される。 */
  reason?: string;
  /**
   * ロールバック遷移を許可する（ADR-v3-022 第二改訂版 #2531）。
   * ロールバック遷移テーブルに対して遷移を行う場合に必須。
   */
  rollback?: boolean;
  /**
   * キャッシュを使わずライブから現在ステータスを再取得しキャッシュを更新する（#2683）。
   * 外部で Status が変わってキャッシュが stale な場合に古い値で誤判定するのを防ぐ。
   */
  refresh?: boolean;
}

// =============================================================================
// 返却データ型
// =============================================================================

export interface TransitionResult {
  number: number;
  from: string | null;
  to: string;
  /** 経由した中間ステータス（--via 指定時） */
  via?: string;
  result: "ok" | "error";
  message?: string;
  allowed_transitions?: string[];
  /** --via 使用時、中間遷移失敗箇所（"to_via" or "from_via"） */
  failed_at?: "to_via" | "from_via";
  /** 遷移の種類（forward: 正規前進、rollback: ロールバック）*/
  kind?: "forward" | "rollback";
  /** itemType（自動判定の結果）*/
  item_type?: "issue" | "pr";
}

// =============================================================================
// コマンドエントリポイント
// =============================================================================

/**
 * items transition サブコマンド
 *
 * Issue のステータス遷移を検証付きで実行する。
 */
export async function cmdItemTransition(
  numberStr: string,
  options: TransitionOptions,
  logger: Logger
): Promise<number> {
  if (!isIssueNumber(numberStr)) {
    logger.error("有効なアイテム番号を指定してください");
    return 1;
  }

  if (!options.to) {
    logger.error("--to オプションでステータスを指定してください");
    return 1;
  }

  // Blocked 遷移時は reason 必須（whitespace のみは無効）
  if (options.to === STATUS_VALUES.BLOCKED && !options.reason?.trim()) {
    logger.error(`--to ${STATUS_VALUES.BLOCKED} 遷移には --reason が必須です（例: --reason "外部 API の障害待ち"）`);
    return 2;
  }

  // --via による 2 段階遷移: from → via → to を順次実行する
  // 制限: --via に Blocked は指定不可（reason 管理の複雑化を避ける）。via と to が同一の値も不可。
  if (options.via) {
    if (options.via === STATUS_VALUES.BLOCKED) {
      logger.error("--via に Blocked は指定できません（Blocked 遷移は reason が必須のため、単独で --to Blocked を使用してください）");
      return 2;
    }
    if (options.via === options.to) {
      logger.error("--via と --to は異なるステータスを指定してください");
      return 2;
    }

    const finalTo = options.to;
    const viaStatus = options.via;

    logger.info(`2 段階遷移: ${viaStatus} → ${finalTo}`);

    // Step 1: from → via
    const step1 = await cmdItemTransition(numberStr, { ...options, to: viaStatus, via: undefined }, logger);
    if (step1 !== 0) {
      logger.error(`2 段階遷移失敗: 中間ステータス '${viaStatus}' への遷移に失敗しました`);
      return step1;
    }

    // Step 2: via → to
    const step2 = await cmdItemTransition(numberStr, { ...options, to: finalTo, via: undefined }, logger);
    if (step2 !== 0) {
      logger.error(`2 段階遷移失敗: 最終ステータス '${finalTo}' への遷移に失敗しました（中間ステータス '${viaStatus}' で停止）`);
      return step2;
    }

    return 0;
  }

  const repoInfo = resolveTargetRepo(options);
  if (!repoInfo) {
    logger.error("リポジトリを特定できません");
    return 1;
  }

  const { owner, name: repo } = repoInfo;
  const number = parseIssueNumber(numberStr);
  const targetStatus = options.to;

  // 現在のステータスを取得（Issue または PR を自動判別）
  // --refresh 指定時はキャッシュを信頼せずライブから再取得しキャッシュを更新する（#2683）
  const { status: currentStatus, isPr } = await resolveCurrentStatus(
    owner,
    repo,
    number,
    logger,
    { refresh: options.refresh },
  );

  // itemType を判定（isPr の結果を使用）
  const itemType: "issue" | "pr" = isPr ? "pr" : "issue";

  // 遷移ルールを検証（新 API validateTransition を使用、--force で全バイパス）
  let transitionKind: "forward" | "rollback" | undefined;
  if (!options.force) {
    const validation = validateTransition(itemType, currentStatus, targetStatus, { allowRollback: options.rollback });
    if (!validation.valid) {
      // 許可遷移一覧を新 API で取得（--rollback フラグの有無を考慮）
      const allowed = currentStatus
        ? getAllowedTransitions(itemType, currentStatus, { allowRollback: options.rollback })
        : { forward: [], rollback: [] };
      const allowedTransitions = [...allowed.forward, ...allowed.rollback];

      const result: TransitionResult = {
        number,
        from: currentStatus,
        to: targetStatus,
        result: "error",
        message: validation.error ?? `${currentStatus ?? "(Draft)"} → ${targetStatus} は許可されていません`,
        allowed_transitions: allowedTransitions,
        item_type: itemType,
      };

      logger.error(result.message ?? "遷移が許可されていません");
      console.log(JSON.stringify(result, null, 2));
      return 1;
    }
    transitionKind = validation.kind;
    // ロールバック遷移の場合は警告を出力
    if (validation.kind === "rollback" && validation.warning) {
      logger.warn(validation.warning);
    }
  }

  // 親 Issue の Done 遷移ガード（--to Done かつ Issue のみ、--force で API call ごと省略）
  if (targetStatus === STATUS_VALUES.DONE && !isPr) {
    if (options.force) {
      logger.warn("--force: 子 Issue 未完了ガードをバイパスして強制遷移します");
    } else {
      const check = await checkChildrenAllDone(owner, repo, number);
      if (!check.allDone) {
        const nums = check.openChildren.map((c) => `#${c.number}`).join(", ");
        const errorResult: TransitionResult = {
          number,
          from: currentStatus,
          to: targetStatus,
          result: "error",
          message: `子 Issue ${nums} が未完了です。全子 Issue の完了後に再実行してください（強制する場合は --force）`,
        };
        logger.error(errorResult.message ?? "子 Issue が未完了です");
        console.log(JSON.stringify(errorResult, null, 2));
        return 4;
      }
    }
  }

  // Draft → ToDo 遷移の場合、Issue をプロジェクトに追加（#2439: 旧 Backlog の後継）
  if (!currentStatus && targetStatus === STATUS_VALUES.TODO) {
    const addResult = await addIssueToDraftProject(owner, repo, number, logger);
    if (!addResult) {
      logger.warn("Issue のプロジェクトへの追加に失敗しました。ステータス更新は続行します");
    }
  }

  const updateResult = isPr
    ? await resolvePrAndUpdateStatus(owner, repo, number, targetStatus, logger)
    : await resolveAndUpdateStatus(owner, repo, number, targetStatus, logger);

  if (!updateResult.success) {
    const result: TransitionResult = {
      number,
      from: currentStatus,
      to: targetStatus,
      result: "error",
      message: `ステータスの更新に失敗しました: ${updateResult.reason ?? "unknown"}`,
    };

    logger.error(result.message ?? "ステータス更新に失敗しました");
    console.log(JSON.stringify(result, null, 2));
    return 1;
  }

  // キャッシュを更新
  const cached = readContextCache<ContextTarget>("issues", String(number));
  if (cached) {
    writeContextCache("issues", String(number), { ...cached, status: targetStatus });
  }

  // Blocked 遷移時は reason を Issue コメントとして記録
  if (targetStatus === STATUS_VALUES.BLOCKED && options.reason && !isPr) {
    const subjectId = await getIssueId(owner, repo, number);
    if (subjectId) {
      const body = `**Blocked:** ${options.reason}`;
      await runGraphQL<AddCommentResult>(GRAPHQL_MUTATION_ADD_COMMENT, { subjectId, body });
      logger.info(`Issue #${number}: Blocked reason を記録しました`);
    } else {
      logger.warn(`Issue #${number}: reason コメントの投稿に失敗しました（ID 解決不可）`);
    }
  }

  // ロールバック遷移時は履歴マーカーを付与
  const kindLabel = transitionKind === "rollback" ? "[ROLLBACK] " : "";

  const result: TransitionResult = {
    number,
    from: currentStatus,
    to: targetStatus,
    result: "ok",
    kind: transitionKind,
    item_type: itemType,
  };

  logger.success(`${kindLabel}Issue #${number}: ${currentStatus ?? "(Draft)"} → ${targetStatus}`);
  console.log(JSON.stringify(result, null, 2));
  return 0;
}

/**
 * Issue をプロジェクトに追加する（Draft → ToDo 遷移時、#2439: 旧 Backlog の後継）。
 */
async function addIssueToDraftProject(
  owner: string,
  repo: string,
  issueNumber: number,
  logger: Logger
): Promise<boolean> {
  try {
    // Issue の GraphQL ID を取得
    const issueDetail = await getIssueDetail(owner, repo, issueNumber);
    if (issueDetail?.projectId) {
      // 既にプロジェクトに追加済み
      return true;
    }

    // プロジェクト ID を取得
    const projectId = await getProjectId(owner, repo);
    if (!projectId) {
      logger.warn("プロジェクト ID が見つかりません");
      return false;
    }

    // Issue の GraphQL ID を取得
    const GRAPHQL_QUERY_ISSUE_ID = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) { id }
  }
}
`;
    interface IssueIdResult {
      data?: { repository?: { issue?: { id?: string } } };
    }

    const idResult = await runGraphQL<IssueIdResult>(
      GRAPHQL_QUERY_ISSUE_ID,
      { owner, name: repo, number: issueNumber }
    );

    if (!idResult.success) return false;

    const issueId = idResult.data?.data?.repository?.issue?.id;
    if (!issueId) return false;

    // プロジェクトフィールドを取得
    const projectFields = await getProjectFields(projectId);
    if (!projectFields) return false;

    // Issue をプロジェクトに追加
    const addResult = await addItemToProject(projectId, issueId, logger);
    return addResult !== null;
  } catch {
    return false;
  }
}
