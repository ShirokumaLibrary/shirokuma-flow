#!/usr/bin/env bash
# AskUserQuestion の直前に、規範 confirmation-style の「書き方」節を Claude の文脈へ足す。
#
# - 文は CLI の `shirokuma-flow hooks evaluate-ask-question` が規範から切り出して返す（hook の JSON）。
#   このスクリプトは規範の文面を持たない。
# - 呼び出しを止めない・許可を広げない（CLI は permissionDecision を返さない）。
# - CLI が無い・CLI がこのサブコマンドを知らない（古い版）・非 0・タイムアウトの回は何も出さない。どの回も exit 0。
set -u

command -v shirokuma-flow >/dev/null 2>&1 || exit 0

# 待ちの上限（秒）。hooks.json の timeout（5 秒）より短いので、上限に達した回も hook の打ち切りの前に黙って終わる。
limit=4
if command -v timeout >/dev/null 2>&1; then
  out="$(timeout "$limit" shirokuma-flow hooks evaluate-ask-question 2>/dev/null)"
else
  out="$(shirokuma-flow hooks evaluate-ask-question 2>/dev/null)"
fi
rc=$?
if [ "$rc" -eq 0 ] && [ -n "$out" ]; then
  printf '%s\n' "$out"
fi
exit 0
