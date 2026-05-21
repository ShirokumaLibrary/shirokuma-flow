/**
 * plugin install command - プラグインチャネル切替
 *
 * @description `claude plugin marketplace remove` → `add` の 2 ステップで、
 * stable / prerelease チャネルを安全に切り替える。Decision 3 (#2640) の採用案 B
 * （同 `marketplace.json#name` で切替運用、片方しか登録できない）を
 * CLI 経由で実行することで、`claude plugin marketplace add` の silent overwrite
 * をユーザーが直接踏まずに済むようにする。
 *
 * marketplace 切替後、切替前に enabled だったプラグインは Claude Code 側の
 * enabledPlugins エントリから消えるため、`/reload-plugins` だけでは復元されない。
 * そこで remove より前に `claude plugin list` で enabled プラグイン（名前・scope）を
 * 保存し、add 成功後に同じ marketplace から各プラグインを再 install することで、
 * 手動 install なしで切替直後から全プラグインがロードされる状態にする (#2681)。
 *
 * @example
 * ```bash
 * # stable チャネル (ShirokumaLibrary/shirokuma-plugins)
 * shirokuma-flow plugin install
 *
 * # prerelease チャネル (ShirokumaDevelopment/shirokuma-plugins)
 * shirokuma-flow plugin install --prerelease
 *
 * # ドライラン
 * shirokuma-flow plugin install --prerelease --dry-run
 * ```
 */

import { spawnSync } from "node:child_process";

const STABLE_REPO = "ShirokumaLibrary/shirokuma-plugins";
const PRERELEASE_REPO = "ShirokumaDevelopment/shirokuma-plugins";
const MARKETPLACE_ID = "shirokuma-library";

/**
 * 注入可能な claude CLI ランナー。引数は `claude` の後続引数（例: ["plugin","list"]）。
 * テスト時にはモックを注入して実環境を変更せずに呼び出しを検証する。
 */
export type ClaudeRunner = (args: string[]) => {
  status: number | null;
  stdout: string;
  stderr: string;
};

/** 切替前に enabled だったプラグイン（再 install の復元対象） */
export interface EnabledPlugin {
  /** プラグイン名（例: "shirokuma-skills-ja"） */
  name: string;
  /** scope（"user" | "project" | "local"） */
  scope: string;
}

export interface PluginInstallOptions {
  prerelease?: boolean;
  dryRun?: boolean;
}

export interface PluginInstallResult {
  channel: "stable" | "prerelease";
  repo: string;
  removedExisting: boolean;
  added: boolean;
  dryRun: boolean;
  /** 再 install に成功したプラグイン名 */
  reinstalled: string[];
}

/** spawnSync ベースの既定 ClaudeRunner */
const defaultRunner: ClaudeRunner = (args) =>
  spawnSync("claude", args, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf-8" });

/**
 * `claude plugin list` の出力から、指定 marketplaceId かつ Status が enabled の
 * プラグインを出現順に抽出する純粋関数。
 *
 * 入力形式:
 * ```
 *   ❯ <plugin-name>@<marketplace-id>
 *     Version: <version>
 *     Scope: <user|project|local>
 *     Status: ✔ enabled        (または ✘ disabled)
 * ```
 *
 * `❯ name@marketplace` 行でプラグインを区切り、直後の `Scope:` / `Status:` 行から
 * scope と enabled/disabled を読み取る。enabled 判定は "enabled" 文字列の有無で行い、
 * ✔/✘ の unicode には依存しない。
 *
 * @param listOutput `claude plugin list` の標準出力
 * @param marketplaceId 抽出対象の marketplace ID
 * @returns 対象 marketplace の enabled プラグイン（出現順）
 */
export function parseEnabledPlugins(listOutput: string, marketplaceId: string): EnabledPlugin[] {
  const lines = listOutput.split("\n");
  const result: EnabledPlugin[] = [];

  // プラグインヘッダ行: 先頭装飾（❯ 等）を許容しつつ name@marketplace を抽出
  const headerRe = /^\s*(?:\S+\s+)?([^\s@]+)@(\S+)\s*$/;

  for (let i = 0; i < lines.length; i++) {
    const header = headerRe.exec(lines[i] ?? "");
    if (!header) continue;
    const [, name, marketplace] = header;
    if (marketplace !== marketplaceId) continue;

    // 次のヘッダ行が現れるまでを当該プラグインのブロックとして scope / status を探す
    let scope = "";
    let enabled = false;
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j] ?? "";
      if (headerRe.test(line)) break;
      const scopeMatch = /^\s*Scope:\s*(\S+)/.exec(line);
      if (scopeMatch) scope = scopeMatch[1];
      if (/^\s*Status:.*\benabled\b/.test(line)) enabled = true;
    }

    if (enabled) result.push({ name, scope });
  }

  return result;
}

/**
 * プラグインの配信チャネルを切り替え、切替前に enabled だったプラグインを再 install する。
 *
 * @param options チャネル / dry-run オプション
 * @param runner テスト用に注入可能な claude ランナー（省略時は spawnSync ベースの既定）
 * @returns 終了コード（0=成功）
 */
export function pluginInstallCommand(
  options: PluginInstallOptions,
  runner: ClaudeRunner = defaultRunner
): number {
  const channel: "stable" | "prerelease" = options.prerelease ? "prerelease" : "stable";
  const repo = options.prerelease ? PRERELEASE_REPO : STABLE_REPO;
  const dryRun = options.dryRun === true;

  console.log(`プラグインチャネル: ${channel}`);
  console.log(`配信元: ${repo}`);
  if (dryRun) console.log("(dry-run モード)");
  console.log();

  // 1. remove より前に enabled プラグインを保存（remove で enabledPlugins が消えるため順序が重要）
  const listResult = runner(["plugin", "list"]);
  const enabledPlugins =
    listResult.status === 0 ? parseEnabledPlugins(listResult.stdout, MARKETPLACE_ID) : [];

  if (dryRun) {
    console.log(`  [dry-run] claude plugin marketplace remove ${MARKETPLACE_ID}`);
    console.log(`  [dry-run] claude plugin marketplace add ${repo}`);
    if (enabledPlugins.length > 0) {
      console.log();
      console.log("  [dry-run] 再 install 予定:");
      for (const p of enabledPlugins) {
        console.log(`    - ${p.name}@${MARKETPLACE_ID} (--scope ${p.scope})`);
      }
    }
    console.log();
    console.log(`[dry-run] ${channel} チャネルへの切替は実行されませんでした`);
    return 0;
  }

  // 2. 既存 marketplace を remove
  console.log(`既存 marketplace を remove: ${MARKETPLACE_ID}`);
  const removeResult = runner(["plugin", "marketplace", "remove", MARKETPLACE_ID]);
  const removedExisting = removeResult.status === 0;
  if (removedExisting) {
    console.log(`  ✓ remove 完了`);
  } else {
    const stderr = removeResult.stderr.trim();
    console.log(`  (既存なし or remove スキップ${stderr ? `: ${stderr}` : ""})`);
  }
  console.log();

  // 3. 新 marketplace を add（失敗したら再 install せず終了）
  console.log(`新 marketplace を add: ${repo}`);
  const addResult = runner(["plugin", "marketplace", "add", repo]);
  if (addResult.status !== 0) {
    const stderr = addResult.stderr.trim();
    console.error(`  ✗ add 失敗${stderr ? `: ${stderr}` : ""}`);
    return 1;
  }
  console.log(`  ✓ add 完了`);
  console.log();

  // 4. 切替前に enabled だったプラグインを再 install（個別失敗は警告にとどめ継続）
  const reinstalled: string[] = [];
  const failed: string[] = [];
  if (enabledPlugins.length > 0) {
    console.log(`切替前に enabled だった ${enabledPlugins.length} 件のプラグインを再 install:`);
    for (const p of enabledPlugins) {
      const target = `${p.name}@${MARKETPLACE_ID}`;
      const installResult = runner(["plugin", "install", target, "--scope", p.scope]);
      if (installResult.status === 0) {
        console.log(`  ✓ ${target} (--scope ${p.scope})`);
        reinstalled.push(p.name);
      } else {
        const stderr = installResult.stderr.trim();
        console.warn(`  ⚠ ${target} の再 install に失敗${stderr ? `: ${stderr}` : ""}`);
        failed.push(p.name);
      }
    }
    console.log();
    console.log(`  再 install: 成功 ${reinstalled.length} 件 / 失敗 ${failed.length} 件`);
    if (failed.length > 0) {
      console.log(`  失敗したプラグインは手動で再 install してください: ${failed.join(", ")}`);
    }
    console.log();
  }

  console.log(`✅ ${channel} チャネルに切り替えました`);
  console.log(`   反映: 新しいセッション or /reload-plugins`);
  console.log(`   確認: claude plugin marketplace list`);

  const result: PluginInstallResult = {
    channel,
    repo,
    removedExisting,
    added: true,
    dryRun: false,
    reinstalled,
  };
  if (process.env["SHIROKUMA_JSON_OUTPUT"] === "1") {
    console.log(JSON.stringify(result, null, 2));
  }

  return 0;
}
