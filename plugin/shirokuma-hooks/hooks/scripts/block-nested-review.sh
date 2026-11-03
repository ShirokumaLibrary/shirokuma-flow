#!/bin/bash
set -euo pipefail

# Check the review calls the issue-run worker makes as nested subagents.
# Used as a PreToolUse hook for the Agent / Task / SendMessage tools.
#
# Only calls whose hook input carries `agent_type: issue-run-worker` are judged (rule
# `issue-run-nested-review` in blocked-commands.json). Such a call passes only when the callee
# is one of the four review workers and the prompt is the one-line fixed brief defined in the
# review-flow skill (reference/docs/nested-review-brief.md); a SendMessage passes only as the
# exact R1b continuation. Calls without `agent_type` (the main session) are not affected.
# Inside the CLI the check is fail-closed: an input it cannot read is denied.
#
# Fail-open at TWO MARKED points in this file: (1) the CLI is absent, (2) the CLI exits
# non-zero (an older CLI without the `evaluate-nested-review` subcommand lands here). Both
# print the marker "shirokuma-hooks fail-open" on stderr. Where this hook is not installed,
# the fixed brief is kept by the worker's own discipline only.
#
# Input: JSON on stdin (Claude Code hook format)
# Output: JSON with permissionDecision (deny) or exit 0 (allow)

if ! SHIROKUMA_CLI="$(command -v shirokuma-flow)"; then
  echo "shirokuma-hooks fail-open: block-nested-review: shirokuma-flow was not found on PATH; the call was allowed WITHOUT evaluation." >&2 || true
  exit 0
fi

if ! "$SHIROKUMA_CLI" hooks evaluate-nested-review; then
  echo "shirokuma-hooks fail-open: block-nested-review: '$SHIROKUMA_CLI hooks evaluate-nested-review' exited non-zero; the call was allowed WITHOUT a completed evaluation." >&2 || true
  exit 0
fi

exit 0
