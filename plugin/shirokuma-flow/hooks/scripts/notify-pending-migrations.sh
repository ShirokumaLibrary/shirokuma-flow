#!/usr/bin/env bash
# セッション開始（起動・再開）で、shirokuma-flow の移行が未処理なら Claude の文脈へ短い文を出す。
#
# - 文は CLI の `shirokuma-flow migrate --check --format text` が決める（固定の文・版の値・打つコマンドだけ）。
#   このスクリプトは移行の手順の文面を出さない。
# - CLI がこのプラグインより古く `migrate` を知らない回だけ、版のずれを 1 行出す（版の値は形を確かめてから入れる）。
# - CLI が無い・プロジェクトの外・タイムアウト・出力が読めない回は何も出さない。どの回も exit 0 で、セッションを止めない。
set -u

command -v shirokuma-flow >/dev/null 2>&1 || exit 0

# 呼び出しごとの待ちの上限（秒）。3 回の合計 4 + 3 + 2 = 9 が hooks.json の timeout（10 秒）に収まるようにする。
run() {
  local limit="$1"
  shift
  if command -v timeout >/dev/null 2>&1; then
    timeout "$limit" "$@"
  else
    "$@"
  fi
}

safe_version() {
  # 版の形（英数字と . + _ -）だけを通す。合わなければ空。
  case "$1" in
    "" | *[!0-9A-Za-z.+_-]*) printf '' ;;
    *) printf '%s' "$1" ;;
  esac
}

out="$(run 4 shirokuma-flow migrate --check --format text 2>/dev/null)"
rc=$?
if [ "$rc" -eq 0 ]; then
  if [ -n "$out" ]; then
    printf '%s\n' "$out"
  fi
  exit 0
fi
# タイムアウト（timeout の終了コード 124）は CLI の新旧を決められないので黙る。
if [ "$rc" -eq 124 ]; then
  exit 0
fi

# migrate を知っている CLI の失敗（プロジェクトの外など）は黙る（--help は JSON でコマンド名を返す）。
# --help 自体が失敗・タイムアウトした回も、CLI が古いとは決められないので黙る。
help="$(run 3 shirokuma-flow --help 2>/dev/null)" || exit 0
if printf '%s' "$help" | grep -Eq '"name"[[:space:]]*:[[:space:]]*"migrate"'; then
  exit 0
fi

cli_version="$(safe_version "$(run 2 shirokuma-flow --version 2>/dev/null | head -n 1 | awk '{print $1}')")"
plugin_version=""
manifest="${CLAUDE_PLUGIN_ROOT:-}/.claude-plugin/plugin.json"
if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ] && [ -f "$manifest" ]; then
  plugin_version="$(safe_version "$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$manifest" | head -n 1)")"
fi

printf 'shirokuma-flow の CLI（%s）がプラグイン（%s）より古く、移行を確かめられません。`shirokuma-flow update` で CLI を上げてください。\n' \
  "${cli_version:-不明}" "${plugin_version:-不明}"
exit 0
