# ShadowReach: change-aware activation reachability

Status: approved research direction; implementation intentionally deferred until 3 October 2026 or later.

Last reviewed: 1 October 2026.

## Executive decision

HostLatch should build **ShadowReach**, a non-executing reverse-reachability engine for latent trust-handoff paths.

Its core question is:

> Can a file changed by an AI coding agent be executed later through a trusted control file that did not change and therefore may be absent from the reviewer's diff?

Example:

```text
changed scripts/bootstrap.js
          ↑ referenced by
unchanged package.json postinstall
          ↑ consumed by
npm install on the trusted host
```

The present scanner correctly finds changed activation-bearing configuration. It can miss the inverse case above because the changed JavaScript file looks like ordinary application code while the activation root is unchanged. ShadowReach closes that specific gap without installing dependencies, importing modules, starting tools, or executing repository content.

This is a defensible product direction, not yet a novelty or state-of-the-art claim. A September 2026 paper on [approval laundering and transitive effects](https://arxiv.org/abs/2609.28586) independently establishes the wider record-to-execution-closure problem and evaluates source-backed effect prediction. HostLatch's narrower hypothesis is that **Git-delta-aware reverse reachability from a changed leaf to an unchanged activation root, coupled to quarantine-first promotion**, is useful and not documented in the closest public scanners reviewed below. That hypothesis must be tested, not advertised as fact.

## Why this direction survived review

Five candidates were considered.

| Candidate | Value | Differentiation | Two-day feasibility | Decision |
| --- | ---: | ---: | ---: | --- |
| Add more pattern rules | 3/5 | 1/5 | 5/5 | Useful maintenance, not a launch feature |
| Capability-delta lockfile | 4/5 | 1/5 | 3/5 | Rejected as headline; SkilLock and Agents Shipgate already occupy this ground |
| Generic proof receipt | 3/5 | 1/5 | 4/5 | Rejected as headline; several proof-carrying change gates already exist |
| Runtime proxy or command interceptor | 4/5 | 1/5 | 2/5 | Rejected; CodeGate, Hydra, sandboxes, and agent hooks cover this category |
| Changed-leaf to unchanged-root activation reachability | 5/5 | 4/5 | 4/5 with a bounded adapter set | Selected as ShadowReach |

The selected feature strengthens HostLatch's existing wedge instead of turning it into another broad agent-security suite.

## Competitive and research boundary

The review used public documentation available on 1 October 2026. An undocumented feature may still exist, and search results are not a legal novelty opinion.

| Project or research | Documented strength | Boundary relevant to ShadowReach |
| --- | --- | --- |
| [CodeGate](https://github.com/jonathansantilli/codegate) | Broad pre-flight configuration discovery, layered static/deep analysis, reversible remediation, and launch wrappers | Public docs do not describe a Git-delta reverse path from an ordinary changed file to an unchanged activation root |
| [AgentGuard](https://github.com/jeromwolf/agentguard) | Host monitoring, hashes, hooks, MCP, secrets, processes, ports, and dependency checks | File-integrity baselines identify change, but do not document causal activation reachability from the changed file |
| [Hydra](https://github.com/enchanter-ai/hydra) | Real-time interception of poisoned configurations and commands | Runtime/session boundary rather than post-agent change-set promotion |
| [SkilLock](https://github.com/skills-lock/skil-lock) | Capability drift and approval for installed Claude/Codex skills | Skill-specific capability delta, not multi-consumer repository activation closure |
| [Agents Shipgate](https://github.com/ThreeMoonsLab/agents-shipgate) | Deterministic capability-delta gate for MCP, OpenAPI, and SDK tool surfaces | Confirms that generic capability delta is not a distinct HostLatch claim |
| [SkillGuard](https://github.com/RudrenduPaul/skillguard) | Skill, hook, bundled-script, and cross-skill privilege analysis | Strong related graph analysis within skill packages; not documented as Git-change reverse reachability across repository consumers |
| [Agent Approval Laundering](https://arxiv.org/abs/2609.28586) | Formalizes transitive effect closure and evaluates source-backed metadata predictions, including referenced scripts | Establishes prior art for the broad problem. ShadowReach must differentiate through change attribution, reverse leaf-to-root evidence, and promotion binding—not claim invention of transitive-effect analysis |

### Claim that is allowed before implementation

> ShadowReach is a planned experiment in change-aware reverse activation reachability for AI-written repositories.

### Claim that is not allowed without evidence

> HostLatch is the first, only, unique, or state-of-the-art transitive-effect scanner.

## Three critique-and-revision passes

### Pass 1: novelty pressure test

Initial idea: normalize capability deltas and attach proof receipts.

Failure: capability drift, effect-bound records, proof receipts, and policy gates already have active implementations and research. A new vocabulary would not create a new security control.

Revision: focus on a concrete blind spot produced by Git review semantics: a dangerous control root can remain unchanged while an agent changes only the file it already references.

### Pass 2: feasibility pressure test

Initial idea: support every package manager, IDE, CI platform, container system, shell, and agent configuration in one release.

Failure: two days is insufficient for trustworthy parsing across all formats. Guessing command semantics would create false assurance.

Revision: release a deliberately bounded engine with exact-reference adapters, explicit `unknown` results, and a versioned coverage table. Unsupported or dynamic paths never become a clean result.

### Pass 3: safety and evidence pressure test

Initial idea: automatically rewrite or neutralize reachable files.

Failure: automatic remediation may break legitimate workflows, and the absence of a statically resolved path does not prove safety.

Revision: ShadowReach remains non-executing and non-mutating. It emits an activation witness, quarantines changed reachable leaves, hash-binds unchanged roots as evidence, and requires human review. Benchmark claims require prespecified fixtures and competing baselines.

## v0.3 implementation slice

Start no earlier than 3 October 2026.

### 1. Build a versioned activation graph

Read the full repository snapshot as inert bytes while using the Git delta only to identify changed leaves. Record concrete nodes and typed edges:

```text
control root --declares-trigger--> command
command --invokes-alias--> command
command --references--> repository artifact
artifact --changed-in--> Git delta
```

Every edge carries a source path, structured field or line locator, content hash, parser version, and confidence (`exact`, `bounded`, or `unknown`).

### 2. Implement only high-confidence adapters

The v0.3 release target is:

1. npm-compatible `package.json` lifecycle and script aliases;
2. VS Code `tasks.json`, including `dependsOn` and folder-open tasks;
3. repository-local Claude Code, Codex, and compatible JSON hook commands;
4. direct local GitHub Actions references (`uses: ./...`) only if the first three adapters meet the test bar early.

Recognize only deterministic local references such as `node scripts/setup.js`, `python tools/check.py`, `./scripts/bootstrap.sh`, and bounded `npm run <name>` alias chains. Shell expansion, computed paths, environment interpolation, globs, and downloaded code return `unknown` unless a sound bounded rule exists.

### 3. Traverse backward from changed leaves

For each changed regular file, deletion, rename, mode change, or symlink:

1. find exact incoming reference edges;
2. follow command aliases toward trusted control roots;
3. stop at configured depth and cycle limits;
4. emit every minimal root-to-leaf path;
5. distinguish changed roots from unchanged roots.

A new blocking finding should be produced when a changed leaf is reachable from a trusted activation root, even when that root is unchanged.

### 4. Emit a ShadowReach witness

Each finding must include:

- changed leaf path and Git status;
- unchanged or changed control root;
- exact activation chain;
- consumer, trigger, and predicted host effect;
- hashes for every artifact in the chain;
- parser/rule version and confidence;
- unresolved dynamic segments, if any;
- remediation that does not imply the repository is otherwise safe.

The promotion bundle quarantines the changed leaf. An unchanged root stays in place but its hash and path are bound into the manifest so later drift invalidates the witness.

### 5. Preserve core invariants

- Never execute, import, install, build, or source scanned content.
- Never follow a repository symlink while resolving a path.
- Resolve every local reference against the repository boundary.
- Fail closed on truncated or malformed activation roots.
- Keep policy outside the scanned repository.
- Label incomplete reachability as `unknown`, never `safe`.

## Prespecified acceptance tests

Implementation is incomplete until these tests pass on Windows and Linux.

### Positive fixtures

- unchanged `postinstall` → changed JavaScript file;
- unchanged `postinstall` → unchanged npm alias → changed file;
- unchanged folder-open VS Code task → changed script;
- unchanged agent hook → changed script;
- unchanged local action root → changed action entry point, if the adapter ships;
- renamed, deleted, executable-mode, and symlinked reachable leaves;
- cycles and maximum-depth chains without hangs;
- quoted paths and paths containing spaces.

### Negative and unknown fixtures

- changed file mentioned only in documentation;
- same basename in an unrelated directory;
- lifecycle root removed in the head revision;
- dynamic environment-variable path reported as `unknown`;
- path escaping the repository blocked separately;
- malformed config fails closed;
- no fixture creates an execution marker during scanning.

### Release thresholds

- 100% detection of the prespecified exact-reference positive fixtures;
- zero false activation paths in the prespecified negative fixtures;
- 100% `unknown` classification for prespecified unresolved dynamic paths;
- deterministic JSON and manifest output across repeated runs;
- zero scanned-content executions, verified with marker fixtures;
- no regression in the existing test suite;
- documented performance on small, medium, and large fixed-SHA repositories.

These thresholds apply only to the declared fixture strata. They are not universal precision or recall claims.

## Benchmark and comparison plan

The existing 12-repository run demonstrates portability and rule fit, not competitive superiority. ShadowReach needs a separate, reproducible benchmark:

1. freeze positive, negative, and unknown fixtures before tuning;
2. publish fixture labels, expected paths, and hashes;
3. add at least 20 public repositories pinned to immutable commits;
4. test current HostLatch, ShadowReach, and safely runnable competitor modes against the same inert fixture set;
5. report detection, false-positive, unknown, timeout, and execution-marker results;
6. publish every command, version, exclusion, and failure;
7. invite independent reruns without treating the absence of external reviewers as success.

Competitor output must be described in its own vocabulary. A missing finding proves only that a tested version and command did not report that fixture; it does not prove the project lacks the capability.

## Two-day build sequence

### Day 1: graph and exact references

- introduce the versioned graph schema;
- parse full-snapshot activation roots without changing delta attribution;
- implement npm script/alias and VS Code task adapters;
- add reverse traversal, cycle/depth controls, and exact source locators;
- land positive, negative, and non-execution fixtures first.

### Day 2: agent hooks and promotion binding

- implement the bounded agent-hook adapter;
- add ShadowReach findings and CLI/JSON rendering;
- hash-bind unchanged activation roots into bundle manifests;
- exercise rename, deletion, symlink, malformed, and dynamic-path cases;
- run Windows/Linux CI and package dry-run checks;
- publish benchmark protocol and an experimental v0.3 prerelease only if the release thresholds pass.

GitHub local actions move to the next release if their parser weakens the test bar. Scope is a security control.

## Stop, ship, and claim gates

### Stop

Stop the release if scanning executes content, reference resolution can escape the root, unknown paths are silently ignored, or output cannot identify the exact activation root and changed leaf.

### Ship as experimental

Ship when the prespecified tests and cross-platform CI pass, the limitations table is complete, and the demo reproduces an unchanged-root/changed-leaf finding in one command.

### Consider a stronger claim later

Only consider “state of the art” after a versioned public benchmark, reproducible competing baselines, meaningful public-repository coverage, enforcement evidence, and independent review. Until then, the honest launch line is:

> HostLatch ShadowReach exposes latent activation paths that a normal diff can hide: an unchanged trusted configuration can still execute the file an AI agent changed.

## Launch assets after implementation

- a 20–30 second deterministic terminal GIF and MP4 showing the hidden path;
- a one-command harmless demo with an execution marker that remains absent;
- a diagram of changed leaf → unchanged root → trusted consumer → host effect;
- benchmark JSON plus a short human report;
- npm package with provenance and an immutable Git tag;
- GitHub Action and SARIF only after their output contracts stabilize;
- one technical launch post centered on the demonstrated blind spot, not generic AI-security language.

## Calendar and directory eligibility

- 1 October 2026: publish this reviewed plan and issue; no feature implementation.
- 3 October 2026 or later: begin the two-day implementation.
- 5–6 October 2026: run and publish the prespecified benchmark, then decide whether v0.3 is releasable.
- 14 October 2026 at 07:13 UTC: earliest age-based eligibility for the `awesome-claude-code` 14-day rule, assuming its rules do not change and the repository shows genuine ongoing work.

Implementing after two days creates legitimate ongoing activity but does **not** itself satisfy a 14-day age rule. The human submission should wait until the date requirement is actually met.
