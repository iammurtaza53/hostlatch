# Contributing to HostLatch

Contributions are welcome, especially minimal fixtures for real trust-handoff paths and false positives.

## Development

```bash
git clone https://github.com/iammurtaza53/hostlatch.git
cd hostlatch
npm ci
npm run lint
npm test
```

HostLatch requires Node.js 22.13 or newer and has no runtime dependencies.

## Rule requirements

Every new blocking rule should include:

1. a minimal inert attack fixture;
2. a benign or pre-existing-state counterexample;
3. an explicit trusted consumer, trigger, effect, and remediation;
4. coverage for nested monorepo paths where applicable;
5. no execution, import, install, or build of the scanned content.

Prefer deterministic byte or structure analysis over model calls. Keep evidence concise and avoid copying secrets into manifests.

## Pull requests

- Keep changes focused.
- Explain the trust boundary being protected.
- Run lint and the complete test suite.
- Update the threat model or research comparison when scope changes.

Security vulnerabilities belong in private vulnerability reporting, not public issues.
