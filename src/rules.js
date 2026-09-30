import path from 'node:path';
import { compactEvidence, isInside, normalizeRepoPath } from './util.js';

const LIFECYCLE_SCRIPTS = new Set([
  'preinstall',
  'install',
  'postinstall',
  'prepare',
  'prepublish',
  'prepublishOnly',
  'postpublish',
]);

function finding(change, details) {
  return {
    ruleId: details.ruleId,
    severity: details.severity,
    category: details.category,
    title: details.title,
    path: change.path,
    status: change.status,
    consumer: details.consumer,
    trigger: details.trigger,
    effect: details.effect,
    evidence: (details.evidence || []).map((value) => compactEvidence(value)).filter(Boolean),
    recommendation: details.recommendation,
  };
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function collectRegexSignals(text, expressions) {
  const signals = [];
  const lines = String(text || '').split(/\r?\n/);
  for (const line of lines) {
    for (const expression of expressions) {
      expression.lastIndex = 0;
      if (expression.test(line)) {
        signals.push(line.trim());
        break;
      }
    }
  }
  return [...new Set(signals.filter(Boolean))];
}

function newlyIntroducedSignals(change, expressions) {
  const before = new Set(collectRegexSignals(change.baseContent, expressions));
  return collectRegexSignals(change.content, expressions).filter((signal) => !before.has(signal));
}

function surfaceFor(file) {
  const lower = file.toLowerCase();
  const basename = path.posix.basename(lower);
  const inDirectory = (directory) => lower.startsWith(`${directory}/`) || lower.includes(`/${directory}/`);

  if (
    basename === '.gitattributes' ||
    lower === '.gitmodules' ||
    basename === '.gitconfig' ||
    lower.includes('/.git/hooks/')
  ) {
    return {
      category: 'git-control-plane',
      consumer: 'Git',
      trigger: 'Git operation on the trusted host',
      effect: 'Repository-controlled Git behavior',
    };
  }

  if (
    inDirectory('.claude') ||
    inDirectory('.codex') ||
    inDirectory('.gemini') ||
    inDirectory('.cursor') ||
    ['agents.md', 'claude.md', '.mcp.json', 'mcp.json'].includes(basename) ||
    basename === 'copilot-instructions.md'
  ) {
    return {
      category: 'agent-control-plane',
      consumer: 'AI coding agent',
      trigger: 'A later agent session opens the repository',
      effect: 'Repository instructions, permissions, hooks, or tools influence an agent',
    };
  }

  if (
    inDirectory('.vscode') ||
    lower.includes('/.idea/runconfigurations/') ||
    lower.endsWith('.code-workspace')
  ) {
    return {
      category: 'ide-control-plane',
      consumer: 'Developer IDE',
      trigger: 'The repository is opened or a task is launched',
      effect: 'Repository-controlled IDE settings or commands run on the host',
    };
  }

  if (
    basename === 'package.json' ||
    basename === '.npmrc' ||
    basename === '.yarnrc' ||
    basename === '.yarnrc.yml' ||
    basename === 'pyproject.toml' ||
    basename === 'setup.py' ||
    basename === 'setup.cfg' ||
    basename === 'pip.conf' ||
    basename === 'pom.xml' ||
    lower.endsWith('.gradle') ||
    lower.endsWith('.gradle.kts')
  ) {
    return {
      category: 'package-control-plane',
      consumer: 'Package or build tool',
      trigger: 'Dependency installation or build',
      effect: 'Repository-controlled lifecycle or build logic runs on the host',
    };
  }

  if (
    lower.startsWith('.github/workflows/') ||
    lower === '.gitlab-ci.yml' ||
    lower === 'jenkinsfile' ||
    lower === 'azure-pipelines.yml' ||
    lower === 'bitbucket-pipelines.yml'
  ) {
    return {
      category: 'ci-control-plane',
      consumer: 'CI/CD runner',
      trigger: 'A CI event runs the changed pipeline',
      effect: 'Repository-controlled automation receives runner authority and secrets',
    };
  }

  if (
    inDirectory('.devcontainer') ||
    basename === 'devcontainer.json' ||
    basename === 'dockerfile' ||
    lower.includes('docker-compose') ||
    lower.includes('compose.yml') ||
    lower.includes('compose.yaml')
  ) {
    return {
      category: 'environment-control-plane',
      consumer: 'Container or development environment',
      trigger: 'The environment is built or opened',
      effect: 'Repository-controlled commands, mounts, or privileges affect the host',
    };
  }

  if (
    basename === '.envrc' ||
    basename === '.mise.toml' ||
    basename === '.tool-versions' ||
    basename === 'makefile' ||
    basename === 'justfile' ||
    basename === 'taskfile.yml' ||
    basename === 'taskfile.yaml'
  ) {
    return {
      category: 'shell-control-plane',
      consumer: 'Developer shell or task runner',
      trigger: 'The directory is entered or a named task is run',
      effect: 'Repository-controlled shell commands run on the host',
    };
  }

  return null;
}

function inspectPackageJson(change) {
  if (change.status === 'D') return [];
  const current = parseJson(change.content);
  const previous = parseJson(change.baseContent) || {};
  if (!current) {
    return [finding(change, {
      ruleId: 'HL-PKG-000',
      severity: 'high',
      category: 'package-control-plane',
      title: 'Changed package manifest could not be parsed',
      consumer: 'Node package manager',
      trigger: 'Package installation',
      effect: 'Lifecycle behavior cannot be inspected reliably',
      evidence: ['package.json is not valid JSON'],
      recommendation: 'Repair the manifest and scan it again before installing dependencies.',
    })];
  }

  const findings = [];
  const currentScripts = current.scripts || {};
  const oldScripts = previous.scripts || {};
  const changed = [...LIFECYCLE_SCRIPTS]
    .filter((name) => currentScripts[name] !== undefined && currentScripts[name] !== oldScripts[name]);
  if (changed.length) {
    findings.push(finding(change, {
      ruleId: 'HL-PKG-101',
      severity: 'high',
      category: 'package-control-plane',
      title: 'Package lifecycle execution was introduced or changed',
      consumer: 'npm-compatible package manager',
      trigger: 'Install, pack, or publish lifecycle',
      effect: 'Commands execute with the developer or CI runner identity',
      evidence: changed.map((name) => `${name}: ${currentScripts[name]}`),
      recommendation: 'Review the command in isolation; install with scripts disabled until explicitly approved.',
    }));
  }
  return findings;
}

function inspectIde(change) {
  const lower = change.path.toLowerCase();
  const findings = [];
  if (lower.endsWith('.vscode/tasks.json')) {
    const signals = newlyIntroducedSignals(change, [
      /"command"\s*:/i,
      /"dependsOn"\s*:/i,
      /"runOptions"\s*:/i,
      /"inputs"\s*:/i,
    ]);
    if (signals.length) {
      findings.push(finding(change, {
        ruleId: 'HL-IDE-201',
        severity: 'high',
        category: 'ide-control-plane',
        title: 'VS Code task execution was introduced or changed',
        consumer: 'VS Code task runner',
        trigger: 'Folder-open task, dependency task, or user task launch',
        effect: 'A repository command runs outside the coding-agent sandbox',
        evidence: signals,
        recommendation: 'Disable automatic tasks and approve every command before opening the repository as trusted.',
      }));
    }
  }

  if (lower.endsWith('.vscode/settings.json') || lower.endsWith('.code-workspace')) {
    const signals = newlyIntroducedSignals(change, [
      /"git\.path"\s*:/i,
      /"terminal\.integrated\.(profiles|defaultProfile|automationProfile)\./i,
      /"python\.defaultInterpreterPath"\s*:/i,
      /"php\.validate\.executablePath"\s*:/i,
      /"eslint\.(runtime|nodePath)"\s*:/i,
      /"task\.allowAutomaticTasks"\s*:\s*"on"/i,
    ]);
    if (signals.length) {
      findings.push(finding(change, {
        ruleId: 'HL-IDE-202',
        severity: 'high',
        category: 'ide-control-plane',
        title: 'IDE executable or automatic-task setting was introduced',
        consumer: 'Developer IDE',
        trigger: 'The repository is opened as a trusted workspace',
        effect: 'A repository-selected executable can run on the host',
        evidence: signals,
        recommendation: 'Remove repository-level executable paths and require explicit task approval.',
      }));
    }
  }
  return findings;
}

function inspectAgentConfiguration(change) {
  const lower = change.path.toLowerCase();
  if (!surfaceFor(lower) || surfaceFor(lower).category !== 'agent-control-plane') return [];
  const signals = newlyIntroducedSignals(change, [
    /bypasspermissions/i,
    /dangerouslydisablesandbox/i,
    /"hooks"\s*:/i,
    /"command"\s*:/i,
    /bash\s*\(\s*\*\s*\)/i,
    /"sandbox"\s*:\s*false/i,
    /approval[^\n:=]*[:=]\s*["']?(never|disabled|off)/i,
  ]);
  if (!signals.length) return [];
  return [finding(change, {
    ruleId: 'HL-AGENT-301',
    severity: 'critical',
    category: 'agent-control-plane',
    title: 'Agent authority, hook, or sandbox bypass was introduced',
    consumer: 'AI coding agent',
    trigger: 'A later agent session trusts repository-local configuration',
    effect: 'Repository content can gain tool authority or execute a host command',
    evidence: signals,
    recommendation: 'Move authority policy outside the repository and review hooks in a non-executing environment.',
  })];
}

function inspectGitControl(change) {
  const lower = change.path.toLowerCase();
  let signals = [];
  if (lower === '.gitattributes') {
    signals = newlyIntroducedSignals(change, [/(^|\s)(filter|diff|merge)=[^\s]+/i]);
  } else if (lower === '.gitmodules') {
    signals = newlyIntroducedSignals(change, [/^\s*(url|update)\s*=/i]);
  }
  if (!signals.length) return [];
  return [finding(change, {
    ruleId: 'HL-GIT-401',
    severity: 'high',
    category: 'git-control-plane',
    title: 'Git-controlled driver, filter, or external source was introduced',
    consumer: 'Git',
    trigger: 'Checkout, diff, merge, clone, or submodule operation',
    effect: 'Git may invoke or retrieve repository-selected behavior on the host',
    evidence: signals,
    recommendation: 'Inspect host Git configuration and approve this control-plane change before running Git workflows.',
  })];
}

function inspectWorkflow(change) {
  const lower = change.path.toLowerCase();
  if (!surfaceFor(lower) || surfaceFor(lower).category !== 'ci-control-plane') return [];
  const signals = newlyIntroducedSignals(change, [
    /pull_request_target\s*:/i,
    /runs-on\s*:\s*\[?\s*self-hosted/i,
    /permissions\s*:\s*write-all/i,
    /contents\s*:\s*write/i,
    /id-token\s*:\s*write/i,
    /secrets\s*:\s*inherit/i,
    /curl\b.*\|\s*(sh|bash)/i,
    /wget\b.*\|\s*(sh|bash)/i,
  ]);
  if (!signals.length) return [];
  return [finding(change, {
    ruleId: 'HL-CI-501',
    severity: 'high',
    category: 'ci-control-plane',
    title: 'Privileged CI trigger, runner, permission, or bootstrap was introduced',
    consumer: 'CI/CD runner',
    trigger: 'Repository event starts the workflow',
    effect: 'Changed code can reach write tokens, identity tokens, secrets, or a self-hosted runner',
    evidence: signals,
    recommendation: 'Reduce token permissions, isolate untrusted events, and pin execution to disposable runners.',
  })];
}

function inspectEnvironment(change) {
  const lower = change.path.toLowerCase();
  const surface = surfaceFor(lower);
  if (!surface || !['environment-control-plane', 'shell-control-plane'].includes(surface.category)) return [];
  const signals = newlyIntroducedSignals(change, [
    /post(Create|Start|Attach)Command/i,
    /initializeCommand/i,
    /runArgs/i,
    /--privileged/i,
    /\/var\/run\/docker\.sock/i,
    /network_mode\s*:\s*host/i,
    /pid\s*:\s*host/i,
    /curl\b.*\|\s*(sh|bash)/i,
    /wget\b.*\|\s*(sh|bash)/i,
  ]);
  if (!signals.length) return [];
  return [finding(change, {
    ruleId: 'HL-ENV-601',
    severity: 'high',
    category: surface.category,
    title: 'Environment bootstrap, host mount, or elevated privilege was introduced',
    consumer: surface.consumer,
    trigger: surface.trigger,
    effect: 'Repository configuration can execute commands or cross the host boundary',
    evidence: signals,
    recommendation: 'Remove host mounts and elevated modes; execute bootstrap commands only in a disposable environment.',
  })];
}

function inspectSymlink(change, root) {
  if (!change.isSymlink || !change.symlinkTarget) return [];
  const linkDirectory = path.dirname(path.join(root, normalizeRepoPath(change.path)));
  const resolved = path.resolve(linkDirectory, change.symlinkTarget);
  const escaped = path.isAbsolute(change.symlinkTarget) || !isInside(root, resolved);
  return [finding(change, {
    ruleId: escaped ? 'HL-FS-701' : 'HL-FS-702',
    severity: escaped ? 'critical' : 'medium',
    category: 'filesystem-boundary',
    title: escaped ? 'Symlink escapes the repository boundary' : 'Repository symlink was introduced or changed',
    consumer: 'Developer tools and automation',
    trigger: 'A tool follows the repository path',
    effect: escaped ? 'Reads or writes can cross into the trusted host filesystem' : 'File operations are redirected within the repository',
    evidence: [`${change.path} -> ${change.symlinkTarget}`],
    recommendation: escaped
      ? 'Remove the link or replace it with a regular file contained by the repository.'
      : 'Verify the link target and ensure downstream tools do not follow it unexpectedly.',
  })];
}

export function analyzeChange(change, context) {
  const normalized = { ...change, path: normalizeRepoPath(change.path) };
  const basename = path.posix.basename(normalized.path.toLowerCase());
  const findings = [
    ...inspectSymlink(normalized, context.root),
    ...(basename === 'package.json' ? inspectPackageJson(normalized) : []),
    ...inspectIde(normalized),
    ...inspectAgentConfiguration(normalized),
    ...inspectGitControl(normalized),
    ...inspectWorkflow(normalized),
    ...inspectEnvironment(normalized),
  ];

  if (normalized.mode === '100755' && normalized.oldMode !== '100755') {
    findings.push(finding(normalized, {
      ruleId: 'HL-FS-703',
      severity: 'medium',
      category: 'filesystem-boundary',
      title: 'Executable permission was introduced',
      consumer: 'Shell, build tool, or automation runner',
      trigger: 'The file is invoked directly',
      effect: 'Agent-written content is now directly executable',
      evidence: [`mode ${normalized.oldMode || '<new>'} -> 100755`],
      recommendation: 'Confirm that direct execution is intended and inspect the file before invoking it.',
    }));
  }

  const surface = surfaceFor(normalized.path);
  if (surface && findings.length === 0) {
    findings.push(finding(normalized, {
      ruleId: 'HL-SURFACE-001',
      severity: 'medium',
      category: surface.category,
      title: 'Trust-handoff control surface changed',
      consumer: surface.consumer,
      trigger: surface.trigger,
      effect: surface.effect,
      evidence: [normalized.status === 'D' ? 'control file deleted' : 'control file added or modified'],
      recommendation: 'Review this file separately from application code before allowing its consumer to load it.',
    }));
  }

  if (normalized.truncated && surface) {
    findings.push(finding(normalized, {
      ruleId: 'HL-SCAN-801',
      severity: 'high',
      category: 'scanner-integrity',
      title: 'Control-plane file exceeded the inspection limit',
      consumer: surface.consumer,
      trigger: surface.trigger,
      effect: 'Potential activation behavior was not fully inspected',
      evidence: ['content inspection was truncated'],
      recommendation: 'Inspect the complete file manually or raise the scan limit and run HostLatch again.',
    }));
  }

  return findings;
}

export const controlSurfaceFor = surfaceFor;
