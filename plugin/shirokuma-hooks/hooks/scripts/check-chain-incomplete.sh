#!/bin/bash
set -euo pipefail

# Prevent premature stop when workflow chain steps are incomplete.
# Used as a Stop hook to enforce chain autonomous progression.
#
# The CLI handles:
#   - Reading transcript JSONL to find the latest TodoWrite list (the only shape it reads;
#     with no such list the stop is allowed -- fail-open)
#   - Detecting incomplete chain steps (pending/in_progress)
#   - Outputting block JSON when chain is incomplete
#   - Continuation cap: consecutive blocks with the same incomplete-task set are counted
#     per prompt in a state file outside the worktree, and the stop is allowed after 3;
#     when the state cannot be kept it falls back to the stop_hook_active check (1 block)
#
# This hook is fail-open by design at THREE MARKED points: (1) it exits 0 when the CLI
# is absent (below), (2) it exits 0 when the CLI itself exits non-zero (below), and
# (3) the CLI allows when its own evaluation throws -- that third branch lives in
# the CLI's `hooks evaluate-stop`, NOT in `hooks evaluate`, and not
# in this file, so this script
# never sees it and cannot record it. The direction stays fail-open on
# purpose (a fail-closed Stop hook would keep blocking and the session could never
# end). All three branches announce themselves on stderr with the same marker
# "shirokuma-hooks fail-open", so grepping that marker counts THOSE three paths and none
# of them passes silently. Do not read "two branches in this file" as
# "two paths in total": path (3) is outside this file.
# CAVEAT on path (3): the marker on path (3) is emitted by the CLI, so a CLI older than
# the one that emits it still passes silently on path (3). Nothing here gates the CLI version.
# Do NOT read the count the other way either: THREE is the number of MARKED paths, not
# the number of fail-open paths in this layer. Note that the two UNMARKED CLI paths named
# in the PreToolUse wrapper (block-destructive-commands.sh) -- "no rules resolved at all"
# and the guardUnknown "pattern-only" drop -- DO NOT EXIST here: `hooks evaluate-stop`
# never reads blocked-commands.json, so it has no rule resolution and no pattern parsing.
# What it does have are EARLY RETURNS that allow without any marker: empty stdin,
# unparsable JSON, a running background subagent, the continuation cap, stop_hook_active
# (only when the continuation state cannot be kept), a missing transcript_path, and a
# transcript from which no Tasks can be read. Those are ordinary "nothing to block" outcomes rather than
# failures, but they are indistinguishable on stderr from a completed evaluation, so
# "grep the marker" does not count them either.
# Records go to stderr ONLY: stdout carries the hook JSON contract, and each record
# ends with `|| true` so a closed/broken fd 2 cannot abort the script under `set -e`
# before the explicit `exit 0` (the exit-code contract stays "0 unless block").
# The second record prints the RESOLVED path of the CLI (from `command -v`) instead of the
# bare name, so a shirokuma-flow shadowed earlier on PATH shows up in the record.
# That does NOT make a shadow observable in general: a replacement that exits 0 with empty
# stdout takes NONE of the three fail-open branches and prints no marker, so it is an
# UNMARKED FOURTH allow path and grepping the marker cannot count it (fail-silent). This
# wrapper does not verify the binary -- no install-root resolution, no checksum, no
# --version probe -- so "grep the marker" only covers the three branches named above.
#
# Input: JSON on stdin (Claude Code Stop hook format)
# Output: JSON with decision: "block" or exit 0 (allow stop)

# Fail-open: if shirokuma-flow is not available, allow stop
if ! SHIROKUMA_CLI="$(command -v shirokuma-flow)"; then
  echo "shirokuma-hooks fail-open: check-chain-incomplete: shirokuma-flow was not found on PATH; the stop was allowed WITHOUT evaluation." >&2 || true
  exit 0
fi

# Pipe stdin to CLI for evaluation
# CLI outputs block JSON on incomplete chain, nothing on allow, and always exits 0
if ! "$SHIROKUMA_CLI" hooks evaluate-stop; then
  echo "shirokuma-hooks fail-open: check-chain-incomplete: '$SHIROKUMA_CLI hooks evaluate-stop' exited non-zero; the stop was allowed WITHOUT a completed evaluation." >&2 || true
  exit 0
fi

exit 0
