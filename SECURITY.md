# Security policy

## Supported versions

HostLatch is experimental. Security fixes are applied to the latest release on `main`.

## Reporting a vulnerability

Please use GitHub's **Report a vulnerability** button in the Security tab of this repository. Do not open a public issue for a suspected bypass, unsafe filesystem behavior, command execution, or sensitive-data exposure.

Include:

- the affected HostLatch version and operating system;
- the smallest inert reproduction you can provide;
- the expected and observed decision;
- whether a crafted repository can cause HostLatch itself to execute code, follow a link, escape an output directory, or approve an activation path.

You should receive an acknowledgement within seven days. No bug-bounty program is currently offered.

## Scanner safety guarantee

HostLatch must never import, install, build, or execute content from the repository it scans. A report showing otherwise is considered critical.
