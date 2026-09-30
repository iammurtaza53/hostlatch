# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) conventions. This project uses semantic versioning.

## [Unreleased]

## [0.2.0] - 2026-09-30

### Added

- `--snapshot` mode for auditing the complete current repository tree against Git's empty tree.
- A documented validation run over 12 repositories and 2,359 files, with pinned public commits and anonymized private-repository aggregates.
- A static project page, robots policy, sitemap, and structured metadata for search discovery.

### Changed

- Batched Git index and tree-mode reads, removing thousands of per-file Git process launches during large snapshot scans.
- Expanded package discovery keywords and documented the difference between control-surface findings and confirmed vulnerabilities.

## [0.1.0] - 2026-09-30

### Added

- Git-delta-aware scanning of committed, staged, unstaged, and untracked changes.
- Detection for agent, IDE, package, Git, CI, development-environment, shell, executable, and symlink activation surfaces.
- Explainable activation graphs and deterministic manifest identities.
- `scan`, `explain`, and quarantine-first `bundle` commands.
- Hash-verified promotion bundles separating data-plane and quarantined changes.
- Offline, zero-runtime-dependency implementation and attack-fixture tests.

[Unreleased]: https://github.com/iammurtaza53/hostlatch/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/iammurtaza53/hostlatch/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/iammurtaza53/hostlatch/releases/tag/v0.1.0
