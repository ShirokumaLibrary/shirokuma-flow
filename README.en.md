# shirokuma-flow

AI-driven development workflow management CLI. Integrates GitHub Projects / Issues / Discussions with Claude Code skills to manage the plan → implement → review → release cycle from a single CLI. Documentation generation for TypeScript projects ships as a separate binary (`shirokuma-portal`).

[日本語](README.md)

## Installation

```bash
curl -fsSL https://raw.githubusercontent.com/ShirokumaLibrary/shirokuma-flow/main/install.sh | bash
```

This installs `shirokuma-flow` to `~/.local/bin`. Generation (`shirokuma-portal`) and lint (`shirokuma-lint`) ship as separate packages — install them on demand. See the [Getting Started Guide](guide/getting-started.md) for npm/pnpm install methods, prerequisites, and GitHub auth setup.

## Getting Started

> **Prerequisites**: Node.js 20.0.0+, a git repository, and a GitHub remote.

```bash
# 1. Initialize (skills + rules + safety hooks)
cd /path/to/your/project
shirokuma-flow init --with-skills --with-rules --lang en

# 2. Edit .shirokuma/config.yaml (project name, paths)

# 3. Set up the GitHub Project from Claude Code
#    /setting-up-project

# 4. Ask Claude Code to do work
#    /implement-flow #42
```

For full instructions, see the [Getting Started Guide](guide/getting-started.md). For an end-to-end walkthrough, see the [introductory workflow guide](guide/workflows/getting-started-workflow.md).

## Features

| Category | Commands | Role |
|----------|----------|------|
| GitHub management | `issue`, `pr`, `discussion`, `project`, `status` | Operate Issues / PRs / Discussions / Projects V2 in one CLI |
| Checkpoint | `begin`, `submit`, `block`, `resume` | Bundle status transition + assign + comment in a single move |
| Cross-cutting utilities | `dashboard`, `preflight`, `integrity` | Snapshot, session-end fetch, status integrity check |
| Claude Code skills | 30+ | `implement-flow`, `prepare-flow`, `design-flow`, `review-flow`, `commit-issue`, `open-pr-issue`, ... |
| Claude Code rules | 18+ | Git, GitHub, workflow, shirokuma-flow conventions |
| Documentation generation | `shirokuma-portal generate ...` | typedoc / schema / deps / portal / test-cases / feature-map / coverage / etc. |
| Validation | `shirokuma-flow lint ...` / `shirokuma-lint ...` | tests / coverage / docs / code / annotations / structure / workflow / security |
| Management / utilities | `init`, `update`, `repo pairs`, `git`, `hooks`, `skills`, `rules`, `skill` | Project init, plugin management, git helpers |

See the [CLI Quick Reference](guide/reference/cli-quick-reference.md) for the full list and the [Plugin Guide](guide/plugins.md) for skills and rules.

## Binary Layout

shirokuma-flow is split into multiple binaries. `install.sh` only installs `shirokuma-flow`. Add the others when needed.

| Binary | Package | Purpose |
|--------|---------|---------|
| `shirokuma-flow` | `@shirokuma-library/flow` | GitHub workflow management (the main CLI) |
| `shirokuma-portal` | `@shirokuma-library/portal` | Documentation generation |
| `shirokuma-lint` | `@shirokuma-library/lint` | Structural lint for code, docs, tests |
| `shirokuma-md` | `@shirokuma-library/markdown` | LLM-optimized Markdown bundle / lint |
| `shirokuma-codemap` | `@shirokuma-library/codemap` | Codemap extraction (AI system overview) |
| `shirokuma-context` | `@shirokuma-library/context` | Fetch external docs locally |

## Requirements

- **Node.js**: 20.0.0+
- **Claude Code**: Required for skill/rule integration
- **GITHUB_TOKEN**: Required for GitHub commands (`gh auth login` works as fallback)

## Security Note

shirokuma-flow is **recommended for use with private repositories**. Since AI agents process the body of GitHub Issues / PRs / Discussions directly, prompt injection is a real risk in public repositories where untrusted users can edit content. If you must use a public repository, treat untrusted content accordingly.

## Documentation

| Guide | Content |
|-------|---------|
| [Getting Started](guide/getting-started.md) | Install, initialize, GitHub setup |
| [Introductory workflow guide](guide/workflows/getting-started-workflow.md) | First Issue → PR merge end-to-end |
| [Workflow guide](guide/workflows/README.md) | How to instruct the AI (Issue / implementation / review / session / docs) |
| [CLI Quick Reference](guide/reference/cli-quick-reference.md) | Full command list per binary |
| [Configuration Reference](guide/config.md) | Full `.shirokuma/config.yaml` schema |
| [Plugin Guide](guide/plugins.md) | Skills, rules, and hooks management |
| [Troubleshooting](guide/troubleshooting.md) | Common issues and solutions |

## License

Apache License 2.0 (see [LICENSE](LICENSE) / [NOTICE](NOTICE))

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for third-party license information.
