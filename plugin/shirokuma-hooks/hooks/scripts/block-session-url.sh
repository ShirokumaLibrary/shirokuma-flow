#!/bin/bash
set -euo pipefail

# Block Claude session URLs and Claude-Session trailers in worker briefs.
# Used as a PreToolUse hook for the Agent / Task tools (the prompt is the brief).
#
# The commit-style rule "do not leave session URLs in records" takes precedence over a
# harness instruction to append them. Commit messages are checked by `hooks evaluate`
# (Bash), and the shirokuma-flow CLI checks the bodies it writes to GitHub; this hook
# covers the brief, which neither of them sees. There is no setting that turns it off.
#
# Fail-open at THREE MARKED points, the same as block-destructive-commands.sh:
# (1) the CLI is absent, (2) the CLI exits non-zero (an older CLI without the
# `evaluate-session-url` subcommand lands here), (3) the CLI cannot parse its input or its own evaluation throws
# (inside the CLI). All three print the marker "shirokuma-hooks fail-open" on stderr.
# Other agent-to-agent paths (SendMessage and the like) are not checked.
#
# Input: JSON on stdin (Claude Code hook format)
# Output: JSON with permissionDecision (deny) or exit 0 (allow)

if ! SHIROKUMA_CLI="$(command -v shirokuma-flow)"; then
  echo "shirokuma-hooks fail-open: block-session-url: shirokuma-flow was not found on PATH; the agent prompt was allowed WITHOUT evaluation." >&2 || true
  exit 0
fi

if ! "$SHIROKUMA_CLI" hooks evaluate-session-url; then
  echo "shirokuma-hooks fail-open: block-session-url: '$SHIROKUMA_CLI hooks evaluate-session-url' exited non-zero; the agent prompt was allowed WITHOUT a completed evaluation." >&2 || true
  exit 0
fi

exit 0
