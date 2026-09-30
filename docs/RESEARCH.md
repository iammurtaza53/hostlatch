# Research and differentiation review

Last reviewed: 1 October 2026. This is a product-landscape review, not a legal novelty, patent, or trademark opinion.

## Conclusion

The **trust-handoff problem is real and useful to address, but AI configuration scanning is not a unique category**. HostLatch should not be promoted as the first scanner for coding-agent configuration.

Its defensible product wedge is narrower:

> Git-delta-aware activation analysis and quarantine-first promotion for files an AI coding agent leaves behind.

HostLatch is worth developing if it continues to strengthen that workflow. A pattern-matching scanner by itself would not justify another project or announcement.

## Evidence for the problem

The Cloud Security Alliance documented cases in which coding agents remained inside their sandbox while writing files later consumed by a trusted host component: IDE task definitions, agent hooks, interpreter paths, and Git configuration. The *Scanning the Harness* study reported confirmed security defects in public agent configurations.

- [Cloud Security Alliance: AI Coding Agent Sandbox Escapes — The Trust Handoff Flaw](https://labs.cloudsecurityalliance.org/research/csa-research-note-ai-coding-agent-sandbox-escapes-20260722-c/)
- [Scanning the Harness: Supply-Chain Defects in AI Coding-Agent Configurations](https://arxiv.org/abs/2609.07360)
- [README Injection: Repository Files Hijacking AI Coding Assistants](https://labs.cloudsecurityalliance.org/wp-content/uploads/2026/03/CSA_research_note_readme_instruction_injection_ai_coding_agents_20260317-csa-styled.pdf)

## Closest public projects found

The following comparison is based on public documentation available at the review date. “Not documented” does not prove that a capability is absent.

| Project | Public focus | Relationship to HostLatch |
| --- | --- | --- |
| [CodeGate](https://github.com/jonathansantilli/codegate) | Pre-flight scanning of MCP, plugin, rule, hook, IDE, symlink, and settings risks; optional deeper analysis and remediation | Strongest direct overlap in detection. HostLatch must differentiate through task-delta attribution, activation graphs, and promotion bundles rather than claim unique scanning coverage. |
| [AgentGuard](https://github.com/jeromwolf/agentguard) | Broad coding-agent monitor covering hooks, MCP, secrets, processes, ports, dependencies, and file-integrity baselines | Broader host monitor; HostLatch is narrower and change-set oriented. |
| [Hydra](https://github.com/enchanter-ai/hydra) | Real-time interception of poisoned configuration and destructive commands | Runtime/session defense; HostLatch addresses post-session review and promotion. |
| [cplt](https://github.com/navikt/cplt) | Kernel-level sandbox with Git/GitHub guards and policy controls | Isolation layer rather than an offline change-set promotion gate. |
| [SkillGuard](https://github.com/RudrenduPaul/skillguard) | Security scanning for third-party agent skills and their bundled hooks/scripts | Specialized skill supply-chain scanner; complementary scope. |
| [SkilLock](https://github.com/skills-lock/skil-lock) | Capability-drift lockfiles and approval for installed Claude/Codex skills | Shows that generic capability-delta gating is already an active category. |
| [Agents Shipgate](https://github.com/ThreeMoonsLab/agents-shipgate) | Deterministic capability-delta merge gate for MCP, OpenAPI, and SDK tool surfaces | Adjacent proof that capability-delta reporting alone is not a distinct HostLatch wedge. |
| [Proof-Carrying Operations](https://github.com/aharwelik/proof-carrying-ops) | Change receipts covering identity, blast radius, rollback, and verification | Generic proof receipts are also not a unique HostLatch claim. |

HostLatch should interoperate with these categories, not pretend they do not exist.

## Design changes made after review

The original “agent activation firewall” idea overlapped too much with existing tool proxies, authorization systems, and configuration scanners. The implemented design was narrowed and then strengthened:

1. **Delta-aware analysis** — compare committed, staged, unstaged, and untracked changes with a selected Git base.
2. **Activation graph** — record artifact → trusted consumer → future trigger → host effect.
3. **Control-plane separation** — keep activation findings separate from ordinary code review.
4. **Non-executing evidence** — never install, import, build, or execute the scanned repository.
5. **Quarantine-first promotion** — materialize ordinary and activation-bearing changes into separate inert zones, with hashes bound to the scan result.

Items 1–4 distinguish the explanation and attribution model. Item 5 turns the project from another report generator into a review workflow.

## Related research

- [CapScope: Authority Is Not a String](https://arxiv.org/abs/2609.08371)
- [AgentSentry: Counterfactual Detection of Prompt Injection](https://arxiv.org/abs/2602.22724)
- [AttriGuard: Attribution-Guided Defense for Agents](https://arxiv.org/abs/2603.10749)
- [Apache Magpie secure coding-agent sandbox RFC](https://cwiki.apache.org/confluence/display/MAGPIE/Design+and+Implementation+of+a+Secure+Coding+Agent+Sandbox)
- [Agent Approval Laundering: Transitive Effects Beyond the Approved Invocation](https://arxiv.org/abs/2609.28586)

The approval-laundering study establishes important prior work for transitive-effect prediction and referenced-script analysis. After reviewing it and the capability-delta projects above, HostLatch rejected generic proof receipts as its next headline. The narrower [ShadowReach plan](SHADOWREACH_PLAN.md) instead tests Git-delta-aware reverse reachability from an agent-changed leaf to an unchanged activation root, with the result bound to quarantine-first promotion. This remains a hypothesis until a reproducible comparison is published.

## Naming review

Google, GitHub, and npm checks rejected **Airlock**, **Code Airlock**, **AgentLatch**, **RepoFuse**, **LatentGuard**, and **AfterAgent** because active projects already used them or occupied the same category.

At the review date, **HostLatch** had no exact GitHub repository-name match and the npm package name was unclaimed. Name availability can change and is not trademark clearance.

## Announcement bar

A responsible announcement should say HostLatch is an experimental open-source approach, not “the first” or “state of the art.” A stronger launch should include:

- a public repository with passing Linux and Windows CI;
- a short reproducible trust-handoff demonstration;
- a real promotion bundle showing data-plane/quarantine separation;
- published limitations and comparison with adjacent projects;
- benchmark fixtures measuring false positives and bypass coverage.
