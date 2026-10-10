#!/bin/bash
set -euo pipefail

# Block destructive git/GitHub commands via shirokuma-flow CLI.
# Used as a PreToolUse hook for the Bash tool.
#
# Configuration:
#   Rules:   .shirokuma/config.yaml → hooks.allow
#   Default: All rules in blocked-commands.json are active when hooks.allow is unset
#
# The CLI handles:
#   - Reading blocked-commands.json rules
#   - Filtering by hooks.allow in .shirokuma/config.yaml
#   - Stripping quoted strings (false-positive prevention)
#   - Pattern matching and deny JSON output
#
# To allow specific commands, edit .shirokuma/config.yaml:
#   hooks:
#     allow:
#       - pr-merge              # Allow gh pr merge
#       # - force-push          # Allow git push --force
#       # - hard-reset          # Allow git reset --hard
#       # - discard-worktree    # Allow git checkout/restore .
#       # - clean-untracked     # Allow git clean -f
#       # - force-delete-branch # Allow git branch -D
#
# Limitation: commands built through a variable are not detected
# (e.g., cmd="git push --force" && eval "$cmd") - the text is not in the command.
# Quoted arguments are replaced by an opaque single token before matching, so the
# ARGUMENT POSITION survives but its CONTENT does not: a rule that needs the text
# inside the quotes still misses - for example `git push origin "develop"` is allowed
# while `git push origin develop` is denied, because that rule needs the branch name.
# Literal shell wrappers (bash -c '...', eval '...', including path forms such as
# /bin/bash -c '...') are re-evaluated with the same rules; wrappers built from
# variables, and shells launched under another name (busybox -c '...'), are not.
# This hook is also fail-open by design at THREE MARKED points: (1) it exits 0 when the
# CLI is absent (below), (2) it exits 0 when the CLI itself exits non-zero (below), and
# (3) the CLI allows when its own evaluation throws -- that third branch lives in
# the CLI's `hooks evaluate`, not in this file,
# so this script never sees it and cannot record it. The direction stays fail-open on
# purpose (a second-line layer must not stop every Bash call on a checkout without the
# CLI). All three branches announce themselves on stderr with the same marker
# "shirokuma-hooks fail-open", so grepping that marker counts THOSE three paths and none
# of them passes silently. Do not read "two branches in this file" as
# "two paths in total": path (3) is outside this file.
# Do NOT read the count the other way either: THREE is the number of MARKED paths, not
# the number of fail-open paths in this layer. The CLI has further allow paths that carry
# NO marker: it warns and allows when it can resolve no rules at all (that call runs with
# the whole second line of defence off -- heavier than any of the three above), and it
# drops a single rule whose pattern it cannot parse (guardUnknown "pattern-only"). Both
# write to stderr WITHOUT the marker, so "grep the marker" does not count them and must
# not be read as counting every fail-open pass.
# Records go to stderr ONLY: stdout carries the hook JSON contract, and each record
# ends with `|| true` so a closed/broken fd 2 cannot abort the script under `set -e`
# before the explicit `exit 0` (the exit-code contract stays "0 unless deny").
# The second record prints the RESOLVED path of the CLI (from `command -v`) instead of the
# bare name, so a shirokuma-flow shadowed earlier on PATH shows up in the record.
# That does NOT make a shadow observable in general: a replacement that exits 0 with empty
# stdout takes NONE of the three fail-open branches and prints no marker, so it is an
# UNMARKED FOURTH allow path and grepping the marker cannot count it (fail-silent). This
# wrapper does not verify the binary -- no install-root resolution, no checksum, no
# --version probe -- so "grep the marker" only covers the three branches named above.
#
# Input: JSON on stdin (Claude Code hook format)
# Output: JSON with permissionDecision (deny) or exit 0 (allow)

# Fail-open: if shirokuma-flow is not available, allow all commands
if ! SHIROKUMA_CLI="$(command -v shirokuma-flow)"; then
  echo "shirokuma-hooks fail-open: block-destructive-commands: shirokuma-flow was not found on PATH; the Bash command was allowed WITHOUT evaluation." >&2 || true
  exit 0
fi

# Pipe stdin to CLI for evaluation
# CLI outputs deny JSON on match, nothing on allow, and always exits 0
# SHIROKUMA_HOOK_ORIGIN=pretooluse marks the block record as coming from this PreToolUse path
# (record field `origin: "hook"`). Default without it is "manual": tests and hand-typed
# `hooks evaluate` runs are NOT counted as production. A CLI older than this script ignores the
# variable and evaluates as usual; only the record's `origin` field falls back to "manual".
if ! SHIROKUMA_HOOK_ORIGIN=pretooluse "$SHIROKUMA_CLI" hooks evaluate; then
  echo "shirokuma-hooks fail-open: block-destructive-commands: '$SHIROKUMA_CLI hooks evaluate' exited non-zero; the Bash command was allowed WITHOUT a completed evaluation." >&2 || true
  exit 0
fi

exit 0
