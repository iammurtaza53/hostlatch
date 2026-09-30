# Rule catalog

HostLatch rules describe activation paths rather than generic code quality.

| Rule | Default severity | Detects |
| --- | --- | --- |
| `HL-PKG-000` | High | Changed `package.json` that cannot be parsed safely |
| `HL-PKG-101` | High | Added or changed install, prepare, pack, or publish lifecycle command |
| `HL-IDE-201` | High | Added or changed VS Code task execution |
| `HL-IDE-202` | High | Repository-selected IDE executable or automatic-task setting |
| `HL-AGENT-301` | Critical | Agent hook, command, permission bypass, or disabled sandbox |
| `HL-GIT-401` | High | Git filter, driver, or external submodule behavior |
| `HL-CI-501` | High | Privileged event, self-hosted runner, write/identity token, inherited secret, or pipe-to-shell bootstrap |
| `HL-ENV-601` | High | Environment bootstrap, host mount, host networking, or elevated container mode |
| `HL-FS-701` | Critical | Symlink escaping the repository boundary |
| `HL-FS-702` | Medium | Added or changed internal repository symlink |
| `HL-FS-703` | Medium | Newly executable file |
| `HL-SCAN-801` | High | Control-plane file larger than the configured inspection limit |
| `HL-SURFACE-001` | Medium | Changed control-plane artifact without a more specific proven activation |

## Adding a rule

A blocking rule needs an inert malicious fixture and a benign counterexample. Its finding must name the artifact, trusted consumer, activation trigger, host effect, evidence, and remediation. See [CONTRIBUTING.md](../CONTRIBUTING.md).
