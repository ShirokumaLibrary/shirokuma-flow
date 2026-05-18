/**
 * plugin install command - プラグインチャネル切替
 *
 * @description `claude plugin marketplace remove` → `add` の 2 ステップで、
 * stable / prerelease チャネルを安全に切り替える。Decision 3 (#2640) の採用案 B
 * （同 `marketplace.json#name` で切替運用、片方しか登録できない）を
 * CLI 経由で実行することで、`claude plugin marketplace add` の silent overwrite
 * をユーザーが直接踏まずに済むようにする。
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
}

export function pluginInstallCommand(options: PluginInstallOptions): number {
  const channel: "stable" | "prerelease" = options.prerelease ? "prerelease" : "stable";
  const repo = options.prerelease ? PRERELEASE_REPO : STABLE_REPO;
  const dryRun = options.dryRun === true;

  console.log(`プラグインチャネル: ${channel}`);
  console.log(`配信元: ${repo}`);
  if (dryRun) console.log("(dry-run モード)");
  console.log();

  if (dryRun) {
    console.log(`  [dry-run] claude plugin marketplace remove ${MARKETPLACE_ID}`);
    console.log(`  [dry-run] claude plugin marketplace add ${repo}`);
    console.log();
    console.log(`[dry-run] ${channel} チャネルへの切替は実行されませんでした`);
    return 0;
  }

  console.log(`既存 marketplace を remove: ${MARKETPLACE_ID}`);
  const removeResult = spawnSync(
    "claude",
    ["plugin", "marketplace", "remove", MARKETPLACE_ID],
    { stdio: ["ignore", "pipe", "pipe"], encoding: "utf-8" }
  );
  const removedExisting = removeResult.status === 0;
  if (removedExisting) {
    console.log(`  ✓ remove 完了`);
  } else {
    const stderr = removeResult.stderr?.trim() ?? "";
    console.log(`  (既存なし or remove スキップ${stderr ? `: ${stderr}` : ""})`);
  }
  console.log();

  console.log(`新 marketplace を add: ${repo}`);
  const addResult = spawnSync(
    "claude",
    ["plugin", "marketplace", "add", repo],
    { stdio: ["ignore", "pipe", "pipe"], encoding: "utf-8" }
  );
  if (addResult.status !== 0) {
    const stderr = addResult.stderr?.trim() ?? "";
    console.error(`  ✗ add 失敗${stderr ? `: ${stderr}` : ""}`);
    return 1;
  }
  console.log(`  ✓ add 完了`);
  console.log();

  console.log(`✅ ${channel} チャネルに切り替えました`);
  console.log(`   確認: claude plugin marketplace list`);

  const result: PluginInstallResult = {
    channel,
    repo,
    removedExisting,
    added: true,
    dryRun: false,
  };
  if (process.env["SHIROKUMA_JSON_OUTPUT"] === "1") {
    console.log(JSON.stringify(result, null, 2));
  }

  return 0;
}
