# HostLatch contributor guidance

HostLatch is a standalone project. Do not import code or dependencies from the parent Dev Agent Autopilot repository.

For token-efficient sessions, read `README.md` first and open only the source or research document needed for the task. Do not repeat the completed landscape research unless freshness matters. Keep progress updates brief. Before handoff, run `npm run lint` and `npm test` from this directory.

Preserve the core security properties: never execute scanned repository content, compare against a Git base, separate control-plane changes from ordinary code, and make every decision explainable through the activation graph.
