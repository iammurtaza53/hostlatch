# Delivery roadmap

## Phase 1 — Activation intelligence (implemented)

- Git-delta collection, including committed, staged, unstaged, and untracked files;
- full-snapshot auditing against Git's empty tree;
- control-plane classification and content-aware rules;
- repository-escape and executable-mode detection;
- activation graph, risk decision, and deterministic manifest;
- offline CLI, CI-friendly exit codes, and attack-fixture tests.

## Phase 2A — Quarantine-first bundles (implemented)

- separate changes with activation findings from ordinary data-plane changes;
- materialize both zones without following repository symlinks;
- verify copied regular files against scan-time content hashes;
- preserve deletions, modes, paths, decisions, and evidence in an inventory and manifest.

## Phase 2B — Controlled promotion

- reconstruct approved content in a clean Git worktree;
- bind human approvals to exact manifest and artifact hashes;
- prevent time-of-check/time-of-use drift before applying a promotion;
- support organization policy stored outside the scanned repository.

## Phase 3 — Signed handoff

- sign approval manifests with Sigstore-compatible identities;
- emit SLSA/in-toto-compatible attestations;
- record reviewer, policy version, expiry, and one-time activation nonce;
- add SARIF and reusable GitHub Action output.

## Phase 4 — Enforcement adapters and broader benchmark

- pre-open IDE and agent launch wrappers;
- Git, CI, package-manager, and Dev Agent Autopilot integration;
- public corpus of benign and adversarial trust-handoff fixtures;
- precision, recall, bypass-resistance, and performance reporting against documented baselines.

An initial first-party corpus run is published in [VALIDATION.md](VALIDATION.md). It validates rule fit and scanner behavior on 12 repositories but does not measure recall, bypass resistance, competing tools, or independent review.

## Release bar

HostLatch should not be marketed as state of the art based on architecture alone. That claim requires a versioned benchmark, reproducible results, documented competing baselines, independent review, and demonstrated enforcement—not only detection.
