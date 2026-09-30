---
title: HostLatch first-party corpus validation
description: Reproducible results and limitations from scanning 12 repositories and 2,359 files with HostLatch.
---

# First-party corpus validation

This report records a HostLatch 0.2.0 snapshot scan performed on 2026-09-30. It is evidence about scanner behavior on a convenience sample, not an independent security certification or a claim that HostLatch detects every malicious path.

## Executive summary

| Measure | Result |
| --- | ---: |
| Repositories | 12 |
| Files inspected | 2,359 |
| Findings | 77 |
| High / medium findings | 2 / 75 |
| Decisions | 2 block, 8 review, 2 allow |
| Manual rule-fit review | 77 of 77 matched documented rule intent |
| Truncated files | 9 ordinary files; no truncated control surfaces |
| Total wall time | 21.4 seconds |
| Median repository time | 1.02 seconds |

The 77 findings are not 77 confirmed vulnerabilities. Seventy-five identify files that a trusted consumer can load later and therefore deserve separate review. The two high-severity matches identify concrete activation patterns: a write-enabled CI deployment workflow and a package installation lifecycle command. Both appeared intentional, but both accurately cross the trust-handoff boundary HostLatch is designed to expose.

## Corpus and privacy

The corpus contains the 12 most recently active, non-fork repositories visible to the repository owner when the run began:

- five public repositories, named and commit-pinned below;
- seven private repositories, represented only by aggregate counts;
- multiple JavaScript, TypeScript, Python, PHP, Kotlin, Vue, SCSS, monorepo, mobile, and web application layouts.

Private repository names, commit identifiers, file paths, contents, and individual findings are not published. The raw private manifests were held only in a temporary local validation directory and deleted after aggregation.

## Method

1. Each repository was cloned at depth one without tags or submodules. Client-side Git hooks were disabled for the clone.
2. `hostlatch scan <path> --snapshot --output <manifest> --fail-on never` compared the current tree with Git's empty tree.
3. HostLatch read Git metadata and file bytes. It did not install dependencies, import modules, build projects, run tests, or execute repository code.
4. Every finding was manually checked against the rule's documented path, evidence, consumer, trigger, and effect.
5. Timings include Node.js startup, scanning, hashing, analysis, and manifest writing.

The per-file Git process fan-out discovered during the first run was fixed before the recorded run. Git index and tree modes are now fetched in batches.

## Public, reproducible subset

| Repository | Pinned commit | Files | Findings | Decision |
| --- | --- | ---: | ---: | --- |
| [dev-agent-autopilot](https://github.com/iammurtaza53/dev-agent-autopilot) | `cb1c6ba71132d82b5f53d1c81127b871f8f566f1` | 73 | 7 | review |
| [iammurtaza53.github.io](https://github.com/iammurtaza53/iammurtaza53.github.io) | `fe42e265e675168413e014bb88dee2aee4c2a0bd` | 31 | 3 | block |
| [hostlatch](https://github.com/iammurtaza53/hostlatch) | `486d51c0ca06d5e8f94366b8208ea3f6d89236e8` | 33 | 3 | review |
| [dev-agent-autopilot-demo](https://github.com/iammurtaza53/dev-agent-autopilot-demo) | `4e35de10fde1f99bf113f3d29904a28e0bc08194` | 10 | 4 | review |
| [n8n-faq-chatbot-langchain](https://github.com/iammurtaza53/n8n-faq-chatbot-langchain) | `91d4830fd1c9da89a5fce0f13b75cdee63f4a416` | 8 | 0 | allow |

Public subset total: 155 files, 17 findings, one block, three review, and one allow decision.

To reproduce a public result after checking out HostLatch v0.2.0:

```bash
git clone https://github.com/iammurtaza53/dev-agent-autopilot.git corpus/dev-agent-autopilot
git -C corpus/dev-agent-autopilot checkout cb1c6ba71132d82b5f53d1c81127b871f8f566f1
node ./bin/hostlatch.js scan corpus/dev-agent-autopilot --snapshot --fail-on never
```

## Private aggregate

The seven anonymized private repositories contributed 2,204 files and 60 findings: one high and 59 medium. Their decisions were one block, five review, and one allow.

## Finding distribution

| Category | Findings |
| --- | ---: |
| Package control plane | 36 |
| Agent control plane | 23 |
| CI control plane | 7 |
| Environment control plane | 6 |
| Git control plane | 4 |
| IDE control plane | 1 |

Manual rule-fit review found no mismatch between a reported finding and its documented rule criteria. This narrow observation must not be presented as 100% vulnerability-detection precision: the review measured whether HostLatch described the intended control surface, not whether the repository was exploitable.

## Performance environment

- Windows NT 10.0.26200
- 11th Gen Intel Core i7-1165G7, 8 logical processors
- Node.js 24.21.0
- Git 2.47.1.windows.1
- default 1 MiB per-file inspection limit

The total recorded wall time was 21.373 seconds. Median repository time was 1.024 seconds; the slowest repository took 7.988 seconds.

## Limitations

- The corpus belongs to one account and is not randomly sampled.
- The author performed the manual review; it was not independent or blinded.
- Snapshot scanning validates baseline coverage but differs from HostLatch's primary task-delta workflow.
- The run did not inject adversarial fixtures, measure recall, compare competing scanners, or test bypass resistance.
- Nine files larger than the inspection limit were hashed as truncated ordinary artifacts. None mapped to a known HostLatch control surface.
- An `allow` decision means no documented HostLatch rule matched. It does not certify a repository as safe.

Machine-readable aggregate results are available in [`validation/2026-09-30.json`](validation/2026-09-30.json).
