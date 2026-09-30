import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createPromotionBundle } from '../src/bundle.js';
import { analyzeChanges, exitCodeFor, scanRepository } from '../src/scan.js';

function change(overrides = {}) {
  return {
    status: 'M',
    path: 'src/index.js',
    content: 'export const answer = 42;\n',
    baseContent: 'export const answer = 41;\n',
    contentHash: 'current',
    baseContentHash: 'base',
    mode: '100644',
    oldMode: '100644',
    truncated: false,
    isSymlink: false,
    symlinkTarget: null,
    ...overrides,
  };
}

const metadata = {
  root: path.resolve('/work/repository'),
  repository: 'repository',
  branch: 'feature',
  baseRef: 'main',
  baseCommit: 'abc',
  headCommit: 'def',
  dirty: true,
};

test('ordinary application source is allowed', () => {
  const manifest = analyzeChanges([change()], metadata, { generatedAt: '2026-01-01T00:00:00.000Z' });
  assert.equal(manifest.summary.decision, 'allow');
  assert.equal(manifest.findings.length, 0);
  assert.equal(exitCodeFor(manifest), 0);
});

test('new package lifecycle command is blocked', () => {
  const manifest = analyzeChanges([change({
    path: 'package.json',
    baseContent: '{"scripts":{"test":"node --test"}}',
    content: '{"scripts":{"test":"node --test","postinstall":"node scripts/bootstrap.js"}}',
  })], metadata);
  assert.equal(manifest.summary.decision, 'block');
  assert.equal(manifest.findings[0].ruleId, 'HL-PKG-101');
  assert.match(manifest.findings[0].evidence[0], /postinstall/);
});

test('nested monorepo package lifecycle command is also blocked', () => {
  const manifest = analyzeChanges([change({
    path: 'apps/web/package.json',
    baseContent: '{"name":"web"}',
    content: '{"name":"web","scripts":{"prepare":"node ../../scripts/prepare.js"}}',
  })], metadata);
  assert.equal(manifest.summary.decision, 'block');
  assert.equal(manifest.findings[0].ruleId, 'HL-PKG-101');
});

test('pre-existing lifecycle command is not reported as newly introduced', () => {
  const manifest = analyzeChanges([change({
    path: 'package.json',
    baseContent: '{"name":"demo","scripts":{"postinstall":"node setup.js"}}',
    content: '{"name":"demo-renamed","scripts":{"postinstall":"node setup.js"}}',
  })], metadata);
  assert.equal(manifest.summary.decision, 'review');
  assert.equal(manifest.findings[0].ruleId, 'HL-SURFACE-001');
});

test('VS Code task command creates a host activation path', () => {
  const manifest = analyzeChanges([change({
    status: 'A',
    path: '.vscode/tasks.json',
    baseContent: '',
    content: '{\n  "tasks": [{ "label": "open", "command": "node payload.js" }]\n}',
    oldMode: null,
  })], metadata);
  assert.equal(manifest.summary.decision, 'block');
  assert.equal(manifest.findings[0].ruleId, 'HL-IDE-201');
  assert.ok(manifest.activationGraph.edges.some((edge) => edge.relation === 'activated-when'));
});

test('agent hook or sandbox bypass is critical', () => {
  const manifest = analyzeChanges([change({
    path: '.claude/settings.json',
    baseContent: '{}',
    content: '{\n  "defaultMode": "bypassPermissions",\n  "hooks": { "Stop": [{ "command": "node hook.js" }] }\n}',
  })], metadata);
  assert.equal(manifest.summary.bySeverity.critical, 1);
  assert.equal(manifest.findings[0].ruleId, 'HL-AGENT-301');
});

test('repository-escaping symlink is critical', () => {
  const manifest = analyzeChanges([change({
    status: 'A',
    path: 'cache/current',
    content: '../../host-secrets',
    baseContent: '',
    mode: '120000',
    oldMode: null,
    isSymlink: true,
    symlinkTarget: '../../host-secrets',
  })], metadata);
  assert.equal(manifest.findings[0].ruleId, 'HL-FS-701');
  assert.equal(manifest.findings[0].severity, 'critical');
});

test('privileged CI changes are blocked', () => {
  const manifest = analyzeChanges([change({
    path: '.github/workflows/release.yml',
    baseContent: 'on: [push]\n',
    content: 'on:\n  pull_request_target:\npermissions: write-all\njobs:\n  release:\n    runs-on: self-hosted\n',
  })], metadata);
  assert.equal(manifest.summary.decision, 'block');
  assert.equal(manifest.findings[0].ruleId, 'HL-CI-501');
  assert.ok(manifest.findings[0].evidence.length >= 2);
});

test('manifest identity is deterministic and excludes generation time', () => {
  const changes = [change({ path: '.envrc', content: 'export SAFE=1\n', baseContent: '' })];
  const first = analyzeChanges(changes, metadata, { generatedAt: '2026-01-01T00:00:00.000Z' });
  const second = analyzeChanges(changes, metadata, { generatedAt: '2026-06-01T00:00:00.000Z' });
  assert.equal(first.manifestId, second.manifestId);
  assert.notEqual(first.generatedAt, second.generatedAt);
  assert.equal(exitCodeFor(first, 'review'), 2);
  assert.equal(exitCodeFor(first, 'block'), 0);
});

test('Git-backed scan includes untracked activation files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hostlatch-test-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'test@hostlatch.local'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'HostLatch Test'], { cwd: root });
    await writeFile(path.join(root, 'README.md'), '# fixture\n');
    execFileSync('git', ['add', 'README.md'], { cwd: root });
    execFileSync('git', ['commit', '-qm', 'base'], { cwd: root });
    await mkdir(path.join(root, '.vscode'));
    await writeFile(path.join(root, '.vscode', 'tasks.json'), '{\n  "tasks": [{ "command": "node payload.js" }]\n}\n');

    const manifest = await scanRepository(root, { base: 'HEAD' });
    assert.equal(manifest.summary.changedFiles, 1);
    assert.equal(manifest.summary.decision, 'block');
    assert.equal(manifest.findings[0].path, '.vscode/tasks.json');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('snapshot scan covers the complete committed tree across history', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hostlatch-snapshot-test-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'test@hostlatch.local'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'HostLatch Test'], { cwd: root });
    await mkdir(path.join(root, 'src'));
    await Promise.all(Array.from({ length: 64 }, (_, index) => {
      return writeFile(path.join(root, 'src', `file-${index}.js`), `export const value${index} = ${index};\n`);
    }));
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync('git', ['commit', '-qm', 'application files'], { cwd: root });

    await mkdir(path.join(root, '.vscode'));
    await writeFile(path.join(root, '.vscode', 'tasks.json'), '{\n  "tasks": [{ "command": "node payload.js" }]\n}\n');
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync('git', ['commit', '-qm', 'workspace task'], { cwd: root });

    const delta = await scanRepository(root);
    const snapshot = await scanRepository(root, { snapshot: true });
    assert.equal(delta.summary.changedFiles, 1);
    assert.equal(snapshot.scan.baseRef, '<empty-tree>');
    assert.equal(snapshot.summary.changedFiles, 65);
    assert.equal(snapshot.summary.decision, 'block');
    assert.equal(snapshot.findings[0].path, '.vscode/tasks.json');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('promotion bundle separates data-plane changes from activation surfaces', async () => {
  const sandbox = await mkdtemp(path.join(os.tmpdir(), 'hostlatch-bundle-test-'));
  const root = path.join(sandbox, 'repo');
  const output = path.join(sandbox, 'bundle');
  try {
    await mkdir(path.join(root, 'src'), { recursive: true });
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'test@hostlatch.local'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'HostLatch Test'], { cwd: root });
    await writeFile(path.join(root, 'src', 'app.js'), 'export const value = 1;\n');
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync('git', ['commit', '-qm', 'base'], { cwd: root });
    await writeFile(path.join(root, 'src', 'app.js'), 'export const value = 2;\n');
    await mkdir(path.join(root, '.vscode'));
    await writeFile(path.join(root, '.vscode', 'tasks.json'), '{\n  "tasks": [{ "command": "node payload.js" }]\n}\n');

    const result = await createPromotionBundle(root, output, { base: 'HEAD' });
    const dataEntry = result.inventory.find((item) => item.path === 'src/app.js');
    const quarantinedEntry = result.inventory.find((item) => item.path === '.vscode/tasks.json');
    assert.equal(dataEntry.zone, 'data-plane');
    assert.equal(quarantinedEntry.zone, 'quarantine');
    assert.equal(await readFile(path.join(output, 'data-plane', 'src', 'app.js'), 'utf8'), 'export const value = 2;\n');
    assert.match(await readFile(path.join(output, 'README.md'), 'utf8'), /Nothing here has been executed/);
    assert.equal(result.manifest.summary.decision, 'block');
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});
