# HostLatch

[![CI](https://github.com/iammurtaza53/hostlatch/actions/workflows/ci.yml/badge.svg)](https://github.com/iammurtaza53/hostlatch/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563eb.svg)](LICENSE)
[![Node.js 22+](https://img.shields.io/badge/node-%3E%3D22.13-16a34a.svg)](package.json)
[![Corpus validation](https://img.shields.io/badge/validated-12_repositories_%C2%B7_2%2C359_files-0f766e.svg)](docs/VALIDATION.md)

**[Website](https://murtazazoaib.com/hostlatch/) · [Try it](#try-it-in-60-seconds) · [Commands](#commands) · [Detection coverage](#detection-coverage) · [CI usage](#ci-usage) · [Related projects](#related-projects)**

**The trust-handoff firewall for AI-written repositories.**

> The agent stayed inside its sandbox. The files it left behind did not.

HostLatch is an offline CLI that finds repository changes which a trusted tool may execute later: agent hooks, MCP commands, IDE tasks, package lifecycle scripts, CI privileges, Git drivers, development-container bootstrap commands, and escaping symlinks.

It is built for developers and teams using Claude Code, Codex, Cursor, GitHub Copilot, Gemini CLI, and other AI coding agents.

![HostLatch — trust-handoff firewall for AI-written repositories](docs/assets/social-preview.png)

## The problem

Coding-agent sandboxes constrain what an agent can execute during a run. They do not automatically make every file written by that agent safe for the host to trust afterward.

```text
agent writes .vscode/tasks.json
          ↓
developer opens the trusted workspace
          ↓
VS Code runs a command outside the agent sandbox
```

The [Cloud Security Alliance documented this trust-handoff class](https://labs.cloudsecurityalliance.org/research/csa-research-note-ai-coding-agent-sandbox-escapes-20260722-c/) across major coding agents. HostLatch turns that boundary into an explicit review gate.

## What makes HostLatch different

HostLatch does not try to replace an agent sandbox, malware scanner, or general SAST product. Its narrow job is to answer:

> Which changes from this agent task can acquire more authority when Git, an IDE, a package manager, CI, a container tool, or another agent consumes them later?

Three mechanisms support that decision:

1. **Git-delta analysis** compares the task with a chosen base, so pre-existing configuration is not misreported as newly introduced authority.
2. **Activation graphs** explain each path as artifact → trusted consumer → future trigger → host effect.
3. **Quarantine-first promotion** splits ordinary changes from activation-bearing changes into an inert, hash-bound bundle.

Several projects scan AI configuration or sandbox live agents. HostLatch complements them by focusing on the post-agent handoff and promotion workflow. See the [research comparison](docs/RESEARCH.md) and the reviewed [ShadowReach plan](docs/SHADOWREACH_PLAN.md) for the next change-aware reachability experiment.

## Try it in 60 seconds

Requires Node.js 22.13 or newer and Git.

```bash
# Run the immutable release directly from GitHub; no global install
npx --yes github:iammurtaza53/hostlatch#v0.2.0 scan /path/to/repository --snapshot

# Or clone it for the demo, development, and repeated local use
git clone https://github.com/iammurtaza53/hostlatch.git
cd hostlatch
npm ci
npm link

# Run a self-contained, harmless trust-handoff demonstration
npm run demo

hostlatch scan /path/to/repository --base main

# Audit every file in the current snapshot, not only a Git delta
hostlatch scan /path/to/repository --snapshot
```

Example result:

```text
HostLatch BLOCK  risk=40/100  manifest=hl_7fa1c3...
Changed files: 8  findings: 1

[HIGH] HL-IDE-201  .vscode/tasks.json
VS Code task execution was introduced or changed
  path: VS Code task runner -> task activation -> host command execution
```

Nothing from the scanned repository is imported, installed, built, or executed.

See the [reproducible demo](docs/DEMO.md) for the fixture and expected result.

## Validation evidence

HostLatch 0.2 was exercised against 12 recently active repositories containing 2,359 tracked files. The scanner produced 77 findings: 75 review-level control surfaces and two high-severity activation patterns. Manual rule-fit review found that all 77 matched the documented rule criteria; this does **not** mean that 77 vulnerabilities were present.

The complete run took 21.4 seconds on the documented Windows test machine after snapshot scanning was optimized to batch Git metadata reads. Results, pinned public commits, privacy treatment, limitations, and reproduction commands are in the [validation report](docs/VALIDATION.md).

## Quarantine a change set

```bash
hostlatch bundle /path/to/repository \
  --base main \
  --output /tmp/hostlatch-review \
  --fail-on never
```

The output is deliberately inert:

```text
hostlatch-review/
├── data-plane/       # changed files with no HostLatch activation finding
├── quarantine/       # control-plane or boundary-crossing changes
├── inventory.json    # status, mode, zone, and content hash
├── manifest.json     # findings plus activation graph
└── README.md         # reviewer instructions
```

“Data plane” does not mean safe or correct; it means no known HostLatch activation surface was detected. Quarantined files must be reviewed before promotion.

## Commands

| Command | Purpose |
| --- | --- |
| `hostlatch scan [path]` | Scan a Git delta or the complete current snapshot |
| `hostlatch bundle [path] --output <dir>` | Split a change set into data-plane and quarantined artifacts |
| `hostlatch explain <manifest.json>` | Explain a stored decision without rescanning |
| `hostlatch --version` | Print the installed version |

Important options:

```text
--base <ref>           Git commit or ref to compare
--snapshot             Compare the complete current tree with an empty tree
--json                 Emit structured JSON
--output <path>        Manifest file or new bundle directory
--fail-on <level>      block (default), review, or never
--max-file-bytes <n>   Per-file inspection limit
```

Exit codes are `0` for allowed/below threshold, `2` for review, `3` for blocked, and `1` for scanner or usage errors.

## Detection coverage

- AI-agent hooks, MCP server commands, permission bypasses, and disabled sandboxes
- VS Code tasks, automatic tasks, interpreters, and executable-path settings
- npm-compatible install, prepare, pack, and publish lifecycle scripts
- Git attributes, external drivers, filters, and submodule changes
- privileged CI triggers, write tokens, identity tokens, inherited secrets, and self-hosted runners
- development-container commands, host mounts, host networking, and privileged modes
- shell environment and task-runner control files
- symlinks that escape the repository boundary
- newly executable files and control files that exceed the inspection limit
- nested package and tool configurations in monorepos

Rules are delta-aware: HostLatch reports newly introduced or changed behavior rather than presenting every existing setting as a new threat.

## CI usage

The reusable [HostLatch Action](https://github.com/iammurtaza53/hostlatch-action) scans pull-request changes, uploads the JSON manifest as an artifact, and then enforces the selected threshold:

```yaml
name: HostLatch

on:
  pull_request:

permissions:
  contents: read

jobs:
  hostlatch:
    runs-on: ubuntu-latest
    steps:
      - name: Check out repository history
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          fetch-depth: 0

      - name: Scan trust-handoff changes
        uses: iammurtaza53/hostlatch-action@v1
        with:
          base: origin/main
          fail-on: review
          output: hostlatch-manifest.json
```

The inputs default to `base: origin/main`, `fail-on: block`, and `output: hostlatch-manifest.json`. The action runs immutable HostLatch v0.2.0 source and uploads `hostlatch-manifest-<job>-<os>` even when a finding reaches the configured threshold. For an immutable workflow dependency, replace `@v1` with the action release commit `@a270e03a83fbeb585fb2b981bfdf130f2d7c3f23`.

For a repository-local installation, the equivalent CLI command is:

```yaml
- name: Scan trust-handoff changes
  run: node ./bin/hostlatch.js scan . --base origin/main --fail-on review --output hostlatch-manifest.json
```

## Security model and limitations

HostLatch is a defense-in-depth control, not proof that a repository is safe. It does not detect every malicious application-code path, replace isolation, scan secrets, or verify dependency integrity. Rule coverage is explicit and incomplete by design.

Read the full [threat model](docs/THREAT_MODEL.md). Please report vulnerabilities through [GitHub private vulnerability reporting](SECURITY.md), not a public issue.

## Project status

HostLatch is an **experimental v0.2 public beta**. The scanner, activation manifest, quarantine bundle, and full-snapshot mode are functional and covered by cross-platform tests. A first-party [12-repository validation run](docs/VALIDATION.md) is published, but it is not a substitute for an independent adversarial benchmark. The [roadmap](docs/ROADMAP.md) defines the release bar for signed approvals, clean-worktree promotion, enforcement adapters, and broader reproducible benchmarks. The next bounded research direction is [ShadowReach](docs/SHADOWREACH_PLAN.md): reverse activation reachability from a changed file to an unchanged trusted control root.

Do not describe HostLatch as “state of the art” until those benchmarks exist.

## Related projects

### Companion project (same author)

- [Dev Agent Autopilot](https://github.com/iammurtaza53/dev-agent-autopilot) takes a task file to a CI-checked pull request: Codex plans, Claude Code implements and runs checks in a background session, and native `codex review` reviews within a diff-based round budget before the workflow stops for a human merge. HostLatch complements that workflow by scanning the resulting branch before merge:

  ```bash
  hostlatch scan . --base origin/main
  ```

### Prior art and adjacent controls

Agent and configuration security:

- [CodeGate](https://github.com/stacklok/codegate) (archived) documented scanning and remediation for AI coding-tool configuration, including MCP servers, plugins, rules, hooks and settings.
- [Snyk Agent Scan](https://github.com/snyk/agent-scan) discovers and assesses agent components such as MCP servers and skills, with optional modes that start or contact servers for deeper analysis.
- [AgentGuard](https://github.com/jeromwolf/agentguard) monitors AI coding-agent activity across hooks, MCP, secrets, processes, ports, dependencies and file integrity.
- [SkillGuard](https://github.com/RudrenduPaul/skillguard) statically analyzes agent skills, manifests, hooks and scripts, including cross-skill privilege chains.

Runtime, CI and supply-chain controls:

- [Hydra](https://github.com/enchanter-ai/hydra) intercepts AI-agent threats such as poisoned configuration and destructive commands at runtime.
- [cplt](https://github.com/navikt/cplt) applies kernel-level sandboxing and Git-aware policy to live coding-agent sessions.
- [zizmor](https://github.com/zizmorcore/zizmor) provides static analysis for CI/CD configurations, including GitHub Actions and Dependabot.
- [Harden-Runner](https://github.com/step-security/harden-runner) monitors CI runner network, file and process activity to reduce software supply-chain risk.

HostLatch does not replace these controls. Its focus is deliberately non-executing and task-delta oriented: it attributes newly changed activation paths to a Git change set, explains the artifact → consumer → trigger → effect chain, and can materialize ordinary and activation-bearing changes into separate hash-bound promotion zones. The [ShadowReach roadmap](docs/SHADOWREACH_PLAN.md) extends this model to changed files that become reachable from unchanged control roots.

## Contributing

New activation paths and bypass fixtures are especially valuable. See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

[MIT](LICENSE)
