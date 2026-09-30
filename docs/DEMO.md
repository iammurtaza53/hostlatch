# Reproducible trust-handoff demo

Run the included offline demonstration:

```bash
npm ci
npm run demo
```

The script creates a temporary Git repository with:

- one ordinary JavaScript change; and
- one harmless but command-bearing `.vscode/tasks.json` change.

HostLatch should produce a `BLOCK` decision, explain the VS Code activation path, and create a promotion bundle in which the JavaScript file is under `data-plane/` and the task definition is under `quarantine/`.

Expected shape:

```text
HostLatch demo decision: BLOCK
Finding: HL-IDE-201 .vscode/tasks.json
Activation: VS Code task runner -> ... -> host command execution
Bundle zones:
  quarantine  .vscode/tasks.json
  data-plane  src/app.js
No fixture command was executed.
```

The temporary files are removed automatically. Use `npm run demo -- --keep` to retain them for manual inspection. The task command is inert demonstration text and is never executed by the script or HostLatch.
