# HostLatch threat model

## Boundary

HostLatch assumes that an AI coding agent, its prompt context, retrieved content, or generated patch may be untrusted. The developer workstation, credentials, Git client, IDE, CI identities, package managers, and later agent sessions carry greater authority.

The protected transition is:

```text
untrusted agent output -> repository artifact -> trusted consumer -> trigger -> host effect
```

The repository is therefore not treated as passive data. Some paths form an execution and authority control plane.

## Security invariants

1. Repository content may describe work, but must not silently grant itself host authority.
2. Control-plane changes are reviewed separately from application-code changes.
3. A scan must not load, import, build, install, or execute repository code.
4. A known command-bearing or boundary-crossing change fails closed.
5. Evidence and decisions are bound to a deterministic manifest identity.
6. Promotion bundles do not follow repository symlinks and verify regular-file hashes after copying.
7. A file without an activation finding is not represented as safe or correct—only as data-plane content under this threat model.

## Protected consumers

HostLatch 0.1 covers Git, AI coding agents, VS Code, npm-compatible package managers, common CI systems, development containers, shell environment managers, and task runners. Coverage is rule-based and intentionally explicit.

## Decisions

- **ALLOW**: no changed trust-handoff surface was detected.
- **REVIEW**: a control-plane surface changed but no known dangerous behavior was proven.
- **BLOCK**: a high- or critical-severity activation path was introduced, changed, escaped the repository, or could not be inspected.

The default CLI fails only on `BLOCK`. CI can use `--fail-on review` for a stricter gate.

## Promotion zones

- `data-plane/` contains changes without a HostLatch finding.
- `quarantine/` contains every path referenced by a finding.
- deleted files are recorded in the inventory but not materialized.
- symlinks are converted into inert text records inside quarantine.

The bundle is evidence for review; it does not automatically apply changes to a trusted checkout.

## Attacker goals considered

- cause a later agent session to execute a hook or gain broader permissions;
- select a host executable through IDE or workspace configuration;
- execute an install/build lifecycle command;
- gain CI tokens, secrets, or a self-hosted runner;
- alter Git behavior through filters, drivers, submodules, or hooks;
- cross the repository boundary through a symlink or development-environment mount;
- hide an activation surface in a nested monorepo package.

## Non-goals in 0.1

- proving that arbitrary application code is benign;
- replacing OS, container, or VM isolation;
- malware, secret, or dependency-vulnerability scanning;
- interpreting every proprietary IDE or agent configuration format;
- automatically executing tests in a repository under review;
- automatically applying promoted changes to a trusted worktree.

These boundaries keep the release deterministic, offline, and safe to run against hostile repositories.
